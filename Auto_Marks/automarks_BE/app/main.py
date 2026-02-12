"""
FastAPI Main Application
VTU Results Extraction and Management System
"""
from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, Query, BackgroundTasks, WebSocket, WebSocketDisconnect, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Set
import os
import shutil
import uuid
from pathlib import Path
from datetime import datetime, date
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
import asyncio
import json
from logging.handlers import RotatingFileHandler
from sqlalchemy import inspect, text
import pandas as pd

from app.database import get_db, init_db, engine
from app.models import Student, Subject, Semester, Result, UploadLog, UploadStatus, Notification, Base
from app.schemas import (
    StudentResponse, SubjectResponse, SemesterResponse, ResultResponse,
    StudentCreate, SubjectCreate, SemesterCreate, ResultCreate,
    APIResponse, BatchUploadResponse, ExtractedStudentResult,
    SubjectStatistics, SemesterSummary
)
from app.services.extractor import extract_pdf, VTUResultExtractor
from app.services.analyzer import ResultAnalyzer
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== HELPER FUNCTIONS ====================

def normalize_result_status(value: Optional[str], to_output: bool = False) -> Optional[str]:
    """Map between various result status representations and the canonical letter codes.

    Stored form: single-letter/short codes (P, F, A, W, X, NE).
    Input may be already a code, or long-form values like PASS/FAIL.
    When to_output=True, long-form stored values (if any) are converted to codes for API responses.
    """
    if value is None:
        return None

    val = str(value).strip().upper()

    long_to_code = {
        "PASS": "P",
        "FAIL": "F",
        "ABSENT": "A",
        "WITHHELD": "W",
        "NOT_ELIGIBLE_X": "X",
        "NOT ELIGIBLE X": "X",
        "NOT_ELIGIBLE_NE": "NE",
        "NOT ELIGIBLE NE": "NE",
    }

    # Already a known code
    if val in {"P", "F", "A", "W", "X", "NE"}:
        return val

    # Map long-form to code
    if val in long_to_code:
        return long_to_code[val]

    # Fallback: return untouched to avoid hard failure
    return val if to_output else None

# Create FastAPI app
app = FastAPI(
    title="VTU Results Management System",
    description="API for extracting and managing VTU student results from PDFs",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== WEBSOCKET & LOGGING SETUP ====================

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)
        # Clean up disconnected clients
        self.active_connections -= disconnected

manager = ConnectionManager()
notification_manager = ConnectionManager()

# Error-only logging setup
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)
error_logger = logging.getLogger("upload_errors")
error_logger.setLevel(logging.ERROR)
error_logger.propagate = False  # Don't propagate to root logger
handler = RotatingFileHandler(
    LOG_DIR / "upload_errors.log",
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
handler.setFormatter(logging.Formatter(
    '%(asctime)s - BATCH:%(batch_id)s - FILE:%(filename)s - %(levelname)s - %(message)s'
))
error_logger.addHandler(handler)

# Thread pool for PDF processing (8 workers for Ryzen 5)
executor = ThreadPoolExecutor(max_workers=8)

# Create directories
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "data/raw"))
PROCESSED_DIR = Path(os.getenv("PROCESSED_DIR", "data/processed"))
EXPORT_DIR = Path("data/exports")

# By default, delete raw PDFs after processing to avoid filling disk.
# Set KEEP_RAW_FILES=true to retain raw uploads for debugging/audit.
KEEP_RAW_FILES = os.getenv("KEEP_RAW_FILES", "false").lower() in {"1", "true", "yes"}

for directory in [UPLOAD_DIR, PROCESSED_DIR, EXPORT_DIR]:
    directory.mkdir(parents=True, exist_ok=True)


# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database tables on startup"""
    try:
        Base.metadata.create_all(bind=engine)
        # Lightweight schema evolution (no migrations): add new columns if missing.
        insp = inspect(engine)
        try:
            student_cols = {c["name"] for c in insp.get_columns("students")}
        except Exception:
            student_cols = set()

        if "batch" not in student_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE students ADD COLUMN IF NOT EXISTS batch VARCHAR(9) NULL"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_students_batch ON students (batch)"))

        if "branch" not in student_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE students ADD COLUMN IF NOT EXISTS branch VARCHAR(10) NULL"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_students_branch ON students (branch)"))

        # Track upload batch UUID on results for batch-level deletes/auditing
        try:
            result_cols = {c["name"] for c in insp.get_columns("results")}
        except Exception:
            result_cols = set()

        if "upload_batch_id" not in result_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE results ADD COLUMN IF NOT EXISTS upload_batch_id VARCHAR(50) NULL"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_results_upload_batch_id ON results (upload_batch_id)"))

        # Credits metadata for CBCS SGPA/CGPA
        try:
            subject_cols = {c["name"] for c in insp.get_columns("subjects")}
        except Exception:
            subject_cols = set()

        if "credits" not in subject_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS credits INT NULL"))

        # Best-effort backfill for branch on existing students
        try:
            from app.database import SessionLocal

            db = SessionLocal()
            try:
                students_missing_branch = (
                    db.query(Student)
                    .filter((Student.branch.is_(None)) | (Student.branch == ""))
                    .limit(5000)
                    .all()
                )
                updated = 0
                for s in students_missing_branch:
                    b = _extract_branch_from_usn(s.usn)
                    if b:
                        s.branch = b
                        updated += 1
                if updated:
                    db.commit()
            finally:
                db.close()
        except Exception:
            # Backfill should never block startup
            pass

        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "VTU Results Management System API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# ==================== WEBSOCKET ENDPOINT ====================

