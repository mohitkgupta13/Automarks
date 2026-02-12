"""Repair bad subject codes created by an older extractor bug.

Problem pattern:
- Some PDFs have subject code glued to subject name without whitespace (e.g. "BPHYS102PHYSICS...")
- Old regex mistakenly captured the first letter of the subject name as a trailing code suffix
  resulting in codes like "BPHYS102P" and names like "HYSICS FOR ..."

This script merges those "bad" subject codes back into the correct base code *only when*
that base code already exists in the DB (safe heuristic).

It also deduplicates results to avoid UNIQUE(student_id, semester_id, subject_id) collisions.

Usage (PowerShell):
  python scripts/repair_subject_codes.py

Optional env vars:
  DRY_RUN=true   # print actions without writing
"""

from __future__ import annotations

import os
import re
from typing import Dict, List, Tuple

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Result, Subject


SUFFIX_CODE_RE = re.compile(r"^([A-Z]{3,6}\d{3})([A-Z])$")
BASE_CODE_RE = re.compile(r"^([A-Z]{3,6}\d{3})")

# Known high-signal "missing first letter" prefixes observed in VTU exports.
# We keep this intentionally small to avoid damaging legit codes like BESCK104D.
MISSING_FIRST_LETTER_PREFIXES = {
    "HYSICS": "P",          # PHYSICS
    "OMMUNICATIVE": "C",   # COMMUNICATIVE
    "AMSKRUTIKA": "S",     # SAMSKRUTIKA
    "ALAKE": "B",          # BALAKE
}


def _pick_better_result(a: Result, b: Result) -> Result:
    """Return the Result row to keep (prefers more complete mark data)."""

    def score(r: Result) -> Tuple[int, int, int, int]:
        # Higher is better
        return (
            0 if r.total_marks is None else 1,
            0 if r.external_marks is None else 1,
            0 if r.internal_marks is None else 1,
            0 if not r.result_status else 1,
        )

    return a if score(a) >= score(b) else b


def repair_subject_codes(db: Session, dry_run: bool) -> Dict[str, int]:
    subjects: List[Subject] = db.query(Subject).all()
    by_code: Dict[str, Subject] = {s.subject_code: s for s in subjects}

    # Candidates are (subject_to_fix, target_code, target_name or None)
    candidates: List[Tuple[Subject, str, str | None]] = []

    # Pattern 1: glued subject code + start of subject name in subject_code itself.
    # Examples:
    # - BAD515CCLOUD  -> BAD515C + "CLOUD" (valid code includes suffix C)
    # - BNSK559NATIONAL -> BNSK559 + "NATIONAL" (valid code has no suffix)
    for s in subjects:
        code = (s.subject_code or "").strip()
        if not code:
            continue
        # If code is much longer than a normal code, try to split a valid prefix.
        if len(code) <= 10:
            continue
        m = BASE_CODE_RE.match(code)
        if not m:
            continue
        base = m.group(1)
        if base == code:
            continue

        # Prefer a target code that actually exists.
        suffix_char = code[len(base) : len(base) + 1]
        with_suffix = (base + suffix_char) if suffix_char.isalpha() else None

        target = None
        if with_suffix and with_suffix in by_code:
            target = with_suffix
        elif base in by_code:
            target = base

        if target:
            candidates.append((s, target, None))

    # Pattern 2: trailing letter in code is actually first letter of subject name.
    # Example: BPHYS102P + HYSICS... -> BPHYS102 + PHYSICS...
    for s in subjects:
        code = (s.subject_code or "").strip()
        name = (s.subject_name or "").strip()
        m = SUFFIX_CODE_RE.match(code)
        if not m or not name:
            continue
        base_code, suffix = m.group(1), m.group(2)

        # Only apply if it matches one of our high-signal broken-name prefixes.
        # This avoids breaking legitimate suffix codes like BESCK104D, BETCK105I.
        upper_name = re.sub(r"\s+", " ", name).upper()
        first_word = upper_name.split(" ", 1)[0]
        expected_prefix_letter = MISSING_FIRST_LETTER_PREFIXES.get(first_word)
        if expected_prefix_letter != suffix:
            continue

        fixed_name = suffix + name
        candidates.append((s, base_code, fixed_name))

    stats = {
        "subjects_scanned": len(subjects),
        "merge_candidates": len(candidates),
        "subjects_merged": 0,
        "results_moved": 0,
        "results_deduped": 0,
        "subjects_renamed": 0,
        "subject_names_fixed": 0,
        "subjects_deleted": 0,
    }

    # To avoid duplicate work, process each subject_id once.
    seen_subject_ids: set[int] = set()

    for subject_to_fix, target_code, target_name in candidates:
        if subject_to_fix.id in seen_subject_ids:
            continue
        seen_subject_ids.add(subject_to_fix.id)

        # If target_code already exists, merge into it; otherwise rename this subject in place.
        existing_target = by_code.get(target_code)

        if existing_target and existing_target.id != subject_to_fix.id:
            good_subject = existing_target
            bad_subject = subject_to_fix

            bad_results: List[Result] = db.query(Result).filter(Result.subject_id == bad_subject.id).all()

            for r in bad_results:
                existing: Result | None = (
                    db.query(Result)
                    .filter(
                        and_(
                            Result.student_id == r.student_id,
                            Result.semester_id == r.semester_id,
                            Result.subject_id == good_subject.id,
                        )
                    )
                    .one_or_none()
                )

                if existing is None:
                    if not dry_run:
                        r.subject_id = good_subject.id
                    stats["results_moved"] += 1
                    continue

                keep = _pick_better_result(existing, r)
                if keep is r:
                    if not dry_run:
                        r.subject_id = good_subject.id
                        db.delete(existing)
                else:
                    if not dry_run:
                        db.delete(r)

                stats["results_deduped"] += 1

            # Optionally improve the subject name if we have a better fixed name.
            if target_name and target_name.strip():
                if not dry_run and good_subject.subject_name != target_name:
                    good_subject.subject_name = target_name
                stats["subject_names_fixed"] += 1

            if not dry_run:
                db.delete(bad_subject)
            stats["subjects_deleted"] += 1
            stats["subjects_merged"] += 1

        else:
            # Rename in place (safe when target_code doesn't exist)
            if subject_to_fix.subject_code != target_code:
                if not dry_run:
                    subject_to_fix.subject_code = target_code
                stats["subjects_renamed"] += 1
                # Update index map so future merges see the renamed code.
                by_code[target_code] = subject_to_fix

            if target_name and target_name.strip() and subject_to_fix.subject_name != target_name:
                if not dry_run:
                    subject_to_fix.subject_name = target_name
                stats["subject_names_fixed"] += 1

    return stats


def main() -> None:
    dry_run = os.getenv("DRY_RUN", "false").lower() in {"1", "true", "yes"}

    db = SessionLocal()
    try:
        stats = repair_subject_codes(db, dry_run=dry_run)
        if dry_run:
            print("DRY_RUN=true (no changes written)")
        else:
            db.commit()
            print("Committed changes")

        for k, v in stats.items():
            print(f"{k}: {v}")

        if not dry_run and stats["subjects_merged"] == 0:
            print("No merge candidates found. If you still see bad codes, they may not have a base code present yet.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
