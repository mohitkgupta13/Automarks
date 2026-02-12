
import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { endpoints } from '@/api/client';
import { getBatchOptions } from '@/utils/batches';

const ExportPage: React.FC = () => {
  const [semester, setSemester] = useState<number | ''>('');
  const [batch, setBatch] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semester && !batch) {
      setError('Please select either a semester or a batch (or both).');
      return;
    }

    setIsExporting(true);
    setError(null);
    setSuccess(null);

    try {
      // Trigger download
      await endpoints.exportExcel(
        semester ? Number(semester) : undefined,
        batch || undefined
      );
      setSuccess('Export completed successfully. Download started.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to export data.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Data Export</h2>
        <p className="text-slate-500 font-medium mt-2">Download comprehensive Excel reports.</p>
      </div>

      <div className="glass-card p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100/50">
        <form onSubmit={handleExport} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Semester Filter (Optional)</label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                value={semester}
                onChange={(e) => setSemester(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Batch Filter (Optional)</label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
              >
                <option value="">All Batches</option>
                {getBatchOptions().map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl flex items-center gap-3 border border-rose-100 animate-in slide-in-from-top-2">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center gap-3 border border-emerald-100 animate-in slide-in-from-top-2">
              <CheckCircle2 size={20} className="shrink-0" />
              <p className="text-sm font-bold">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isExporting}
            className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:translate-y-0 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group"
          >
            {isExporting ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>
                <FileSpreadsheet size={24} className="group-hover:scale-110 transition-transform" />
                <span>Generate Report</span>
              </>
            )}
          </button>
        </form>
      </div>

      <div className="text-center">
        <p className="text-xs text-slate-400 font-bold max-w-xs mx-auto">
          Export generates a .xlsx file containing student details, subject-wise marks, totals, and results.
        </p>
      </div>
    </div>
  );
};

export default ExportPage;