@app.websocket("/ws/upload-progress")
async def websocket_upload_progress(websocket: WebSocket):
    """WebSocket endpoint for real-time upload progress updates"""
    await manager.connect(websocket)
    try:
        # Keep connection alive
        while True:
            # Wait for client messages (ping/pong)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        manager.disconnect(websocket)


@app.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    """WebSocket endpoint for real-time notifications"""
    await notification_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive (client may send pings)
            await websocket.receive_text()
    except WebSocketDisconnect:
        notification_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Notifications WebSocket error: {str(e)}")
        notification_manager.disconnect(websocket)


# ==================== UPLOAD ENDPOINTS ====================

@app.post("/upload/single", response_model=APIResponse)
async def upload_single_pdf(
    file: UploadFile = File(...),
    batch: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Upload and process a single PDF file
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    file_path: Optional[Path] = None
    try:
        # Save uploaded file
        file_path = UPLOAD_DIR / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Extract data from PDF
        extracted_data = extract_pdf(str(file_path))

        if not extracted_data:
            raise HTTPException(status_code=400, detail="Failed to extract data from PDF")

        # Save extracted data to database
        save_extracted_data(db, extracted_data, batch=batch, upload_batch_id="SINGLE")

        # Notification (real)
        try:
            n = _create_notification(
                db,
                title=f"Single PDF processed: {extracted_data.usn}",
                detail=f"File: {file.filename}; Semester: {extracted_data.semester}; Subjects: {len(extracted_data.subjects)}",
                level="success",
            )
            await notification_manager.broadcast(
                {
                    "type": "notification",
                    "data": {
                        "id": n.id,
                        "title": n.title,
                        "detail": n.detail,
                        "level": n.level,
                        "created_at": n.created_at.isoformat() if n.created_at else None,
                    },
                }
            )
        except Exception:
            pass

        # Save to JSON
        json_path = PROCESSED_DIR / f"{extracted_data.usn}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        extractor = VTUResultExtractor()
        extractor.save_to_json(extracted_data, str(json_path))

        return APIResponse(
            success=True,
            message=f"Successfully processed {file.filename}",
            data={
                "usn": extracted_data.usn,
                "student_name": extracted_data.student_name,
                "semester": extracted_data.semester,
                "subjects_count": len(extracted_data.subjects),
            },
        )

    except HTTPException as e:
        # Log upload failures to upload_errors.log as well (error-only)
        try:
            error_logger.error(
                str(e.detail),
                extra={"batch_id": "SINGLE", "filename": file.filename},
            )
        except Exception:
            pass
        logger.error(f"Error processing file: {str(e)}")
        raise

    except Exception as e:
        # Log unexpected errors to upload_errors.log
        try:
            error_logger.error(
                str(e),
                extra={"batch_id": "SINGLE", "filename": file.filename},
            )
        except Exception:
            pass
        logger.error(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Avoid filling data/raw with processed PDFs
        if file_path and not KEEP_RAW_FILES:
            try:
                if file_path.exists():
                    file_path.unlink()
            except Exception as cleanup_err:
                logger.warning(f"Failed to delete raw file {file_path}: {cleanup_err}")


@app.post("/upload/batch", response_model=BatchUploadResponse)
async def upload_batch_pdfs(
    files: List[UploadFile] = File(...),
    batch: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Upload and process multiple PDF files with real-time WebSocket updates
    Production-grade implementation with thread pool processing
    """
    batch_id = str(uuid.uuid4())
    total_files = len(files)
    
    # Create upload log
    upload_log = UploadLog(
        batch_id=batch_id,
        total_files=total_files,
        status=UploadStatus.PENDING.value
    )
    db.add(upload_log)
    db.commit()

    print(f"🚀 Received batch upload request: {len(files)} files. Batch: {batch}")
    
    # Save files to disk immediately (don't pass file objects to background task)
    saved_files = []
    for idx, file in enumerate(files):
        if file.filename.endswith('.pdf'):
            file_path = UPLOAD_DIR / f"{batch_id}_{idx}_{file.filename}"
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_files.append((str(file_path), file.filename))
            print(f"  Saved file {idx+1}/{len(files)}: {file.filename}")

    print(f"📦 Files saved. Starting background task for Batch ID: {batch_id}")
    # Start background processing with thread pool
    asyncio.create_task(process_batch_files_async(batch_id, saved_files, batch))

    return BatchUploadResponse(
        batch_id=batch_id,
        total_files=total_files,
        processed=0,
        failed=0,
        errors=[]
    )


async def process_batch_files_async(batch_id: str, files: List[tuple], batch: str):
    """
    Production-grade async batch processor with thread pool and WebSocket updates
    Features:
    - Thread pool for parallel PDF processing (8 workers)
    - Bulk commits every 10 PDFs
    - Real-time WebSocket broadcasts
    - Error-only logging to file
    - Continue on failure with error notifications
    """
    from app.database import SessionLocal
    
    # Create new DB session for background task
    db = SessionLocal()
    
    try:
        # Update status to processing
        upload_log = db.query(UploadLog).filter(UploadLog.batch_id == batch_id).first()
        upload_log.status = UploadStatus.PROCESSING.value
        db.commit()

        await manager.broadcast({
            "batch_id": batch_id,
            "status": "processing",
            "processed": 0,
            "failed": 0,
            "total": len(files),
            "percentage": 0
        })

        processed = 0
        failed = 0
        failed_files = []  # Track failed files for popup notification
        pending_commits = []  # Buffer for bulk commits

        def process_single_pdf(file_path: str, filename: str, index: int):
            """Process single PDF in thread pool"""
            try:
                # Extract data
                extracted_data = extract_pdf(file_path)

                if extracted_data:
                    return ("success", filename, extracted_data, index)
                else:
                    return ("failed", filename, "Failed to extract data", index)

            except Exception as e:
                return ("error", filename, str(e), index)

            finally:
                # Avoid filling data/raw with processed PDFs
                if not KEEP_RAW_FILES:
                    try:
                        p = Path(file_path)
                        if p.exists():
                            p.unlink()
                    except Exception:
                        # Deletion failure should never kill processing
                        pass

        # Submit all tasks to thread pool
        futures = {
            executor.submit(process_single_pdf, file_path, filename, idx): (filename, idx)
            for idx, (file_path, filename) in enumerate(files, 1)
        }

        # Process completed tasks as they finish
        for future in as_completed(futures):
            filename, idx = futures[future]
            
            try:
                status, fname, result, file_index = future.result()
                
                # Update current file in database
                upload_log = db.query(UploadLog).filter(UploadLog.batch_id == batch_id).first()
                upload_log.current_file = fname
                upload_log.current_file_index = file_index
                
                if status == "success":
                    # Add to pending commits buffer
                    pending_commits.append(result)
                    processed += 1
                    
                    # Bulk commit every 10 PDFs (Option B)
                    if len(pending_commits) >= 10:
                        for data in pending_commits:
                            save_extracted_data(db, data, batch=batch, upload_batch_id=batch_id)
                        db.commit()
                        pending_commits.clear()
                    
                    upload_log.processed_files = processed
                    db.commit()
                else:
                    # Handle failure
                    failed += 1
                    failed_files.append({"filename": fname, "error": result})
                    upload_log.failed_files = failed
                    db.commit()
                    
                    # Log error to file
                    error_logger.error(
                        result,
                        extra={"batch_id": batch_id, "filename": fname}
                    )
                
                # Broadcast real-time update via WebSocket
                percentage = int((processed + failed) / len(files) * 100)
                await manager.broadcast({
                    "batch_id": batch_id,
                    "current_file": fname,
                    "current_file_index": file_index,
                    "processed": processed,
                    "failed": failed,
                    "total": len(files),
                    "percentage": percentage,
                    "status": "processing",
                    "failed_files": failed_files  # Send failed files for popup
                })
                
            except Exception as e:
                failed += 1
                failed_files.append({"filename": filename, "error": str(e)})
                error_logger.error(
                    str(e),
                    extra={"batch_id": batch_id, "filename": filename}
                )

        # Commit any remaining PDFs in buffer
        if pending_commits:
            for data in pending_commits:
                save_extracted_data(db, data, batch=batch, upload_batch_id=batch_id)
            db.commit()

        # Final update
        upload_log = db.query(UploadLog).filter(UploadLog.batch_id == batch_id).first()
        upload_log.processed_files = processed
        upload_log.failed_files = failed
        upload_log.status = UploadStatus.COMPLETED.value if failed == 0 else UploadStatus.FAILED.value
        upload_log.completed_timestamp = datetime.now()
        upload_log.current_file = None
        db.commit()

        # Final WebSocket broadcast
        await manager.broadcast({
            "batch_id": batch_id,
            "processed": processed,
            "failed": failed,
            "total": len(files),
            "percentage": 100,
            "status": "completed" if failed == 0 else "failed",
            "failed_files": failed_files
        })

        # Summary notification (real)
        try:
            level = "success" if failed == 0 else "error"
            n = _create_notification(
                db,
                title=f"Batch {batch_id} finished ({processed} ok, {failed} failed)",
                detail=f"Batch: {batch}; Total files: {len(files)}",
                level=level,
            )
            await notification_manager.broadcast(
                {
                    "type": "notification",
                    "data": {
                        "id": n.id,
                        "title": n.title,
                        "detail": n.detail,
                        "level": n.level,
                        "created_at": n.created_at.isoformat() if n.created_at else None,
                    },
                }
            )
        except Exception:
            pass

    except Exception as e:
        logger.error(f"Batch processing error: {str(e)}")
        error_logger.error(str(e), extra={"batch_id": batch_id, "filename": "BATCH_ERROR"})
        
        upload_log = db.query(UploadLog).filter(UploadLog.batch_id == batch_id).first()
        if upload_log:
            upload_log.status = UploadStatus.FAILED.value
            upload_log.error_log = str(e)
            db.commit()
            
        await manager.broadcast({
            "batch_id": batch_id,
            "status": "error",
            "error": str(e)
        })
    
    finally:
        db.close()



@app.get("/upload/status/{batch_id}")
async def get_upload_status(batch_id: str, db: Session = Depends(get_db)):
    """Get status of a batch upload with real-time progress"""
    upload_log = db.query(UploadLog).filter(UploadLog.batch_id == batch_id).first()
    
    if not upload_log:
        raise HTTPException(status_code=404, detail="Batch not found")

    percentage = 0
    if upload_log.total_files > 0:
        percentage = int((upload_log.processed_files + upload_log.failed_files) / upload_log.total_files * 100)

    return {
        "batch_id": upload_log.batch_id,
        "total_files": upload_log.total_files,
        "processed": upload_log.processed_files,
        "failed": upload_log.failed_files,
        "current_file": upload_log.current_file,
        "current_file_index": upload_log.current_file_index,
        "percentage": percentage,
        "status": upload_log.status,
        "errors": upload_log.error_log.split("\n") if upload_log.error_log else []
    }



# ==================== STUDENT ENDPOINTS ====================

@app.get("/students", response_model=List[StudentResponse])
async def get_students(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get all students with pagination"""
    students = db.query(Student).offset(skip).limit(limit).all()
    return students


@app.get("/students/{usn}", response_model=StudentResponse)
async def get_student(usn: str, db: Session = Depends(get_db)):
    """Get student by USN"""
    student = db.query(Student).filter(Student.usn == usn).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


# ==================== RESULTS ENDPOINTS ====================

@app.get("/results")
async def get_results(
    usn: Optional[str] = None,
    semester: Optional[int] = None,
    batch: Optional[str] = None,
    branch: Optional[str] = None,
    status: Optional[str] = None,
    exam_year: Optional[int] = Query(None, ge=2000, le=2100),
    exam_month: Optional[str] = None,
    subject_code: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get results with filters"""
    query = db.query(Result).join(Student).join(Subject).join(Semester)

    if usn:
        query = query.filter(Student.usn == usn)
    if semester:
        query = query.filter(Semester.semester_number == semester)
    if batch:
        query = query.filter(Student.batch == batch)
    if branch:
        query = query.filter(Student.branch == branch)
    if status:
        code = normalize_result_status(status)
        # Accept either short code (P/F) or long-form legacy values (PASS/FAIL)
        if code == "P":
            query = query.filter(Result.result_status.in_(["P", "PASS"]))
        elif code == "F":
            query = query.filter(Result.result_status.in_(["F", "FAIL"]))
    if exam_year is not None:
        query = query.filter(Semester.exam_year == exam_year)
    if exam_month:
        query = query.filter(Semester.exam_month.ilike(exam_month))
    if subject_code:
        query = query.filter(Subject.subject_code == subject_code)

    results = query.offset(skip).limit(limit).all()
    
    return [{
        "id": r.id,
        "usn": r.student.usn,
        "student_name": r.student.student_name,
        "subject_code": r.subject.subject_code,
        "subject_name": r.subject.subject_name,
        "semester": r.semester.semester_number,
        "internal_marks": r.internal_marks,
        "external_marks": r.external_marks,
        "total_marks": r.total_marks,
            "result_status": normalize_result_status(r.result_status, to_output=True),  # Ensure this function is defined
        "announced_date": r.announced_date
    } for r in results]


# ==================== ANALYTICS ENDPOINTS ====================

@app.get("/analytics/subject-stats/{semester}")
async def get_subject_statistics(
    semester: int,
    batch: Optional[str] = None,
    branch: Optional[str] = None,
    exam_year: Optional[int] = Query(None, ge=2000, le=2100),
    exam_month: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get subject-wise statistics for a semester"""
    analyzer = ResultAnalyzer(db)
    stats = analyzer.get_subject_statistics(semester, batch=batch, branch=branch, exam_year=exam_year, exam_month=exam_month)
    return stats


@app.get("/analytics/student-summary/{usn}")
async def get_student_summary(usn: str, db: Session = Depends(get_db)):
    """Get semester-wise summary for a student"""
    analyzer = ResultAnalyzer(db)
    summary = analyzer.get_student_summary(usn)
    
    if not summary:
        raise HTTPException(status_code=404, detail="No results found for student")
    
    return summary


@app.get("/analytics/student-gpa/{usn}")
async def get_student_gpa(usn: str, db: Session = Depends(get_db)):
    """Get SGPA per semester and running CGPA for a student (CBCS)."""
    analyzer = ResultAnalyzer(db)
    data = analyzer.get_student_gpa_progression(usn)
    if not data:
        raise HTTPException(status_code=404, detail="No results found for student")
    return {"usn": usn, "gpa": data}


@app.get("/analytics/top-performers/{semester}")
async def get_top_performers(
    semester: int,
    subject_code: Optional[str] = None,
    batch: Optional[str] = None,
    branch: Optional[str] = None,
    exam_year: Optional[int] = Query(None, ge=2000, le=2100),
    exam_month: Optional[str] = None,
    rank_by: str = Query("marks", description="marks|sgpa"),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get top performing students"""
    analyzer = ResultAnalyzer(db)
    top_performers = analyzer.get_top_performers(
        semester,
        subject_code,
        limit,
        rank_by=rank_by,
        batch=batch,
        branch=branch,
        exam_year=exam_year,
        exam_month=exam_month,
    )
    return top_performers.to_dict('records')


@app.get("/analytics/failure-analysis/{semester}")
async def get_failure_analysis(
    semester: int,
    batch: Optional[str] = None,
    branch: Optional[str] = None,
    exam_year: Optional[int] = Query(None, ge=2000, le=2100),
    exam_month: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get failure analysis for a semester"""
    analyzer = ResultAnalyzer(db)
    analysis = analyzer.get_failure_analysis(semester, batch=batch, branch=branch, exam_year=exam_year, exam_month=exam_month)
    return analysis


@app.get("/analytics/semester-overview")
async def get_semester_overview(
    batch: Optional[str] = None,
    branch: Optional[str] = None,
    exam_year: Optional[int] = Query(None, ge=2000, le=2100),
    exam_month: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Dashboard helper: semester-wise aggregates (avg marks, pass rate, counts)."""
    analyzer = ResultAnalyzer(db)
    df = analyzer.get_results_dataframe(batch=batch, branch=branch, exam_year=exam_year, exam_month=exam_month)
    if df.empty:
        return []

    # Compute per-semester aggregates
    grouped = df.groupby("semester").agg(
        total_records=("usn", "count"),
        total_students=("usn", pd.Series.nunique),
        avg_total_marks=("total_marks", "mean"),
        pass_rate=("result_status", lambda x: float((x == "P").sum()) / float(len(x)) * 100.0 if len(x) else 0.0),
    ).reset_index()

    grouped["avg_total_marks"] = grouped["avg_total_marks"].round(2)
    grouped["pass_rate"] = grouped["pass_rate"].round(2)
    grouped = grouped.sort_values("semester")

    return [
        {
            "semester": int(r.semester),
            "total_records": int(r.total_records),
            "total_students": int(r.total_students),
            "avg_total_marks": float(r.avg_total_marks) if r.avg_total_marks is not None else 0.0,
            "pass_rate": float(r.pass_rate) if r.pass_rate is not None else 0.0,
        }
        for r in grouped.itertuples(index=False)
    ]


@app.get("/analytics/overall-statistics")
async def get_overall_statistics(
    batch: Optional[str] = None,
    branch: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get overall statistics across all results.

    Optional batch/branch filters enable batch-wise dashboards.
    """
    analyzer = ResultAnalyzer(db)
    stats = analyzer.get_overall_statistics(batch=batch, branch=branch)
    return stats


# ==================== EXPORT ENDPOINTS ====================

@app.get("/export/excel")
async def export_to_excel(
    semester: Optional[int] = None,
    batch: Optional[str] = None,
    branch: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Export results to Excel file"""
    try:
        normalized_batch = _validate_batch(batch)
        filename = f"results_sem{semester if semester else 'all'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        filepath = EXPORT_DIR / filename
        
        analyzer = ResultAnalyzer(db)
        analyzer.export_to_excel(str(filepath), semester=semester, batch=normalized_batch, branch=branch)
        
        return FileResponse(
            path=str(filepath),
            filename=filename,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/export/csv")
async def export_to_csv(
    semester: Optional[int] = None,
    batch: Optional[str] = None,
    branch: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Export results to CSV file"""
    try:
        normalized_batch = _validate_batch(batch)
        filename = f"results_sem{semester if semester else 'all'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        filepath = EXPORT_DIR / filename
        
        analyzer = ResultAnalyzer(db)
        analyzer.export_to_csv(str(filepath), semester=semester, batch=normalized_batch, branch=branch)
        
        return FileResponse(
            path=str(filepath),
            filename=filename,
            media_type='text/csv'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DELETE ENDPOINTS ====================

def _cleanup_orphans(db: Session) -> dict:
    """Delete orphaned Students/Subjects/Semesters (no Result rows remain).

    Returns counts for each entity deleted.
    """
    counts = {"students_deleted": 0, "subjects_deleted": 0, "semesters_deleted": 0}

    # Delete subjects with no results
    subject_ids_with_results = db.query(Result.subject_id).distinct().subquery()
    counts["subjects_deleted"] = (
        db.query(Subject)
        .filter(~Subject.id.in_(subject_ids_with_results))
        .delete(synchronize_session=False)
    )

    # Delete semesters with no results
    semester_ids_with_results = db.query(Result.semester_id).distinct().subquery()
    counts["semesters_deleted"] = (
        db.query(Semester)
        .filter(~Semester.id.in_(semester_ids_with_results))
        .delete(synchronize_session=False)
    )

    # Delete students with no results
    student_ids_with_results = db.query(Result.student_id).distinct().subquery()
    counts["students_deleted"] = (
        db.query(Student)
        .filter(~Student.id.in_(student_ids_with_results))
        .delete(synchronize_session=False)
    )

    return counts

@app.delete("/results/{result_id}")
async def delete_result(result_id: int, db: Session = Depends(get_db)):
    """Delete a specific result record"""
    try:
        result = db.query(Result).filter(Result.id == result_id).first()
        if not result:
            raise HTTPException(status_code=404, detail="Result not found")
        
        db.delete(result)
        db.commit()
        return {"message": "Result deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/students/{usn}")
async def delete_student(usn: str, db: Session = Depends(get_db)):
    """Delete a student and all their results (cascade delete)"""
    try:
        student = db.query(Student).filter(Student.usn == usn).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        db.delete(student)
        db.commit()
        return {"message": "Student and all associated results deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ADMIN PURGE ENDPOINTS ====================

@app.delete("/admin/purge/candidate/{usn}")
async def purge_candidate_records(
    usn: str,
    confirm: str = Query(..., description="Type DELETE to confirm"),
    batch: Optional[str] = Query(None, description="Optional batch filter (e.g., 2022-2026)"),
    cleanup_orphans: bool = Query(True),
    db: Session = Depends(get_db),
):
    """Delete all records for a candidate (USN).

    This deletes the Student row which cascades to Result rows.
    """
    if confirm.strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail="Confirmation required: confirm=DELETE")

    try:
        query = db.query(Student).filter(Student.usn == usn)
        if batch:
            query = query.filter(Student.batch == batch)
        
        student = query.first()
        if not student:
            detail = f"Student {usn} not found"
            if batch:
                detail += f" in batch {batch}"
            raise HTTPException(status_code=404, detail=detail)

        # Count results before deletion
        results_count = db.query(Result).filter(Result.student_id == student.id).count()
        db.delete(student)

        orphan_counts = {"students_deleted": 0, "subjects_deleted": 0, "semesters_deleted": 0}
        if cleanup_orphans:
            orphan_counts = _cleanup_orphans(db)

        db.commit()

        try:
            n = _create_notification(
                db,
                title=f"Admin purge: candidate {usn}",
                detail=f"Results deleted: {results_count}",
                level="warning",
            )
            await notification_manager.broadcast(
                {
                    "type": "notification",
                    "data": {
                        "id": n.id,
                        "title": n.title,
                        "detail": n.detail,
                        "level": n.level,
                        "created_at": n.created_at.isoformat() if n.created_at else None,
                    },
                }
            )
        except Exception:
            pass

        return {
            "message": "Candidate records deleted",
            "usn": usn,
            "results_deleted": results_count,
            **orphan_counts,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/purge/semester/{semester_number}")
async def purge_semester_records(
    semester_number: int,
    confirm: str = Query(..., description="Type DELETE to confirm"),
    batch: Optional[str] = Query(None, description="Optional batch filter (e.g., 2022-2026)"),
    exam_month: Optional[str] = Query(None, description="Optional exam month filter (e.g., December)"),
    exam_year: Optional[int] = Query(None, description="Optional exam year filter (e.g., 2024)"),
    cleanup_orphans: bool = Query(True),
    db: Session = Depends(get_db),
):
    """Delete all Result rows for a semester number.

    If batch/exam_month/exam_year are provided, only that subset is purged.
    """
    if confirm.strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail="Confirmation required: confirm=DELETE")

    try:
        # Build query for results to delete
        res_id_query = db.query(Result.id).join(Semester)
        res_id_query = res_id_query.filter(Semester.semester_number == semester_number)
        
        if exam_month:
            res_id_query = res_id_query.filter(Semester.exam_month == exam_month)
        if exam_year is not None:
            res_id_query = res_id_query.filter(Semester.exam_year == exam_year)
        
        if batch:
            res_id_query = res_id_query.join(Student).filter(Student.batch == batch)

        res_ids = [row[0] for row in res_id_query.all()]
        
        results_deleted = 0
        if res_ids:
            results_deleted = (
                db.query(Result)
                .filter(Result.id.in_(res_ids))
                .delete(synchronize_session=False)
            )

        orphan_counts = {"students_deleted": 0, "subjects_deleted": 0, "semesters_deleted": 0}
        if cleanup_orphans:
            orphan_counts = _cleanup_orphans(db)

        db.commit()

        try:
            n = _create_notification(
                db,
                title=f"Admin purge: semester {semester_number}",
                detail=f"Results deleted: {results_deleted}",
                level="warning",
            )
            await notification_manager.broadcast(
                {
                    "type": "notification",
                    "data": {
                        "id": n.id,
                        "title": n.title,
                        "detail": n.detail,
                        "level": n.level,
                        "created_at": n.created_at.isoformat() if n.created_at else None,
                    },
                }
            )
        except Exception:
            pass

        return {
            "message": "Semester records deleted",
            "semester_number": semester_number,
            "exam_month": exam_month,
            "exam_year": exam_year,
            "results_deleted": results_deleted,
            **orphan_counts,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/admin/purge/all")
async def purge_all_records(
    confirm: str = Query(..., description="Type DELETE_ALL to confirm"),
    batch: Optional[str] = Query(None, description="Optional batch filter (e.g., 2022-2026)"),
    db: Session = Depends(get_db),
):
    """Delete database records (students, subjects, semesters, results, upload logs)."""
    if confirm.strip().upper() != "DELETE_ALL":
        raise HTTPException(status_code=400, detail="Confirmation required: confirm=DELETE_ALL")

    try:
        if batch:
            # First, find student IDs in this batch
            student_ids = [
                row[0] for row in db.query(Student.id).filter(Student.batch == batch).all()
            ]
            
            results_deleted = 0
            students_deleted = 0
            
            if student_ids:
                # Delete results for these students (using IN clause, not join)
                results_deleted = (
                    db.query(Result)
                    .filter(Result.student_id.in_(student_ids))
                    .delete(synchronize_session=False)
                )
                # Delete the students themselves
                students_deleted = (
                    db.query(Student)
                    .filter(Student.id.in_(student_ids))
                    .delete(synchronize_session=False)
                )
            
            upload_logs_deleted = 0
            # Cleanup orphan subjects/semesters
            orphan_counts = _cleanup_orphans(db)
            db.commit()
            
            subjects_deleted = orphan_counts["subjects_deleted"]
            semesters_deleted = orphan_counts["semesters_deleted"]
            students_deleted_actual = orphan_counts["students_deleted"] + students_deleted
        else:
            results_deleted = db.query(Result).delete(synchronize_session=False)
            upload_logs_deleted = db.query(UploadLog).delete(synchronize_session=False)
            # Parents (no results remain, safe to delete everything)
            subjects_deleted = db.query(Subject).delete(synchronize_session=False)
            semesters_deleted = db.query(Semester).delete(synchronize_session=False)
            students_deleted_actual = db.query(Student).delete(synchronize_session=False)
            db.commit()

        try:
            n = _create_notification(
                db,
                title="Admin purge: " + (f"Batch {batch}" if batch else "ALL records") + " deleted",
                detail=f"Results: {results_deleted}, Students: {students_deleted_actual}, Subjects: {subjects_deleted}, Semesters: {semesters_deleted}",
                level="error",
            )
            await notification_manager.broadcast(
                {
                    "type": "notification",
                    "data": {
                        "id": n.id,
                        "title": n.title,
                        "detail": n.detail,
                        "level": n.level,
                        "created_at": n.created_at.isoformat() if n.created_at else None,
                    },
                }
            )
        except Exception:
            pass

        return {
            "message": f"Records deleted (Batch: {batch if batch else 'All'})",
            "results_deleted": results_deleted,
            "upload_logs_deleted": upload_logs_deleted,
            "subjects_deleted": subjects_deleted,
            "semesters_deleted": semesters_deleted,
            "students_deleted": students_deleted_actual,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/upload/batch/{batch_id}")
async def delete_batch(batch_id: str, db: Session = Depends(get_db)):
    """Delete all results from a specific batch upload"""
    try:
        # Verify batch exists (upload log)
        upload_log = db.query(UploadLog).filter(UploadLog.batch_id == batch_id).first()
        if not upload_log:
            raise HTTPException(status_code=404, detail="Batch not found")

        # Delete all results last written by this upload batch
        results_deleted = (
            db.query(Result)
            .filter(Result.upload_batch_id == batch_id)
            .delete(synchronize_session=False)
        )

        # Delete the upload log itself
        db.delete(upload_log)

        orphan_counts = _cleanup_orphans(db)
        db.commit()

        return {
            "message": f"Deleted batch {batch_id}",
            "results_deleted": int(results_deleted or 0),
            **orphan_counts,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== HELPER FUNCTIONS ====================

def _validate_batch(batch: Optional[str]) -> Optional[str]:
    if batch is None:
        return None

    normalized = str(batch).strip()
    if not normalized:
        return None

    # Expected format: YYYY-YYYY where end = start + 4 (UG 4-year batches)
    m = __import__("re").match(r"^(\d{4})-(\d{4})$", normalized)
    if not m:
        raise HTTPException(status_code=400, detail="Invalid batch format. Use YYYY-YYYY (e.g., 2022-2026)")

    start = int(m.group(1))
    end = int(m.group(2))
    if end != start + 4:
        raise HTTPException(status_code=400, detail="Invalid batch range. Expected a 4-year batch (e.g., 2022-2026)")

    return f"{start}-{end}"


def _extract_branch_from_usn(usn: Optional[str]) -> Optional[str]:
    """Extract branch code from VTU USN.

    Common format examples:
    - 1SV22AD005 -> AD
    - 1SV24AI037 -> AI
    """
    if not usn:
        return None
    val = str(usn).strip().upper()
    # College code (1 + 2-3 letters), 2-digit admission year, 2-3 letter branch, remaining digits
    m = __import__("re").match(r"^\d[A-Z]{2,3}\d{2}([A-Z]{2,3})\d{3,}$", val)
    if not m:
        return None
    return m.group(1)


def _create_notification(db: Session, title: str, detail: Optional[str] = None, level: str = "info") -> Notification:
    n = Notification(title=title, detail=detail, level=level, cleared=False)
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


def _normalize_subject_code(code: Optional[str]) -> Optional[str]:
    if code is None:
        return None
    val = str(code).strip().upper()
    if not val:
        return None
    # Keep only alphanumerics (VTU codes are typically A-Z0-9)
    val = __import__("re").sub(r"[^A-Z0-9]", "", val)
    return val or None


def _normalize_subject_name(name: Optional[str]) -> Optional[str]:
    if name is None:
        return None
    val = str(name).strip()
    if not val:
        return None
    # Collapse whitespace and strip odd separators
    val = __import__("re").sub(r"\s+", " ", val)
    return val.strip() or None


@app.get("/meta/branches")
async def get_branches(batch: Optional[str] = None, db: Session = Depends(get_db)):
    """Get distinct branch codes, optionally filtered by batch."""
    normalized_batch = _validate_batch(batch)
    q = db.query(Student.branch).filter(Student.branch.isnot(None)).filter(Student.branch != "")
    if normalized_batch:
        q = q.filter(Student.batch == normalized_batch)
    rows = q.distinct().order_by(Student.branch.asc()).all()
    return [r[0] for r in rows if r and r[0]]


@app.get("/meta/batches")
async def get_batches(db: Session = Depends(get_db)):
    """Get distinct batches present in the database.

    This is the source of truth for UI counts (e.g., 2022-2026 should be one batch).
    """
    q = db.query(Student.batch).filter(Student.batch.isnot(None)).filter(Student.batch != "")
    rows = q.distinct().order_by(Student.batch.asc()).all()
    batches = []
    for r in rows:
        if not r or not r[0]:
            continue
        val = _validate_batch(str(r[0]))
        if val:
            batches.append(val)
    # Deduplicate after normalization
    return sorted(set(batches))


@app.get("/meta/subjects")
async def get_subjects(db: Session = Depends(get_db)):
    """Get all distinct subjects (code and name)"""
    subjects = (
        db.query(Subject.subject_code, Subject.subject_name, Subject.credits)
        .order_by(Subject.subject_code.asc())
        .all()
    )
    return [{"code": s.subject_code, "name": s.subject_name, "credits": s.credits} for s in subjects]


@app.put("/meta/subjects/credits")
async def update_subject_credits(
    items: List[dict] = Body(...),
    db: Session = Depends(get_db),
):
    """Bulk update credits for subjects.

    Body: [{"code": "BMATS101", "credits": 4}, ...]
    Credits can be 0 to exclude a subject from GPA calculations.
    """
    updated = 0
    missing: List[str] = []
    invalid: List[str] = []

    for item in items or []:
        code = str(item.get("code") or "").strip()
        if not code:
            continue

        credits_raw = item.get("credits", None)
        if credits_raw is None or credits_raw == "":
            credits = None
        else:
            try:
                credits = int(credits_raw)
            except Exception:
                invalid.append(code)
                continue
            if credits < 0 or credits > 50:
                invalid.append(code)
                continue

        s = db.query(Subject).filter(Subject.subject_code == code).first()
        if not s:
            missing.append(code)
            continue

        s.credits = credits
        updated += 1

    db.commit()
    return {"updated": updated, "missing": missing, "invalid": invalid}


@app.get("/notifications")
async def list_notifications(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    rows = (
        db.query(Notification)
        .filter(Notification.cleared.is_(False))
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "detail": n.detail,
            "level": n.level,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in rows
    ]


@app.delete("/notifications/clear")
async def clear_notifications(confirm: Optional[str] = None, db: Session = Depends(get_db)):
    if (confirm or "").strip().upper() != "CLEAR_ALL":
        raise HTTPException(status_code=400, detail="Type confirm=CLEAR_ALL to clear notifications")
    updated = (
        db.query(Notification)
        .filter(Notification.cleared.is_(False))
        .update({Notification.cleared: True}, synchronize_session=False)
    )
    db.commit()
    return {"message": "Notifications cleared", "cleared": int(updated or 0)}


@app.delete("/notifications/{notification_id}")
async def clear_notification(notification_id: int, db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")

    if n.cleared:
        return {"message": "Notification already cleared", "id": notification_id}

    n.cleared = True
    db.commit()
    try:
        await notification_manager.broadcast({"type": "notification_cleared", "id": notification_id})
    except Exception:
        pass
    return {"message": "Notification cleared", "id": notification_id}


def save_extracted_data(
    db: Session,
    data: ExtractedStudentResult,
    batch: Optional[str] = None,
    upload_batch_id: Optional[str] = None,
) -> dict:
    """Save extracted PDF data to database"""
    try:
        normalized_batch = _validate_batch(batch)
        extracted_branch = _extract_branch_from_usn(getattr(data, "usn", None))
        # Get or create student
        student = db.query(Student).filter(Student.usn == data.usn).first()
        if not student:
            student = Student(
                usn=data.usn,
                student_name=data.student_name,
                batch=normalized_batch,
                branch=extracted_branch,
            )
            db.add(student)
            db.flush()
        else:
            # Keep name updated (PDF is source of truth)
            if data.student_name and student.student_name != data.student_name:
                student.student_name = data.student_name
            # Keep existing batch unless it's missing and caller provided one.
            if normalized_batch and not getattr(student, "batch", None):
                student.batch = normalized_batch
            # Backfill branch if missing
            if extracted_branch and not getattr(student, "branch", None):
                student.branch = extracted_branch

        # Get or create semester
        semester = db.query(Semester).filter(
            Semester.semester_number == data.semester,
            Semester.exam_month == data.exam_month,
            Semester.exam_year == data.exam_year
        ).first()
        
        if not semester:
            semester = Semester(
                semester_number=data.semester,
                exam_month=data.exam_month,
                exam_year=data.exam_year
            )
            db.add(semester)
            db.flush()

        # Process each subject
        for subject_data in data.subjects:
            # Normalize subject code/name defensively (protect DB from extraction quirks)
            raw_code = str(getattr(subject_data, "subject_code", "") or "").strip().upper()
            raw_code = __import__("re").sub(r"[^A-Z0-9]", "", raw_code)

            if not raw_code:
                continue

            raw_name = str(getattr(subject_data, "subject_name", "") or "").strip()
            raw_name = __import__("re").sub(r"\s+", " ", raw_name)

            # Repair common extraction glitch: one stray leading letter glued to a common title word
            # e.g., "DINTRODUCTION TO ..." -> "INTRODUCTION TO ..."
            if len(raw_name) >= 10 and __import__("re").match(
                r"^[A-Z](INTRODUCTION|PRINCIPLES|FUNDAMENTALS|ENGINEERING|MATHEMATICS|PHYSICS|CHEMISTRY|PROGRAMMING|COMPUTER|DIGITAL|DATA|DESIGN|ANALYSIS|NETWORKS|SYSTEMS|ELECTRONICS)",
                raw_name,
                __import__("re").IGNORECASE,
            ):
                raw_name = raw_name[1:].lstrip()

            if not raw_name:
                raw_name = raw_code

            # Get or create subject
            subject = db.query(Subject).filter(Subject.subject_code == raw_code).first()

            # If code looks like it accidentally ate the first letter of the subject name,
            # try matching without a trailing letter.
            if subject is None and len(raw_code) > 1 and raw_code[-1].isalpha():
                alt_code = raw_code[:-1]
                alt_subject = db.query(Subject).filter(Subject.subject_code == alt_code).first()
                if alt_subject is not None:
                    subject = alt_subject
                    raw_code = alt_code

            if not subject:
                subject = Subject(
                    subject_code=raw_code,
                    subject_name=raw_name
                )
                db.add(subject)
                db.flush()

            # Create or update result
            result = db.query(Result).filter(
                Result.student_id == student.id,
                Result.semester_id == semester.id,
                Result.subject_id == subject.id
            ).first()

            if not result:
                result = Result(
                    student_id=student.id,
                    semester_id=semester.id,
                    subject_id=subject.id
                )
                db.add(result)

            # Update result data
            result.internal_marks = subject_data.internal_marks
            result.external_marks = subject_data.external_marks
            result.total_marks = subject_data.total_marks
            if upload_batch_id:
                result.upload_batch_id = upload_batch_id
            # Normalize result status to single-letter codes stored as strings
            result.result_status = normalize_result_status(subject_data.result_status)
            
            # Parse date
            if subject_data.announced_date:
                try:
                    result.announced_date = datetime.strptime(subject_data.announced_date, '%Y-%m-%d').date()
                except:
                    pass

        db.commit()
        
        return {
            "student_id": student.id,
            "semester_id": semester.id,
            "subjects_processed": len(data.subjects)
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error processing file: {str(e)}")
        raise


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", 8000)),
        reload=os.getenv("API_RELOAD", "True") == "True"
    )
