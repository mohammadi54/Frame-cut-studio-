import React from 'react';
import { Sparkles, Download, Video, Camera, Layers, Wand2 } from 'lucide-react';
import { Platform, ProjectState } from '../types';
import { PLATFORMS } from '../constants/platforms';

interface HeaderProps {
  projectState: ProjectState;
  onPlatformChange: (p: Platform) => void;
  onApplyProFrame: () => void;
  onOpenExport: () => void;
  onOpenAiKit: () => void;
  onTakeSnapshot: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectState,
  onPlatformChange,
  onApplyProFrame,
  onOpenExport,
  onOpenAiKit,
  onTakeSnapshot,
}) => {
  const currentPlatform = PLATFORMS[projectState.platform];
  const video = projectState.video;

  return (
    <header className="border-b border-neutral-800/80 bg-neutral-900/90 backdrop-blur-md px-4 py-2.5 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-neutral-950 font-black text-lg border border-amber-400/40">
          <Layers className="w-5 h-5 text-neutral-950" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-base tracking-tight text-white font-['Outfit']">
              FrameCut <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200">Studio</span>
            </h1>
            <span className="text-[10px] font-bold tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40">
              Mohammadiacademy.org
            </span>
          </div>
          <p className="text-xs text-neutral-400 hidden sm:block">
            Mohammadi Academy Edition • Bilingual Persian & English Subtitles
          </p>
        </div>
      </div>

      {/* Platform Switcher Chips */}
      <div className="flex items-center bg-neutral-950/80 p-1 rounded-xl border border-neutral-800">
        {(Object.keys(PLATFORMS) as Platform[]).map((pid) => {
          const p = PLATFORMS[pid];
          const isSelected = projectState.platform === pid;
          return (
            <button
              key={pid}
              onClick={() => onPlatformChange(pid)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                isSelected
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <span>{p.name}</span>
              <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-indigo-700/60 text-indigo-100' : 'bg-neutral-800 text-neutral-500'}`}>
                {p.aspectRatio}
              </span>
            </button>
          );
        })}
      </div>

      {/* Action Buttons: Apply Pro Frame, AI Kit, Export */}
      <div className="flex items-center gap-2">
        {/* The Key Feature: Apply Professional Frame Button */}
        <button
          onClick={onApplyProFrame}
          disabled={!video}
          title={video ? "Auto-detect aspect ratio & apply optimal framing" : "Upload a video first"}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            video
              ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-violet-600 text-white shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-95 cursor-pointer ring-1 ring-white/20 animate-pulse'
              : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-60'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-200" />
          <span className="hidden md:inline">Apply Professional Frame</span>
          <span className="md:hidden">Auto Frame</span>
        </button>

        {/* AI Content Kit */}
        <button
          onClick={onOpenAiKit}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-neutral-800/90 text-neutral-200 hover:bg-neutral-700/80 border border-neutral-700/70 transition-all hover:text-white"
        >
          <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">AI Kit</span>
        </button>

        {/* Snapshot */}
        <button
          onClick={onTakeSnapshot}
          disabled={!video}
          title="Snapshot Frame (PNG Poster)"
          className="p-2 rounded-xl bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700 border border-neutral-700/70 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Camera className="w-4 h-4" />
        </button>

        {/* Export Button */}
        <button
          onClick={onOpenExport}
          disabled={!video}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            video
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer'
              : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Export Video</span>
        </button>
      </div>
    </header>
  );
};
