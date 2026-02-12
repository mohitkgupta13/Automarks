
import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { endpoints, getApiBase } from '@/api/client';
import { BatchStatus } from '@/types';
import UploadErrorPopup from './UploadErrorPopup';
import { getBatchOptions } from '@/utils/batches';

interface FailedFile {
  filename: string;
  error: string;
}

interface WebSocketMessage {
  batch_id: string;
  status: string;
  processed: number;
  failed: number;
  total: number;
  percentage: number;
  current_file?: string;
  current_file_index?: number;
  failed_files?: FailedFile[];
}

const UploadPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('batch');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<BatchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState({
    percentage: 0,
    current_file: '',
    current_file_index: 0,
    processed: 0,
    failed: 0,
    total: 0
  });
  const [failedFiles, setFailedFiles] = useState<FailedFile[]>([]);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const wsUrl = getApiBase().replace('http', 'ws') + '/ws/upload-progress';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data: WebSocketMessage = JSON.parse(event.data);

      // Update progress only for current batch
      if (!batchId || data.batch_id === batchId) {
        setUploadProgress({
          percentage: data.percentage || 0,
          current_file: data.current_file || '',
          current_file_index: data.current_file_index || 0,
          processed: data.processed || 0,
          failed: data.failed || 0,
          total: data.total || 0
        });

        setStatus({
          batch_id: data.batch_id,
          status: data.status,
          processed: data.processed,
          failed: data.failed,
          total_files: data.total,
          percentage: data.percentage,
          errors: []
        });

        // Handle failed files for popup
        if (data.failed_files && data.failed_files.length > 0) {
          setFailedFiles(data.failed_files);
          if (data.status === 'completed' || data.status === 'failed') {
            setShowErrorPopup(true);
          }
        }

        // Upload completed
        if (data.status === 'completed' || data.status === 'failed') {
          setIsUploading(false);
        }
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [batchId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Explicitly type 'f' as File to avoid unknown property errors
      const files = Array.from(e.target.files).filter((f: File) => f.type === 'application/pdf');
      if (files.length < e.target.files.length) {
        setError("Only PDF files are supported.");
      } else {
        setError(null);
      }
      setSelectedFiles(activeTab === 'single' ? [files[0]] : files);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    if (!selectedBatch) {
      setError('Select a Batch (e.g., 2022-2026)');
      return;
    }
    setIsUploading(true);
    setError(null);
    setBatchId(null);
    setStatus(null);

    try {
      if (activeTab === 'single') {
        await endpoints.uploadSingle(selectedFiles[0], selectedBatch);
        setStatus({
          batch_id: 'single',
          status: 'completed',
          total_files: 1,
          processed_files: 1,
          failed_files: 0
        });
      } else {
        const res = await endpoints.uploadBatch(selectedFiles, selectedBatch);
        setBatchId(res.batch_id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initiate upload");
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setSelectedFiles([]);
    setIsUploading(false);
    setBatchId(null);
    setStatus(null);
    setError(null);
    setUploadProgress({
      percentage: 0,
      current_file: '',
      current_file_index: 0,
      processed: 0,
      failed: 0,
      total: 0
    });
    setFailedFiles([]);
    setShowErrorPopup(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Upload Portal</h2>
        <p className="text-slate-500 font-medium">Process university result PDFs to extract data and analytics.</p>
      </div>

      <div className="glass-card rounded-[2rem] overflow-hidden">
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => { reset(); setActiveTab('batch'); }}
            className={`flex-1 py-5 font-bold transition-all ${activeTab === 'batch' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-400'}`}
          >
            Batch Upload
          </button>
          <button
            onClick={() => { reset(); setActiveTab('single'); }}
            className={`flex-1 py-5 font-bold transition-all ${activeTab === 'single' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-400'}`}
          >
            Single File
          </button>
        </div>

        <div className="p-10">
          {!status && !batchId && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-100 rounded-3xl p-6">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Batch</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 appearance-none font-bold text-slate-700"
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  disabled={isUploading}
                >
                  <option value="">Select batch (e.g. 2022-2026)</option>
                  {getBatchOptions().map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center hover:border-indigo-300 transition-colors bg-slate-50 group">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  multiple={activeTab === 'batch'}
                  accept=".pdf"
                  onChange={handleFileChange}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm group-hover:scale-110 transition-transform">
                    <UploadCloud className="text-indigo-600" size={40} />
                  </div>
                  <p className="text-xl font-bold text-slate-900 mb-2">
                    {selectedFiles.length > 0
                      ? `${selectedFiles.length} file(s) selected`
                      : 'Drop your PDFs here or browse'
                    }
                  </p>
                  <p className="text-slate-500 text-sm">Strictly VTU Official Result Sheets (PDF)</p>
                </label>
              </div>

              {selectedFiles.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-2 p-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl">
                      <FileText size={18} className="text-slate-400" />
                      <span className="text-sm font-semibold text-slate-700 flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl flex items-center gap-3 border border-rose-100">
                  <AlertTriangle size={20} />
                  <p className="text-sm font-bold">{error}</p>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={isUploading || selectedFiles.length === 0}
                className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:translate-y-0 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isUploading ? <Loader2 size={24} className="animate-spin" /> : 'Start Processing'}
              </button>
            </div>
          )}

          {(batchId || status) && (
            <div className="space-y-8 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-2xl font-black text-slate-900">
                    {status?.status === 'completed' ? 'Processing Complete' : 'Processing Files...'}
                  </h4>
                  <p className="text-slate-500 font-medium">Batch ID: {batchId || 'Single Upload'}</p>
                  {uploadProgress.current_file && (
                    <p className="text-sm text-indigo-600 font-bold mt-1">
                      Processing: {uploadProgress.current_file} ({uploadProgress.current_file_index}/{uploadProgress.total})
                    </p>
                  )}
                </div>
                {status?.status !== 'completed' && status?.status !== 'failed' && (
                  <Loader2 size={32} className="text-indigo-600 animate-spin" />
                )}
              </div>

              <div className="bg-slate-100 h-4 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-500 ease-out"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="text-center p-4 bg-slate-50 rounded-2xl">
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total</p>
                  <p className="text-2xl font-black text-slate-900">{uploadProgress.total || selectedFiles.length}</p>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded-2xl">
                  <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1">Success</p>
                  <p className="text-2xl font-black text-emerald-600">{uploadProgress.processed || 0}</p>
                </div>
                <div className="text-center p-4 bg-rose-50 rounded-2xl">
                  <p className="text-rose-400 text-[10px] font-bold uppercase tracking-wider mb-1">Failures</p>
                  <p className="text-2xl font-black text-rose-600">{uploadProgress.failed || 0}</p>
                </div>
              </div>

              {status?.status === 'completed' && (
                <div className="pt-6">
                  <button
                    onClick={reset}
                    className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Popup for Failed Files */}
      {showErrorPopup && (
        <UploadErrorPopup
          failedFiles={failedFiles}
          onClose={() => setShowErrorPopup(false)}
        />
      )}
    </div>
  );
};

export default UploadPage;