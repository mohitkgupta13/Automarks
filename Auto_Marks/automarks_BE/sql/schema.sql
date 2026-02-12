-- VTU Results Database Schema
-- PostgreSQL Database Schema for VTU Student Results Management System
-- Run this script in psql terminal to set up the database

-- INSTRUCTIONS TO RUN IN TERMINAL:
-- 1. Open Terminal
-- 2. Connect to PostgreSQL: psql -U postgres
-- 3. Enter your PostgreSQL password when prompted
-- 4. Create database: CREATE DATABASE vtu_results;
-- 5. Connect to database: \c vtu_results
-- 6. Run this file: \i sql/schema.sql
-- 7. Verify: \dt
-- 8. Exit: \q

-- Drop existing views first (depends on tables)
DROP VIEW IF EXISTS vw_subject_statistics;
DROP VIEW IF EXISTS vw_semester_summary;
DROP VIEW IF EXISTS vw_student_results;

-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS semesters CASCADE;
DROP TABLE IF EXISTS upload_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

-- Create Students table
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    usn VARCHAR(20) UNIQUE NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    batch VARCHAR(9),
    branch VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_students_usn ON students (usn);
CREATE INDEX idx_students_student_name ON students (student_name);
CREATE INDEX idx_students_batch ON students (batch);
CREATE INDEX idx_students_branch ON students (branch);

-- Create Semesters table
CREATE TABLE semesters (
    id SERIAL PRIMARY KEY,
    semester_number INT NOT NULL,
    exam_month VARCHAR(50),
    exam_year INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (semester_number, exam_month, exam_year)
);

CREATE INDEX idx_semesters_semester_number ON semesters (semester_number);

-- Create Subjects table
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    subject_code VARCHAR(20) UNIQUE NOT NULL,
    subject_name VARCHAR(500) NOT NULL,
    credits INT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subjects_subject_code ON subjects (subject_code);

-- Create Results table
CREATE TABLE results (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    semester_id INT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    internal_marks INT DEFAULT NULL,
    external_marks INT DEFAULT NULL,
    total_marks INT DEFAULT NULL,
    upload_batch_id VARCHAR(50) DEFAULT NULL,
    result_status VARCHAR(4) DEFAULT NULL,
    announced_date DATE DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, semester_id, subject_id),
    CONSTRAINT ck_internal_marks_range CHECK (internal_marks IS NULL OR (internal_marks >= 0 AND internal_marks <= 50)),
    CONSTRAINT ck_external_marks_range CHECK (external_marks IS NULL OR (external_marks >= 0 AND external_marks <= 100)),
    CONSTRAINT ck_total_marks_range CHECK (total_marks IS NULL OR (total_marks >= 0 AND total_marks <= 200))
);

CREATE INDEX idx_results_student_id ON results (student_id);
CREATE INDEX idx_results_semester_id ON results (semester_id);
CREATE INDEX idx_results_subject_id ON results (subject_id);
CREATE INDEX idx_results_result_status ON results (result_status);
CREATE INDEX idx_results_upload_batch_id ON results (upload_batch_id);

-- Create Upload Logs table (to track batch uploads)
CREATE TABLE upload_logs (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(50) UNIQUE NOT NULL,
    total_files INT DEFAULT 0,
    processed_files INT DEFAULT 0,
    failed_files INT DEFAULT 0,
    current_file VARCHAR(255) DEFAULT NULL,
    current_file_index INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    error_log TEXT,
    upload_timestamp TIMESTAMPTZ DEFAULT NOW(),
    completed_timestamp TIMESTAMPTZ
);

CREATE INDEX idx_upload_logs_batch_id ON upload_logs (batch_id);
CREATE INDEX idx_upload_logs_status ON upload_logs (status);

-- Create Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    detail TEXT DEFAULT NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    cleared BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_level ON notifications (level);
CREATE INDEX idx_notifications_cleared ON notifications (cleared);
CREATE INDEX idx_notifications_created_at ON notifications (created_at);

-- ============================================
-- Auto-update updated_at trigger (PostgreSQL)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_results_updated_at
    BEFORE UPDATE ON results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Views
-- ============================================

-- Create a view for easy result retrieval with all details
CREATE VIEW vw_student_results AS
SELECT
    st.usn,
    st.student_name,
    sem.semester_number,
    sem.exam_month,
    sem.exam_year,
    sub.subject_code,
    sub.subject_name,
    r.internal_marks,
    r.external_marks,
    r.total_marks,
    r.result_status,
    r.announced_date,
    r.created_at as result_created_at
FROM results r
JOIN students st ON r.student_id = st.id
JOIN semesters sem ON r.semester_id = sem.id
JOIN subjects sub ON r.subject_id = sub.id;

-- Create a view for semester-wise performance summary
CREATE VIEW vw_semester_summary AS
SELECT
    st.usn,
    st.student_name,
    sem.semester_number,
    sem.exam_month,
    sem.exam_year,
    COUNT(DISTINCT r.subject_id) as total_subjects,
    SUM(CASE WHEN r.result_status = 'P' THEN 1 ELSE 0 END) as subjects_passed,
    SUM(CASE WHEN r.result_status = 'F' THEN 1 ELSE 0 END) as subjects_failed,
    AVG(r.total_marks) as average_marks,
    MAX(r.total_marks) as highest_marks,
    MIN(r.total_marks) as lowest_marks
FROM results r
JOIN students st ON r.student_id = st.id
JOIN semesters sem ON r.semester_id = sem.id
GROUP BY st.id, sem.id, st.usn, st.student_name, sem.semester_number, sem.exam_month, sem.exam_year;

-- Create a view for subject-wise statistics
CREATE VIEW vw_subject_statistics AS
SELECT
    sem.semester_number,
    sub.subject_code,
    sub.subject_name,
    COUNT(r.id) as total_students,
    AVG(r.internal_marks) as avg_internal,
    AVG(r.external_marks) as avg_external,
    AVG(r.total_marks) as avg_total,
    MAX(r.total_marks) as max_marks,
    MIN(r.total_marks) as min_marks,
    SUM(CASE WHEN r.result_status = 'P' THEN 1 ELSE 0 END) as pass_count,
    SUM(CASE WHEN r.result_status = 'F' THEN 1 ELSE 0 END) as fail_count,
    ROUND((SUM(CASE WHEN r.result_status = 'P' THEN 1 ELSE 0 END) * 100.0 / COUNT(r.id)), 2) as pass_percentage
FROM results r
JOIN subjects sub ON r.subject_id = sub.id
JOIN semesters sem ON r.semester_id = sem.id
GROUP BY sem.semester_number, sub.id, sub.subject_code, sub.subject_name;

-- Sample queries for reference

-- Query 1: Get all results for a specific student
-- SELECT * FROM vw_student_results WHERE usn = '1SV22AD005';

-- Query 2: Get semester summary for a student
-- SELECT * FROM vw_semester_summary WHERE usn = '1SV22AD005' ORDER BY semester_number;

-- Query 3: Get subject-wise statistics for a semester
-- SELECT * FROM vw_subject_statistics WHERE semester_number = 5 ORDER BY subject_code;

-- Query 4: Find students who failed in any subject
-- SELECT DISTINCT usn, student_name FROM vw_student_results WHERE result_status = 'F';

-- Query 5: Get top performers in a subject
-- SELECT usn, student_name, total_marks
-- FROM vw_student_results
-- WHERE subject_code = 'BCS501'
-- ORDER BY total_marks DESC LIMIT 10;
