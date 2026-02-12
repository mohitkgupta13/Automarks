export interface Student {
  id: number;
  usn: string;
  student_name: string;
  current_semester?: number;
}

export interface Result {
  id: number;
  usn: string;
  student_name: string;
  semester: number;
  subject_code: string;
  subject_name: string;
  internal_marks?: number;
  external_marks?: number;
  total_marks?: number;
  result_status?: 'P' | 'F' | 'A' | 'W' | 'X' | 'NE';
  announced_date?: string;
}

export interface BatchStatus {
  batch_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_files: number;
  processed_files: number;
  failed_files: number;
  errors?: string[];
}

export interface SubjectStats {
  subject_code: string;
  subject_name: string;
  avg_total?: number;
  avg_internal?: number;
  avg_external?: number;
  max_marks?: number;
  min_marks?: number;
  pass_count?: number;
  fail_count?: number;
  pass_percentage?: number;
  total_students: number;
}

export interface SemesterSummary {
  semester: number;
  avg: number;
  highest: number;
  lowest: number;
  passed_count: number;
  failed_count: number;
  total_subjects: number;
  exam_month?: string;
  exam_year?: number;
}

export interface StudentSummary {
  usn: string;
  student_name: string;
  semesters: SemesterSummary[];
  overall_avg: number;
}

export interface FailureAnalysis {
  total_results: number;
  total_failures: number;
  failure_rate: number;
  subject_wise_failures: Array<{
    subject_code: string;
    count: number;
  }>;
  students_with_failures: string[];
}

export interface TopPerformer {
  usn: string;
  student_name: string;
  total_marks: number;
  subject_code?: string;
  subject_name?: string;
  result_status?: string;
  percentage?: number;
  sgpa?: number;
  total_credits?: number;
}

export interface StudentGpaProgression {
  usn: string;
  gpa: Array<{ semester: number; total_credits: number; sgpa: number; cgpa: number }>;
}
