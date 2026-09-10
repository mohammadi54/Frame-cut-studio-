import React from 'react';
import { Sparkles, Check, Layout, Palette, ShieldAlert } from 'lucide-react';
import { ProjectState, Platform, FrameStyle, BackgroundPreset } from '../../types';
import { PLATFORMS } from '../../constants/platforms';

interface FrameTabProps {
  projectState: ProjectState;
  onUpdateState: (patch: Partial<ProjectState>) => void;
  onApplyProFrame: () => void;
}

const FRAME_STYLES: { id: FrameStyle; label: string; description: string }[] = [
  { id: 'mohammadi-gold', label: 'Mohammadi Gold Frame ⚜️', description: 'Dual gold border with royal halo shadow and academic crest' },
  { id: 'rounded-shadow', label: 'Rounded Card', description: '28px radius with deep diffuse drop shadow' },
  { id: 'clean', label: 'Clean Border', description: 'Minimalist 2px crisp border' },
  { id: 'gradient-glow', label: 'Gradient Glow', description: 'Vibrant neon colored edge aura' },
  { id: 'neon-cyber', label: 'Neon Cyber', description: 'High-contrast cyan & magenta tech borders' },
  { id: 'studio-card', label: 'Studio Card', description: 'Professional dark card with indigo accent' },
  { id: 'film-strip', label: 'Cinema Reel', description: 'Top and bottom film perforations' },
  { id: 'polaroid', label: 'Polaroid Style', description: 'Photo border with signature bottom margin' },
  { id: 'none', label: 'No Frame', description: 'Raw video without framing effects' },
];

const BACKGROUND_PRESETS: { id: BackgroundPreset; label: string; previewClass: string }[] = [
  { id: 'mohammadi-royal', label: 'Mohammadi Royal Navy ⚜️', previewClass: 'bg-gradient-to-tr from-[#030a16] via-[#0b1c36] to-[#040e1e]' },
  { id: 'mohammadi-emerald', label: 'Mohammadi Emerald 🌿', previewClass: 'bg-gradient-to-tr from-[#01140e] via-[#064e3b] to-[#022c22]' },
  { id: 'blur-video', label: 'Blurred Video', previewClass: 'bg-gradient-to-tr from-indigo-900 to-violet-800' },
  { id: 'gradient-midnight', label: 'Midnight Navy', previewClass: 'bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950' },
  { id: 'gradient-sunset', label: 'Sunset Glow', previewClass: 'bg-gradient-to-tr from-pink-900 via-rose-800 to-amber-700' },
  { id: 'gradient-cyber', label: 'Cyber Grid', previewClass: 'bg-gradient-to-tr from-violet-950 via-purple-900 to-cyan-950' },
  { id: 'studio-dark', label: 'Studio Dark', previewClass: 'bg-gradient-to-tr from-neutral-950 via-neutral-900 to-black' },
  { id: 'mesh-aurora', label: 'Aurora Mesh', previewClass: 'bg-gradient-to-tr from-emerald-950 via-indigo-950 to-pink-950' },
  { id: 'solid-slate', label: 'Slate Gray', previewClass: 'bg-slate-800' },
  { id: 'solid-black', label: 'Deep Black', previewClass: 'bg-black' },
];

export const FrameTab: React.FC<FrameTabProps> = ({
  projectState,
  onUpdateState,
  onApplyProFrame,
}) => {
  const currentPlatform = PLATFORMS[projectState.platform];
  const video = projectState.video;

  return (
    <div className="space-y-6">
      {/* The Hero Pro Framing Trigger */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-purple-950/50 to-pink-950/40 p-4 rounded-2xl border border-indigo-500/30 shadow-lg relative overflow-hidden">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>KEY FEATURE: ONE-CLICK AUTO FIT</span>
            </div>
            <h3 className="text-sm font-bold text-white mt-0.5">
              ✨ Apply Professional Frame
            </h3>
            <p className="text-xs text-neutral-300 mt-1">
              Detects your video's aspect ratio (
              <span className="text-indigo-300 font-mono font-bold">
                {video ? `${video.aspectCategory} (${video.width}×{video.height})` : 'Auto'}
              </span>
              ) and automatically centers it inside a tailored {currentPlatform.name} layout with top title, backdrop & subtitles.
            </p>
          </div>
        </div>

        <button
          onClick={onApplyProFrame}
          disabled={!video}
          className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:brightness-110 text-white text-xs font-bold shadow-md shadow-rose-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Apply Professional Frame Now</span>
        </button>
      </div>

      {/* Target Platform Selection */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
          1. Target Platform & Canvas Ratio
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PLATFORMS) as Platform[]).map((pid) => {
            const p = PLATFORMS[pid];
            const isSelected = projectState.platform === pid;
            return (
              <button
                key={pid}
                onClick={() => onUpdateState({ platform: pid })}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-md shadow-indigo-500/10'
                    : 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs">{p.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                    {p.aspectRatio}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1 line-clamp-1">
                  {p.recommendedDescription}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Frame Style Options */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
          2. Border & Frame Style
        </label>
        <div className="grid grid-cols-2 gap-2">
          {FRAME_STYLES.map((f) => {
            const isSelected = projectState.frameStyle === f.id;
            return (
              <button
                key={f.id}
                onClick={() => onUpdateState({ frameStyle: f.id })}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/40 text-white'
                    : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-200">{f.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <p className="text-[10px] text-neutral-500 mt-0.5 line-clamp-1">
                  {f.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Background Preset Selection */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
          3. Canvas Background
        </label>
        <div className="grid grid-cols-2 gap-2">
          {BACKGROUND_PRESETS.map((b) => {
            const isSelected = projectState.background === b.id;
            return (
              <button
                key={b.id}
                onClick={() => onUpdateState({ background: b.id })}
                className={`p-2 rounded-xl border flex items-center gap-2.5 text-left transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/40 text-white'
                    : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                }`}
              >
                <span className={`w-5 h-5 rounded-lg border border-white/20 shrink-0 ${b.previewClass}`} />
                <span className="text-xs font-medium truncate">{b.label}</span>
                {isSelected && <Check className="w-3 h-3 text-indigo-400 ml-auto" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
