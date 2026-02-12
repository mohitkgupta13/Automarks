"""
SQLAlchemy ORM Models — PostgreSQL
"""
import enum

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Date,
    Text,
    Boolean,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UploadStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    usn = Column(String(20), unique=True, nullable=False, index=True)
    student_name = Column(String(255), nullable=False, index=True)
    # Cohort/batch selection in UI (e.g. "2022-2026")
    batch = Column(String(9), index=True, nullable=True)
    # Branch extracted from USN (e.g. "1SV22AD005" -> "AD")
    branch = Column(String(10), index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    results = relationship("Result", back_populates="student", cascade="all, delete-orphan")


class Semester(Base):
    __tablename__ = "semesters"
    __table_args__ = (
        UniqueConstraint("semester_number", "exam_month", "exam_year", name="uq_semester_term"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    semester_number = Column(Integer, nullable=False, index=True)
    exam_month = Column(String(50))
    exam_year = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    results = relationship("Result", back_populates="semester", cascade="all, delete-orphan")


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    subject_code = Column(String(20), unique=True, nullable=False, index=True)
    subject_name = Column(String(500), nullable=False)
    # CBCS credit value for GPA calculations. Use 0 for mandatory non-credit courses.
    credits = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    results = relationship("Result", back_populates="subject", cascade="all, delete-orphan")


class Result(Base):
    __tablename__ = "results"
    __table_args__ = (
        UniqueConstraint("student_id", "semester_id", "subject_id", name="uq_result_student_sem_subject"),
        CheckConstraint("internal_marks IS NULL OR (internal_marks >= 0 AND internal_marks <= 50)", name="ck_internal_marks_range"),
        CheckConstraint("external_marks IS NULL OR (external_marks >= 0 AND external_marks <= 100)", name="ck_external_marks_range"),
        CheckConstraint("total_marks IS NULL OR (total_marks >= 0 AND total_marks <= 200)", name="ck_total_marks_range"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    internal_marks = Column(Integer)
    external_marks = Column(Integer)
    total_marks = Column(Integer)
    # UUID for the upload batch that last wrote this row (used for batch-level deletes/auditing)
    upload_batch_id = Column(String(50), index=True, nullable=True)
    # Store single-letter/short codes (P/F/A/W/X/NE)
    result_status = Column(String(4), index=True)
    announced_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    student = relationship("Student", back_populates="results")
    semester = relationship("Semester", back_populates="results")
    subject = relationship("Subject", back_populates="results")


class UploadLog(Base):
    __tablename__ = "upload_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(String(50), unique=True, nullable=False, index=True)
    total_files = Column(Integer, default=0)
    processed_files = Column(Integer, default=0)
    failed_files = Column(Integer, default=0)
    current_file = Column(String(255), nullable=True)  # Currently processing file
    current_file_index = Column(Integer, default=0)  # Index of current file
    # Using String instead of DB-level ENUM for cross-database portability
    status = Column(String(20), default=UploadStatus.PENDING.value, index=True)
    error_log = Column(Text)
    upload_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    completed_timestamp = Column(DateTime(timezone=True))


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    # Short, human-friendly title
    title = Column(String(255), nullable=False)
    # Optional detail payload for debugging / UI display
    detail = Column(Text, nullable=True)
    # info | success | warning | error
    level = Column(String(20), nullable=False, index=True, default="info")
    cleared = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
