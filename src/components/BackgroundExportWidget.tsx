import React from 'react';
import { RotateCw, CheckCircle2, AlertCircle, Download, X, Maximize2, ShieldAlert } from 'lucide-react';
import { ExportProgress, downloadBlob } from '../utils/videoExporter';
import { PlatformConfig } from '../types';

interface BackgroundExportWidgetProps {
  progress: ExportProgress;
  platform: PlatformConfig;
  onCancel: () => void;
  onDismiss: () => void;
  onExpand: () => void;
}

export const BackgroundExportWidget: React.FC<BackgroundExportWidgetProps> = ({
  progress,
  platform,
  onCancel,
  onDismiss,
  onExpand,
}) => {
  if (progress.status === 'idle') return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-40px)] sm:w-96 animate-slideUp">
      <div className="bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden">
        {/* Progress Bar Top Edge */}
        {progress.status === 'rendering' && (
          <div className="w-full h-1.5 bg-neutral-950 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-200"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        )}

        <div className="p-3.5 flex items-center justify-between gap-3">
          {/* Status Indicator Icon */}
          <div className="flex items-center gap-3 min-w-0">
            {progress.status === 'rendering' && (
              <div className="relative w-9 h-9 rounded-xl bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center shrink-0">
                <RotateCw className="w-5 h-5 text-indigo-400 animate-spin" />
                <span className="sr-only">{progress.progress}%</span>
              </div>
            )}

            {progress.status === 'completed' && (
              <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            )}

            {progress.status === 'error' && (
              <div className="w-9 h-9 rounded-xl bg-rose-950/80 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
            )}

            {/* Status Information */}
            <div className="min-w-0">
              {progress.status === 'rendering' && (
                <>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                    <span>Exporting {platform.name}</span>
                    <span className="font-mono text-indigo-400 text-[11px]">
                      {progress.progress}%
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 truncate">
                    Running in background • Keep editing freely
                  </p>
                </>
              )}

              {progress.status === 'completed' && (
                <>
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span>Export Ready!</span>
                  </div>
                  <p className="text-[10px] text-neutral-300 font-mono truncate">
                    {progress.filename || 'Video completed'}
                  </p>
                </>
              )}

              {progress.status === 'error' && (
                <>
                  <div className="text-xs font-bold text-rose-400">Export Encountered Error</div>
                  <p className="text-[10px] text-neutral-400 truncate">
                    {progress.errorMessage || 'Please try again'}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {progress.status === 'rendering' && (
              <>
                <button
                  onClick={onExpand}
                  title="Expand to Full View"
                  className="p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onCancel}
                  className="py-1 px-2.5 rounded-lg bg-neutral-800/90 hover:bg-rose-950/60 border border-neutral-700/80 hover:border-rose-500/40 text-neutral-300 hover:text-rose-300 text-xs font-medium transition-all"
                >
                  Cancel
                </button>
              </>
            )}

            {progress.status === 'completed' && (
              <>
                <button
                  onClick={() => {
                    if (progress.downloadUrl && progress.filename) {
                      downloadBlob(progress.downloadUrl, progress.filename);
                    }
                  }}
                  className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={onDismiss}
                  title="Dismiss"
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {progress.status === 'error' && (
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
