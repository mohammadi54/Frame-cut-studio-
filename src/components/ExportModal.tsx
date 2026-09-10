import React from 'react';
import { Download, X, CheckCircle2, AlertCircle, RotateCw, Video, Sparkles, Image } from 'lucide-react';
import { ExportProgress, downloadBlob } from '../utils/videoExporter';
import { PlatformConfig } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: ExportProgress;
  platform: PlatformConfig;
  onStartExport: () => void;
  onTakeSnapshot: () => void;
  onCancelExport?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  progress,
  platform,
  onStartExport,
  onTakeSnapshot,
  onCancelExport,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl space-y-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Export Video</h3>
              <p className="text-[11px] text-neutral-400">
                {platform.name} • {platform.width}×{platform.height} ({platform.aspectRatio})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title={progress.status === 'rendering' ? 'Run in background' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Display */}
        {progress.status === 'idle' && (
          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Output Platform:</span>
                <span className="text-white font-medium">{platform.name}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Resolution:</span>
                <span className="text-white font-mono">{platform.width} × {platform.height}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Format:</span>
                <span className="text-emerald-400 font-mono font-medium">High Quality WebM / MP4 (VP9/VP8)</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Background Mode:</span>
                <span className="text-indigo-400 font-medium">Enabled (non-blocking)</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={onStartExport}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>Start Background Render</span>
              </button>

              <button
                onClick={onTakeSnapshot}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700/80 transition-all flex items-center justify-center gap-2"
              >
                <Image className="w-3.5 h-3.5 text-indigo-400" />
                <span>Snapshot Current Frame as PNG Thumbnail</span>
              </button>
            </div>
          </div>
        )}

        {progress.status === 'rendering' && (
          <div className="py-5 space-y-4 text-center">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <RotateCw className="w-12 h-12 text-emerald-500 animate-spin" />
              <span className="absolute text-xs font-mono font-bold text-white">
                {progress.progress}%
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Rendering Video in Background...</h4>
              <p className="text-xs text-neutral-400">
                You can minimize this dialog and continue editing. We will notify you when it's ready.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500 transition-all duration-150"
                style={{ width: `${progress.progress}%` }}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
              >
                Minimize & Continue Editing
              </button>
              {onCancelExport && (
                <button
                  onClick={onCancelExport}
                  className="py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-rose-950/60 border border-neutral-700/80 hover:border-rose-500/40 text-neutral-300 hover:text-rose-300 text-xs font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {progress.status === 'completed' && (
          <div className="py-4 space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">Render Completed!</h4>
              <p className="text-xs text-neutral-400">
                Your video is packaged and ready to download.
              </p>
            </div>

            <button
              onClick={() => {
                if (progress.downloadUrl && progress.filename) {
                  downloadBlob(progress.downloadUrl, progress.filename);
                }
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Finished Video ({progress.filename})</span>
            </button>
          </div>
        )}

        {progress.status === 'error' && (
          <div className="py-4 space-y-3 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-rose-300">Render Failed</h4>
            <p className="text-xs text-neutral-400">{progress.errorMessage}</p>
            <button
              onClick={onStartExport}
              className="py-2 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold"
            >
              Retry Render
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
