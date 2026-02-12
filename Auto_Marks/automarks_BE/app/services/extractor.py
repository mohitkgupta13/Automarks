"""
PDF Extraction Service using Docling
Extracts VTU results from PDF files
"""
import re
import json
import os
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from pypdf import PdfReader
from app.schemas import ExtractedStudentResult, ExtractedSubjectResult
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to enable Docling if available; fall back to lightweight pypdf.
try:  # Optional dependency path
    from docling.document_converter import DocumentConverter

    _docling_available = True
except Exception:  # noqa: BLE001
    _docling_available = False

# Toggle Docling via environment to avoid slow, model-download path when not desired.
USE_DOCLING = os.getenv("USE_DOCLING", "false").lower() in {"1", "true", "yes"}


class VTUResultExtractor:
    """
    Extracts VTU student results from PDF using Docling
    """

    def __init__(self):
        """Lightweight extractor using pypdf (no heavy models/OCR)."""
        pass

    def extract_from_pdf(self, pdf_path: str) -> Optional[ExtractedStudentResult]:
        """
        Extract VTU result data from a PDF file
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            ExtractedStudentResult object or None if extraction fails
        """
        try:
            logger.info(f"Processing PDF: {pdf_path}")

            markdown_content = None

            # Prefer Docling if allowed; otherwise stay lightweight
            if _docling_available and USE_DOCLING:
                try:
                    converter = DocumentConverter()
                    doc = converter.convert(pdf_path)
                    markdown_content = doc.document.export_to_markdown()
                    logger.info("Docling extraction succeeded")
                except Exception as doc_err:  # noqa: BLE001
                    logger.warning(f"Docling extraction failed, falling back to pypdf: {doc_err}")
            elif _docling_available and not USE_DOCLING:
                logger.info("Docling available but disabled via USE_DOCLING; using pypdf")

            # Fallback to lightweight pypdf
            if markdown_content is None:
                reader = PdfReader(pdf_path)
                text_chunks: List[str] = []
                for page in reader.pages:
                    try:
                        text_chunks.append(page.extract_text() or "")
                    except Exception as page_err:  # noqa: BLE001
                        logger.warning(f"Failed to read a page: {page_err}")
                markdown_content = "\n".join(text_chunks)
            
            # Extract structured data from text
            extracted_data = self._parse_markdown_content(markdown_content)
            
            if extracted_data:
                logger.info(f"Successfully extracted data for USN: {extracted_data.usn}")
                return extracted_data
            else:
                logger.warning(f"No valid data extracted from {pdf_path}")
                return None
                
        except Exception as e:
            logger.error(f"Error extracting from {pdf_path}: {str(e)}")
            return None

    def _parse_markdown_content(self, content: str) -> Optional[ExtractedStudentResult]:
        """
        Parse markdown content to extract student result information
        
        Args:
            content: Markdown content from Docling
            
        Returns:
            ExtractedStudentResult or None
        """
        try:
            # DEBUG: Log first 500 chars of content to see what we're working with
            logger.debug(f"Content preview (first 500 chars): {content[:500]}")
            
            # Extract USN (University Seat Number)
            # Pattern: matches "University Seat Number : 1SJ18CS000" or just "1SJ18CS000" if labeled
            usn_match = re.search(r'(?:University Seat Number|USN)\s*[:\.]?\s*([A-Z0-9]{10})', content, re.IGNORECASE)
            if not usn_match:
                # Fallback: look for 10-char alphanumeric string starting with 1, 2, 3, or 4 followed by 2 letters
                usn_match = re.search(r'\b([1-4][A-Z]{2}\d{2}[A-Z]{2}\d{3})\b', content)

            if not usn_match:
                logger.error(f"USN not found in document. Content length: {len(content)}")
                # logger.debug(f"Content dump: {content[:1000]}") # Too verbose?
                return None
            usn = usn_match.group(1).strip().upper()

            # Extract Student Name
            # Pattern: "Student Name : MOHIT KUMAR"
            name_match = re.search(r'(?:Student Name|Name)\s*[:\.]?\s*([A-Za-z\s\.]+)(?:\n|Semester)', content, re.IGNORECASE)
            if not name_match:
                # Fallback: look for name in first few lines if not labeled
                pass 
            
            student_name = name_match.group(1).strip() if name_match else "Unknown"

            # Extract Semester
            # Pattern: "Semester : 4"
            semester_match = re.search(r'Semester\s*[:\.]?\s*(\d+)', content, re.IGNORECASE)
            if not semester_match:
                # Try finding just a single digit 1-8 isolated if no label? Risky.
                # Let's try "IV Semester" or "Fourth Semester" mapping if needed, but digits are standard vturesults.
                logger.error("Semester not found in document")
                return None
            semester = int(semester_match.group(1))

            # Extract exam period (month and year)
            exam_month = None
            exam_year = None
            # Pattern: "December-2024" or "Jan/Feb 2024"
            exam_period_match = re.search(r'([A-Za-z]+)(?:-|/)?([A-Za-z]+)?\s*[-–]\s*(\d{4})', content, re.IGNORECASE) 
            if not exam_period_match:
                 # Try simple Month-Year
                 exam_period_match = re.search(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*[-–]\s*(\d{4})', content, re.IGNORECASE)

            if exam_period_match:
                if len(exam_period_match.groups()) == 3 and exam_period_match.group(2):
                     # e.g. Jan/Feb
                     exam_month = f"{exam_period_match.group(1)}/{exam_period_match.group(2)}"
                     exam_year = int(exam_period_match.group(3))
                else:
                    exam_month = exam_period_match.group(1)
                    # Handle the case where the regex might match 2 groups or 3 depending on which one it hit
                    # The simple fallback hits group 1 (month) and group 2 (year)
                    if len(exam_period_match.groups()) >= 2 and exam_period_match.group(2):
                         if exam_period_match.group(2).isdigit():
                             exam_year = int(exam_period_match.group(2))
                         else:
                             # This might be the group 3 from the first regex if group 2 was None? 
                             # Actually group 3 is the year in result 1.
                             try:
                                exam_year = int(exam_period_match.groups()[-1])
                             except:
                                pass

            # Extract subjects and results
            subjects = self._extract_subjects(content)
            
            if not subjects:
                logger.error("No subjects found in document")
                return None

            return ExtractedStudentResult(
                usn=usn,
                student_name=student_name,
                semester=semester,
                exam_month=exam_month,
                exam_year=exam_year,
                subjects=subjects
            )

        except Exception as e:
            logger.error(f"Error parsing markdown content: {str(e)}")
            return None

    def _extract_subjects(self, content: str) -> List[ExtractedSubjectResult]:
        """
        Extract subject-wise results from VTU PDF content
        Handles multi-line subject names and various formatting issues
        
        Args:
            content: Document content
            
        Returns:
            List of ExtractedSubjectResult objects
        """
        subjects: List[ExtractedSubjectResult] = []

        # VTU status codes can be more than just P/F
        marks_re = re.compile(
            r"(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+(P|F|A|W|X|NE)\s+(\d{4}-\d{2}-\d{2})"
        )

        # Subject code appears at the start of a line.
        # IMPORTANT: Some PDFs glue code+name without a space (e.g., "BPHYS102PHYSICS...").
        # In that case, we must NOT consume the first letter of the subject name as a code suffix.
        # Only treat a trailing letter as part of the subject code if it's followed by whitespace/end.
        subject_start_re = re.compile(r"^([A-Z]{3,6}\d{3}(?:[A-Z](?=\s|$))?)\s*(.*)$")

        def clean_subject_name(name: str) -> str:
            n = re.sub(r"\s+", " ", (name or "").strip())
            # Heuristic: some PDFs leak a stray leading letter into the subject name
            # e.g. "DINTRODUCTION TO ..." -> "INTRODUCTION TO ..."
            if len(n) >= 12 and re.match(r"^[A-Z](INTRODUCTION|PRINCIPLES|FUNDAMENTALS)", n, re.IGNORECASE):
                n = n[1:].lstrip()
            return n

        def is_noise_line(text: str) -> bool:
            lowered = text.strip().lower()
            if not lowered:
                return True
            if "nomenclature" in lowered or "abbreviations" in lowered or lowered.startswith("note"):
                return True
            if lowered.startswith("results of") or "registrar" in lowered or "sd/" in lowered:
                return True
            # Table header fragments that sometimes repeat in extracted text
            header_tokens = [
                "subject",
                "code",
                "subject name",
                "internal",
                "external",
                "marks",
                "total",
                "result",
                "announced",
                "updated",
                "on",
            ]
            # If the line is basically only header words, ignore it
            words = re.findall(r"[a-zA-Z]+", lowered)
            return bool(words) and all(w in header_tokens for w in words)

        lines = content.split("\n")
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            start_match = subject_start_re.match(line)
            if not start_match:
                i += 1
                continue

            subject_code = start_match.group(1)
            rest_of_line = (start_match.group(2) or "").strip()
            collected_name_parts: List[str] = []

            # 1) Handle the common case where marks are on the SAME line as subject code.
            if rest_of_line:
                same_line_marks = marks_re.search(rest_of_line)
                if same_line_marks:
                    subject_name = clean_subject_name(rest_of_line[: same_line_marks.start()].strip())
                    internal_marks = int(same_line_marks.group(1))
                    external_marks = int(same_line_marks.group(2))
                    total_marks = int(same_line_marks.group(3))
                    result_status = same_line_marks.group(4)
                    announced_date = same_line_marks.group(5)

                    subjects.append(
                        ExtractedSubjectResult(
                            subject_code=subject_code,
                            subject_name=subject_name,
                            internal_marks=internal_marks if internal_marks != 0 else None,
                            external_marks=external_marks if external_marks != 0 else None,
                            total_marks=total_marks,
                            result_status=result_status,
                            announced_date=announced_date,
                        )
                    )
                    i += 1
                    continue

                if not is_noise_line(rest_of_line):
                    collected_name_parts.append(rest_of_line)

            # 2) Otherwise, scan forward until we find the marks row.
            i += 1
            found_marks = False
            while i < len(lines):
                next_line = lines[i].strip()

                if not next_line:
                    i += 1
                    continue

                # Stop if we hit the next subject
                if subject_start_re.match(next_line):
                    break

                next_marks = marks_re.search(next_line)
                if next_marks:
                    before_marks = next_line[: next_marks.start()].strip()
                    if before_marks and not is_noise_line(before_marks):
                        collected_name_parts.append(before_marks)

                    internal_marks = int(next_marks.group(1))
                    external_marks = int(next_marks.group(2))
                    total_marks = int(next_marks.group(3))
                    result_status = next_marks.group(4)
                    announced_date = next_marks.group(5)

                    subject_name = " ".join(p for p in collected_name_parts if p).strip()
                    subject_name = clean_subject_name(subject_name)
                    subjects.append(
                        ExtractedSubjectResult(
                            subject_code=subject_code,
                            subject_name=subject_name,
                            internal_marks=internal_marks if internal_marks != 0 else None,
                            external_marks=external_marks if external_marks != 0 else None,
                            total_marks=total_marks,
                            result_status=result_status,
                            announced_date=announced_date,
                        )
                    )
                    found_marks = True
                    i += 1
                    break

                # Continuation of subject name or noise: keep the name, but never abort the subject.
                if not is_noise_line(next_line):
                    collected_name_parts.append(next_line)
                i += 1

            # If we never found marks for this subject, just move on (don’t hard-fail the entire PDF).
            if not found_marks:
                # Don't increment i here; outer loop continues from current i (likely at next subject).
                continue

        logger.info(f"Extracted {len(subjects)} subjects")
        return subjects

    def save_to_json(self, extracted_data: ExtractedStudentResult, output_path: str) -> bool:
        """
        Save extracted data to JSON file
        
        Args:
            extracted_data: Extracted student result data
            output_path: Path where JSON should be saved
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Convert to dict
            data_dict = extracted_data.model_dump()
            
            # Ensure output directory exists
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            
            # Write to JSON file
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data_dict, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Saved extracted data to {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving to JSON: {str(e)}")
            return False

    def batch_extract(self, pdf_files: List[str], output_dir: str) -> Dict[str, any]:
        """
        Process multiple PDF files in batch
        
        Args:
            pdf_files: List of PDF file paths
            output_dir: Directory to save JSON outputs
            
        Returns:
            Dictionary with processing statistics
        """
        results = {
            'total': len(pdf_files),
            'successful': 0,
            'failed': 0,
            'extracted_data': [],
            'errors': []
        }
        
        for pdf_file in pdf_files:
            try:
                # Extract data
                extracted_data = self.extract_from_pdf(pdf_file)
                
                if extracted_data:
                    # Generate output filename
                    pdf_name = Path(pdf_file).stem
                    json_path = Path(output_dir) / f"{pdf_name}_{extracted_data.usn}.json"
                    
                    # Save to JSON
                    if self.save_to_json(extracted_data, str(json_path)):
                        results['successful'] += 1
                        results['extracted_data'].append(extracted_data)
                    else:
                        results['failed'] += 1
                        results['errors'].append(f"Failed to save JSON for {pdf_file}")
                else:
                    results['failed'] += 1
                    results['errors'].append(f"Failed to extract data from {pdf_file}")
                    
            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"Error processing {pdf_file}: {str(e)}")
        
        logger.info(f"Batch processing completed: {results['successful']}/{results['total']} successful")
        return results


# Singleton instance
extractor = VTUResultExtractor()


def extract_pdf(pdf_path: str) -> Optional[ExtractedStudentResult]:
    """
    Helper function to extract data from a single PDF
    """
    return extractor.extract_from_pdf(pdf_path)


def extract_batch(pdf_files: List[str], output_dir: str) -> Dict:
    """
    Helper function to extract data from multiple PDFs
    """
    return extractor.batch_extract(pdf_files, output_dir)
