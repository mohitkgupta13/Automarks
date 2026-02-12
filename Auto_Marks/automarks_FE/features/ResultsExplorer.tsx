
import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Download,
  WifiOff,
  RefreshCcw,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { endpoints, getApiBase } from '@/api/client';
import { Result } from '@/types';
import { getBatchOptions } from '@/utils/batches';

const ResultsExplorer: React.FC = () => {
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<Array<{ code: string; name: string }>>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [filters, setFilters] = useState({
    usn: '',
    semester: undefined as number | undefined,
    batch: undefined as string | undefined,
    branch: undefined as string | undefined,
    subject_code: '',
    skip: 0,
    limit: 15
  });

  const statusParam = statusFilter === 'all' ? undefined : statusFilter;

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await endpoints.getResults({ ...filters, status: statusParam });
      setResults(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred while fetching results.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters.skip, filters.limit, statusFilter]);

  useEffect(() => {
    // Refresh branch options when batch changes
    endpoints
      .getBranches(filters.batch)
      .then((res) => setBranches(res || []))
      .catch(() => setBranches([]));
    // Reset branch filter if batch changes
    setFilters((f) => ({ ...f, branch: undefined }));
  }, [filters.batch]);

  useEffect(() => {
    endpoints
      .getSubjects()
      .then((res) => setSubjects(res || []))
      .catch(() => setSubjects([]));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, skip: 0 }));
    fetchData();
  };

  const handleDelete = async (resultId: number) => {
    if (!confirm('Are you sure you want to delete this result? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await endpoints.deleteResult(resultId);
      // Remove the deleted result from the local state
      setResults(prev => prev.filter(r => r.id !== resultId));
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert('Failed to delete result. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Results Explorer</h2>
          <p className="text-slate-500 font-medium">Browse and filter granular result data for all students.</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 transition-all">
          <Download size={18} /> Export Current View
        </button>
      </div>

      <div className="glass-card p-4 rounded-[2rem] shadow-sm border border-slate-100 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-2.5">
          {/* USN */}
          <div className="min-w-[130px] flex-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 block px-1">USN</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="1SV22AD005"
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-slate-900 placeholder:text-slate-300 font-bold shadow-sm"
                value={filters.usn}
                onChange={(e) => setFilters(f => ({ ...f, usn: e.target.value.toUpperCase() }))}
              />
            </div>
          </div>

          {/* Subject Filter */}
          <div className="min-w-[180px] flex-[1.5]">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 block px-1">Course</label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700 truncate shadow-sm cursor-pointer"
                value={filters.subject_code || ''}
                onChange={(e) => setFilters(f => ({ ...f, subject_code: e.target.value }))}
              >
                <option value="">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Semester Filter */}
          <div className="min-w-[70px] flex-none">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 block px-1">Sem</label>
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select
                className="w-full pl-7 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700 shadow-sm cursor-pointer"
                value={filters.semester || ''}
                onChange={(e) => setFilters(f => ({ ...f, semester: e.target.value ? parseInt(e.target.value) : undefined }))}
              >
                <option value="">All</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Status Filter */}
          <div className="min-w-[90px] flex-none">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 block px-1">Status</label>
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select
                className="w-full pl-7 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700 shadow-sm cursor-pointer"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'all' | 'pass' | 'fail');
                  setFilters((f) => ({ ...f, skip: 0 }));
                }}
              >
                <option value="all">Any</option>
                <option value="pass">P</option>
                <option value="fail">F</option>
              </select>
            </div>
          </div>

          {/* Batch Filter */}
          <div className="min-w-[110px] flex-none">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 block px-1">Batch</label>
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select
                className="w-full pl-7 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700 shadow-sm cursor-pointer"
                value={filters.batch || ''}
                onChange={(e) => setFilters((f) => ({ ...f, batch: e.target.value ? e.target.value : undefined }))}
              >
                <option value="">All</option>
                {getBatchOptions().map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Branch Filter */}
          <div className="min-w-[100px] flex-none">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 block px-1">Branch</label>
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select
                className="w-full pl-7 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-700 shadow-sm cursor-pointer"
                value={filters.branch || ''}
                onChange={(e) => setFilters((f) => ({ ...f, branch: e.target.value ? e.target.value : undefined }))}
              >
                <option value="">All</option>
                {branches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="bg-slate-900 text-white px-5 py-2 rounded-xl font-black shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] text-xs">
            Sync Records
          </button>
        </form>
      </div>

      <div className="glass-card rounded-[2rem] overflow-hidden shadow-sm min-h-[400px] flex flex-col">
        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-6">
              <WifiOff size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Connection Failure</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium">
              We couldn't reach the API at <code className="bg-slate-100 px-1 rounded text-rose-600">{getApiBase()}</code>.
              {error.includes('Network Error') ? ' Ensure the backend server is running and CORS is enabled.' : error}
            </p>
            <div className="flex gap-4">
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
              >
                <RefreshCcw size={18} /> Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">USN</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Student</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Sem</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Subject</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Internal</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">External</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Total</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-5 text-xs font-black text-slate-400 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  [1, 2, 3, 4, 5, 6].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="px-6 py-6"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                    </tr>
                  ))
                ) : results.length > 0 ? (
                  results.map((res) => (
                    <tr key={res.id} className={`transition-colors group cursor-pointer relative ${res.result_status === 'F'
                      ? 'bg-rose-50 hover:bg-rose-100 border-l-4 border-rose-500'
                      : 'hover:bg-slate-50'
                      }`}>
                      <td className={`px-6 py-5 font-bold ${res.result_status === 'F' ? 'text-rose-600' : 'text-indigo-600'
                        }`}>{res.usn}</td>
                      <td className={`px-6 py-5 font-medium ${res.result_status === 'F' ? 'text-rose-700' : 'text-slate-600'
                        }`}>{res.student_name}</td>
                      <td className={`px-6 py-5 font-semibold ${res.result_status === 'F' ? 'text-rose-600' : 'text-slate-500'
                        }`}>{res.semester}</td>
                      <td className="px-6 py-5">
                        <p className={`font-bold leading-tight ${res.result_status === 'F' ? 'text-rose-700' : 'text-slate-900'
                          }`}>{res.subject_code}</p>
                        <p className={`text-xs mt-0.5 ${res.result_status === 'F' ? 'text-rose-500' : 'text-slate-400'
                          }`}>{res.subject_name}</p>
                      </td>
                      <td className={`px-6 py-5 ${res.result_status === 'F' ? 'text-rose-700 font-bold' : 'text-slate-600'
                        }`}>{res.internal_marks}</td>
                      <td className={`px-6 py-5 ${res.result_status === 'F' ? 'text-rose-700 font-bold' : 'text-slate-600'
                        }`}>{res.external_marks}</td>
                      <td className={`px-6 py-5 text-center font-black ${res.result_status === 'F' ? 'text-rose-700' : 'text-slate-900'
                        }`}>{res.total_marks}</td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-black tracking-tight ${res.result_status === 'P' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                          {res.result_status === 'P' ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setDeleteConfirm(deleteConfirm === res.id ? null : res.id)}
                            className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                            disabled={isDeleting}
                          >
                            <Trash2 size={18} />
                          </button>
                          {deleteConfirm === res.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-10">
                              <div className="p-3">
                                <p className="text-sm text-slate-600 mb-3">Delete this result?</p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleDelete(res.id)}
                                    disabled={isDeleting}
                                    className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded hover:bg-rose-700 transition-colors"
                                  >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded hover:bg-slate-300 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <AlertCircle size={32} className="mb-4 opacity-20" />
                        <p className="font-bold">No results found matching your filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!error && !isLoading && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-slate-500">
                Showing page {Math.floor(filters.skip / filters.limit) + 1}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-500">Rows</span>
                <select
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500"
                  value={filters.limit}
                  onChange={(e) => {
                    const nextLimit = parseInt(e.target.value, 10);
                    setFilters((f) => ({ ...f, limit: nextLimit, skip: 0 }));
                  }}
                >
                  {[10, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters((f) => ({ ...f, skip: Math.max(0, f.skip - f.limit) }))}
                disabled={filters.skip === 0}
                className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setFilters((f) => ({ ...f, skip: f.skip + f.limit }))}
                disabled={results.length < filters.limit}
                className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsExplorer;
