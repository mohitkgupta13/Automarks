"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


class ResultStatusEnum(str, Enum):
    PASS = "P"
    FAIL = "F"
    ABSENT = "A"
    WITHHELD = "W"
    NOT_ELIGIBLE_X = "X"
    NOT_ELIGIBLE_NE = "NE"


class UploadStatusEnum(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# Subject Schemas
class SubjectBase(BaseModel):
    subject_code: str = Field(..., max_length=20)
    subject_name: str = Field(..., max_length=500)


class SubjectCreate(SubjectBase):
    pass


class SubjectResponse(SubjectBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Student Schemas
class StudentBase(BaseModel):
    usn: str = Field(..., max_length=20)
    student_name: str = Field(..., max_length=255)
    batch: Optional[str] = Field(None, max_length=9)
    branch: Optional[str] = Field(None, max_length=10)


class StudentCreate(StudentBase):
    pass


class StudentResponse(StudentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Semester Schemas
class SemesterBase(BaseModel):
    semester_number: int = Field(..., ge=1, le=8)
    exam_month: Optional[str] = Field(None, max_length=50)
    exam_year: Optional[int] = Field(None, ge=2000, le=2100)


class SemesterCreate(SemesterBase):
    pass


class SemesterResponse(SemesterBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Result Schemas
class ResultBase(BaseModel):
    internal_marks: Optional[int] = Field(None, ge=0, le=100)
    external_marks: Optional[int] = Field(None, ge=0, le=100)
    total_marks: Optional[int] = Field(None, ge=0, le=200)
    result_status: Optional[ResultStatusEnum] = None
    announced_date: Optional[date] = None


class ResultCreate(ResultBase):
    student_id: int
    semester_id: int
    subject_id: int


class ResultResponse(ResultBase):
    id: int
    student_id: int
    semester_id: int
    subject_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ResultDetail(ResultBase):
    id: int
    student: StudentResponse
    semester: SemesterResponse
    subject: SubjectResponse
    created_at: datetime

    class Config:
        from_attributes = True


# Extracted Result Schema (from PDF)
class ExtractedSubjectResult(BaseModel):
    subject_code: str
    subject_name: str
    internal_marks: Optional[int] = None
    external_marks: Optional[int] = None
    total_marks: Optional[int] = None
    result_status: Optional[str] = None
    announced_date: Optional[str] = None


class ExtractedStudentResult(BaseModel):
    usn: str
    student_name: str
    semester: int
    exam_month: Optional[str] = None
    exam_year: Optional[int] = None
    subjects: List[ExtractedSubjectResult]


# Upload Log Schemas
class UploadLogCreate(BaseModel):
    batch_id: str
    total_files: int


class UploadLogResponse(BaseModel):
    id: int
    batch_id: str
    total_files: int
    processed_files: int
    failed_files: int
    status: UploadStatusEnum
    error_log: Optional[str] = None
    upload_timestamp: datetime
    completed_timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True


# Analytics Schemas
class SubjectStatistics(BaseModel):
    subject_code: str
    subject_name: str
    total_students: int
    avg_internal: Optional[float] = None
    avg_external: Optional[float] = None
    avg_total: Optional[float] = None
    max_marks: Optional[int] = None
    min_marks: Optional[int] = None
    pass_count: int
    fail_count: int
    pass_percentage: Optional[float] = None


class SemesterSummary(BaseModel):
    usn: str
    student_name: str
    semester_number: int
    exam_month: Optional[str] = None
    exam_year: Optional[int] = None
    total_subjects: int
    subjects_passed: int
    subjects_failed: int
    average_marks: Optional[float] = None
    highest_marks: Optional[int] = None
    lowest_marks: Optional[int] = None


# API Response Schemas
class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class BatchUploadResponse(BaseModel):
    batch_id: str
    total_files: int
    processed: int
    failed: int
    errors: List[str] = []
