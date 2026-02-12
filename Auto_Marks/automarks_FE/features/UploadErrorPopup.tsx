import React from 'react';
import { X, AlertCircle } from 'lucide-react';

interface FailedFile {
  filename: string;
  error: string;
}

interface UploadErrorPopupProps {
  failedFiles: FailedFile[];
  onClose: () => void;
}

const UploadErrorPopup: React.FC<UploadErrorPopupProps> = ({ failedFiles, onClose }) => {
  if (failedFiles.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="bg-rose-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={24} className="text-white" />
            <h3 className="text-xl font-black text-white">Upload Errors ({failedFiles.length})</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-rose-700 rounded-xl transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Error List */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <p className="text-slate-600 font-medium mb-4">
            The following files failed to process. Please review and try again:
          </p>
          <div className="space-y-3">
            {failedFiles.map((file, index) => (
              <div
                key={index}
                className="bg-rose-50 border border-rose-200 rounded-2xl p-4 hover:bg-rose-100 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-rose-500 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{file.filename}</p>
                    <p className="text-sm text-rose-700 mt-1">{file.error}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadErrorPopup;
