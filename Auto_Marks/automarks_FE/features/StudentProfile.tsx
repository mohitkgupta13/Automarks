
import React, { useState } from 'react';
import {
  UserCircle,
  Search,
  BookOpen,
  Award,
  GraduationCap,
  TrendingUp,
  AlertCircle,
  Download,
  User,
  PieChart as PieIcon,
  ChevronRight,
  X
} from 'lucide-react';
import { endpoints } from '@/api/client';
import { StudentSummary, Student, Result, StudentGpaProgression } from '@/types';
import { formatOrdinal } from '@/utils/ordinal';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

const StudentProfile: React.FC = () => {
  const [usn, setUsn] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [semesterResults, setSemesterResults] = useState<Result[]>([]);
  const [gpa, setGpa] = useState<StudentGpaProgression | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usn) return;
    setIsLoading(true);
    setError(null);
    try {
      const studentData = await endpoints.getStudentByUsn(usn);
      const summaryData = await endpoints.getStudentSummary(usn);
      const gpaData = await endpoints.getStudentGpa(usn).catch(() => null);
      const latestSemester = summaryData.semesters.length
        ? summaryData.semesters[summaryData.semesters.length - 1].semester
        : undefined;
      setStudent({ ...studentData, current_semester: latestSemester });
      setSummary(summaryData);
      setGpa(gpaData);
    } catch (err: any) {
      setError("Student profile not found. Check the USN and try again.");
      setStudent(null);
      setSummary(null);
      setGpa(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewSubjects = async (semester: number) => {
    if (!student) return;
    setIsLoading(true);
    try {
      const results = await endpoints.getResults({ usn: student.usn, semester });
      setSemesterResults(results);
      setSelectedSemester(semester);
    } catch (err) {
      console.error('Failed to fetch semester results:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const closeSubjectsModal = () => {
    setSelectedSemester(null);
    setSemesterResults([]);
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Student Profile</h2>
          <p className="text-slate-500 font-medium">Deep dive into individual student academic trajectory.</p>
        </div>

        <form onSubmit={handleSearch} className="max-w-2xl flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Enter Student USN ( eg : 1SV22AD005 )"
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold"
              value={usn}
              onChange={(e) => setUsn(e.target.value.toUpperCase())}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95"
          >
            {isLoading ? 'Searching...' : 'Explore'}
          </button>
        </form>
      </div>

      {error && (
        <div className="glass-card p-10 text-center rounded-[2.5rem]">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="text-rose-500" size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">{error}</h3>
          <p className="text-slate-500 max-w-sm mx-auto">Make sure the USN is correctly entered with branch and year code.</p>
        </div>
      )}

      {student && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-8">
            <div className="glass-card rounded-[2.5rem] p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
              <img
                src="/student-avatar.svg"
                alt="Student"
                className="w-32 h-32 rounded-3xl mx-auto mb-6 border-4 border-white shadow-xl relative z-10"
              />
              <h3 className="text-2xl font-black text-slate-900">{student.student_name}</h3>
              <p className="text-indigo-600 font-bold mb-6">{student.usn}</p>

              <div className="space-y-4 text-left border-t border-slate-100 pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                    <Award size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Overall Average</p>
                    <p className="text-lg font-black text-slate-900 mt-1">{summary.overall_avg.toFixed(2)}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Active Semester</p>
                    <p className="text-lg font-black text-slate-900 mt-1">{student.current_semester ? `${formatOrdinal(student.current_semester)} Semester` : 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8">
              <h4 className="text-lg font-black text-slate-900 mb-6">Quick Stats</h4>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-bold text-slate-600">Completion Rate</span>
                    <span className="text-sm font-black text-indigo-600">
                      {summary ? Math.round((summary.semesters.filter(s => s.passed_count + s.failed_count > 0).length / summary.semesters.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${summary ? Math.round((summary.semesters.filter(s => s.passed_count + s.failed_count > 0).length / summary.semesters.length) * 100) : 0}%` }}></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Total Pass</p>
                    <p className="text-xl font-black text-slate-900">
                      {summary ? summary.semesters.reduce((sum, s) => sum + s.passed_count, 0) : 0}
                    </p>
                  </div>
                  <div className="p-4 bg-rose-50 rounded-2xl">
                    <p className="text-[10px] font-bold text-rose-600 uppercase mb-1">Arrears</p>
                    <p className="text-xl font-black text-slate-900">
                      {summary ? summary.semesters.reduce((sum, s) => sum + s.failed_count, 0) : 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {gpa?.gpa?.length ? (
              <div className="glass-card rounded-[2.5rem] p-8">
                <h4 className="text-lg font-black text-slate-900 mb-6">SGPA / CGPA Trend</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={gpa.gpa} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="semester" tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis tickLine={false} axisLine={false} domain={[0, 10]} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="sgpa" stroke="#4f46e5" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="cgpa" stroke="#0f172a" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">SGPA (indigo) • CGPA (slate)</p>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">Credits default to 4 until you configure per subject.</p>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-2 space-y-8">
            <h4 className="text-xl font-black text-slate-900 flex items-center gap-3">
              <PieIcon size={24} className="text-indigo-600" /> Academic Summaries
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {summary.semesters.map((sem) => (
                <div key={sem.semester} className="glass-card p-6 rounded-3xl group hover:shadow-lg transition-all border-l-4 border-indigo-500">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl">
                      {sem.semester}
                    </div>
                    <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500">Semester {sem.semester}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average</p>
                      <p className="text-xl font-black text-slate-900">{sem.avg.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hi/Lo</p>
                      <p className="text-xl font-black text-slate-900">{sem.highest}/{sem.lowest}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Passed</p>
                      <p className="text-lg font-black text-emerald-600">{sem.passed_count}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Failed</p>
                      <p className="text-lg font-black text-rose-600">{sem.failed_count}</p>
                    </div>
                  </div>
                  <button className="mt-6 w-full py-3 bg-slate-50 text-slate-500 rounded-xl font-bold text-sm hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2 group-hover:bg-indigo-600 group-hover:text-white"
                    onClick={() => handleViewSubjects(sem.semester)}
                  >
                    View Subjects <ChevronRight size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!student && !isLoading && !error && (
        <div className="glass-card p-20 text-center rounded-[3rem] border-2 border-dashed border-slate-200 bg-slate-50/50">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
            <Search size={40} className="text-slate-300" />
          </div>
          <h3 className="text-2xl font-black text-slate-400">Search to view profile</h3>
          <p className="text-slate-400 mt-2 max-w-xs mx-auto">Enter a valid USN to see detailed performance metrics and history.</p>
        </div>
      )}

      {selectedSemester !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Semester {selectedSemester} Subjects</h3>
                <p className="text-slate-500 font-medium mt-1">{student?.student_name} ({student?.usn})</p>
              </div>
              <button
                onClick={closeSubjectsModal}
                className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
              >
                <X size={20} className="text-slate-600" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-8">
              <div className="space-y-4">
                {semesterResults.map((result) => (
                  <div key={result.id} className="glass-card p-6 rounded-2xl hover:shadow-lg transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="font-black text-slate-900 text-lg">{result.subject_code}</h4>
                        <p className="text-slate-500 font-medium text-sm mt-1">{result.subject_name}</p>
                      </div>
                      <span className={`px-4 py-2 rounded-xl text-xs font-black ${result.result_status === 'P' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                        {result.result_status === 'P' ? 'PASS' : 'FAIL'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-slate-50 rounded-xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Internal</p>
                        <p className="text-2xl font-black text-slate-900">{result.internal_marks}</p>
                      </div>
                      <div className="text-center p-4 bg-slate-50 rounded-xl">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">External</p>
                        <p className="text-2xl font-black text-slate-900">{result.external_marks}</p>
                      </div>
                      <div className="text-center p-4 bg-indigo-50 rounded-xl">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Total</p>
                        <p className="text-2xl font-black text-indigo-600">{result.total_marks}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {semesterResults.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-bold">No subjects found for this semester</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentProfile;
