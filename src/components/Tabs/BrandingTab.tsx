import React, { useRef } from 'react';
import { 
  ShieldCheck, 
  AtSign, 
  Volume2, 
  Zap, 
  Upload, 
  Trash2, 
  Move, 
  Maximize2, 
  Crosshair, 
  Sparkles,
  CheckCircle2,
  Flame,
  Star,
  Play
} from 'lucide-react';
import { LogoSettings, WatermarkSettings, AudioSettings } from '../../types';

interface BrandingTabProps {
  logo: LogoSettings;
  watermark: WatermarkSettings;
  audio: AudioSettings;
  onUpdateLogo: (patch: Partial<LogoSettings>) => void;
  onUpdateWatermark: (patch: Partial<WatermarkSettings>) => void;
  onUpdateAudio: (patch: Partial<AudioSettings>) => void;
}

export const BrandingTab: React.FC<BrandingTabProps> = ({
  logo,
  watermark,
  audio,
  onUpdateLogo,
  onUpdateWatermark,
  onUpdateAudio,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onUpdateLogo({
        enabled: true,
        url: dataUrl,
        preset: 'custom',
      });
    };
    reader.readAsDataURL(file);
  };

  const PRESET_BADGES = [
    { id: 'mohammadi-crest', name: 'Mohammadi Crest ⚜️', icon: ShieldCheck, color: 'text-amber-400' },
    { id: 'mohammadi-gold', name: 'Academy Gold 🌟', icon: Star, color: 'text-amber-300' },
    { id: 'mohammadi-emerald', name: 'Islamic Emerald 🌿', icon: Sparkles, color: 'text-emerald-400' },
    { id: 'badge-verified', name: 'Verified ✓', icon: CheckCircle2, color: 'text-indigo-400' },
    { id: 'youtube-badge', name: 'YT Play ▶', icon: Play, color: 'text-rose-500' },
    { id: 'fire-trend', name: 'Trending 🔥', icon: Flame, color: 'text-amber-500' },
  ] as const;

  const ACADEMY_WATERMARKS = [
    'Mohammadiacademy.org',
    'آکادمی محمدی',
    'Mohammadi Academy • آکادمی محمدی',
    '@Mohammadiacademy.org',
  ];

  const POSITION_PRESETS = [
    { id: 'top-left', label: 'Top Left' },
    { id: 'center-top', label: 'Center Top' },
    { id: 'top-right', label: 'Top Right' },
    { id: 'bottom-left', label: 'Bottom Left' },
    { id: 'center-bottom', label: 'Center Bottom' },
    { id: 'bottom-right', label: 'Bottom Right' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Channel Logo & Logo Placer Option */}
      <div className="bg-neutral-900/80 p-4 rounded-xl border border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Logo Placer & Branding</span>
              <span className="text-[10px] text-neutral-400">Place, drag, and customize logo on screen</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={logo.enabled}
            onChange={(e) => onUpdateLogo({ enabled: e.target.checked })}
            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
          />
        </div>

        {logo.enabled && (
          <div className="space-y-4 pt-1">
            {/* Logo Placer Mode Banner */}
            <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-2.5">
              <Move className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-neutral-300 leading-relaxed">
                <span className="font-semibold text-white block">Interactive On-Screen Placer:</span>
                Drag the logo directly anywhere on the canvas preview to position it, or choose coordinates below.
              </div>
            </div>

            {/* Logo Source: Upload custom or select preset */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-neutral-300 block">Logo Graphic</span>

              {/* Upload custom image */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 rounded-xl bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-700/80 text-xs font-medium text-neutral-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{logo.url ? 'Change Custom Logo Image' : 'Upload Brand Logo / PNG'}</span>
                </button>

                {logo.url && (
                  <button
                    type="button"
                    onClick={() => onUpdateLogo({ url: null, preset: 'badge-verified' })}
                    title="Remove custom logo"
                    className="p-2 rounded-xl bg-neutral-950 border border-neutral-800 text-rose-400 hover:text-rose-300 hover:border-rose-500/40 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Preset badging library if no custom logo */}
              {!logo.url && (
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {PRESET_BADGES.map((badge) => {
                    const Icon = badge.icon;
                    const isActive = logo.preset === badge.id;
                    return (
                      <button
                        key={badge.id}
                        type="button"
                        onClick={() => onUpdateLogo({ preset: badge.id, url: null })}
                        className={`py-1.5 px-2 rounded-xl text-[10px] font-medium border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isActive
                            ? 'border-indigo-500 bg-indigo-950/60 text-white shadow-sm'
                            : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        <Icon className={`w-3 h-3 ${badge.color}`} />
                        <span>{badge.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Logo Placer Position Options */}
            <div className="space-y-2 pt-2 border-t border-neutral-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-300">Screen Position</span>
                {logo.position === 'custom' && (
                  <span className="text-[10px] text-indigo-400 font-mono">
                    ({Math.round(logo.xPercent ?? 50)}%, {Math.round(logo.yPercent ?? 50)}%)
                  </span>
                )}
              </div>

              {/* Grid of preset positions */}
              <div className="grid grid-cols-3 gap-1.5">
                {POSITION_PRESETS.map((pos) => {
                  const isActive = logo.position === pos.id;
                  return (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => onUpdateLogo({ position: pos.id })}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-medium border transition-all cursor-pointer ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-950/60 text-white shadow-sm'
                          : 'border-neutral-800 bg-neutral-950/40 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {pos.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Coordinate Sliders for precise placement */}
              <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 font-medium flex items-center gap-1">
                    <Crosshair className="w-3 h-3 text-indigo-400" /> Free Placement Sliders
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateLogo({ position: 'custom', xPercent: 50, yPercent: 50 })}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                  >
                    Center on Screen
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Horizontal X</span>
                      <span className="font-mono text-neutral-300">{Math.round(logo.xPercent ?? 8)}%</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="98"
                      value={logo.xPercent ?? 8}
                      onChange={(e) =>
                        onUpdateLogo({ position: 'custom', xPercent: parseFloat(e.target.value) })
                      }
                      className="w-full h-1 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Vertical Y</span>
                      <span className="font-mono text-neutral-300">{Math.round(logo.yPercent ?? 8)}%</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="98"
                      value={logo.yPercent ?? 8}
                      onChange={(e) =>
                        onUpdateLogo({ position: 'custom', yPercent: parseFloat(e.target.value) })
                      }
                      className="w-full h-1 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Logo Shape & Framing */}
            <div className="space-y-2 pt-2 border-t border-neutral-800/80">
              <span className="text-[11px] font-semibold text-neutral-300 block">Shape & Frame</span>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'circle', label: 'Circle' },
                    { id: 'rounded', label: 'Rounded' },
                    { id: 'square', label: 'Square' },
                    { id: 'none', label: 'Raw / None' },
                  ] as const
                ).map((sh) => (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => onUpdateLogo({ shape: sh.id })}
                    className={`py-1 px-2 rounded-lg text-[10px] font-medium border transition-all cursor-pointer ${
                      (logo.shape || 'circle') === sh.id
                        ? 'border-indigo-500 bg-indigo-950/60 text-white'
                        : 'border-neutral-800 bg-neutral-950/40 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {sh.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scale and Opacity */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-800/80">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-neutral-400">
                  <span>Logo Scale</span>
                  <span className="font-mono text-neutral-300">{logo.size}px</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="140"
                  step="5"
                  value={logo.size}
                  onChange={(e) => onUpdateLogo({ size: parseInt(e.target.value) })}
                  className="w-full h-1 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-neutral-400">
                  <span>Opacity</span>
                  <span className="font-mono text-neutral-300">
                    {Math.round((logo.opacity || 0.9) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={logo.opacity || 0.9}
                  onChange={(e) => onUpdateLogo({ opacity: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Watermark Section */}
      <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AtSign className="w-4 h-4 text-indigo-400" />
            <div>
              <span className="text-xs font-bold text-white block">Brand Watermark</span>
              <span className="text-[10px] text-neutral-400">Handle or creator tag overlay</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={watermark.enabled}
            onChange={(e) => onUpdateWatermark({ enabled: e.target.checked })}
            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
          />
        </div>

        {watermark.enabled && (
          <div className="space-y-3 pt-2">
            <input
              type="text"
              value={watermark.text}
              onChange={(e) => onUpdateWatermark({ text: e.target.value })}
              placeholder="e.g. Mohammadiacademy.org"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />

            {/* Mohammadi Academy official watermark chips */}
            <div className="flex flex-wrap gap-1.5">
              {ACADEMY_WATERMARKS.map((wm, wIdx) => (
                <button
                  key={wIdx}
                  type="button"
                  onClick={() => onUpdateWatermark({ text: wm })}
                  className="text-[10px] px-2 py-0.5 rounded bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-amber-300 transition-all cursor-pointer"
                >
                  {wm}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(['bottom-right', 'bottom-left', 'top-right'] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => onUpdateWatermark({ position: pos })}
                  className={`py-1 px-2 rounded-lg text-[10px] font-medium border capitalize cursor-pointer ${
                    watermark.position === pos
                      ? 'border-indigo-500 bg-indigo-950/40 text-white'
                      : 'border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {pos.replace('-', ' ')}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>Opacity</span>
                <span className="font-mono text-neutral-300">
                  {Math.round((watermark.opacity || 0.75) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={watermark.opacity || 0.75}
                onChange={(e) => onUpdateWatermark({ opacity: parseFloat(e.target.value) })}
                className="w-full h-1 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Audio Controls */}
      <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 space-y-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white">Audio Enhancement & Levels</span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-neutral-300">
            <span>Master Volume</span>
            <span className="font-mono text-indigo-300">
              {audio.muted ? 'Muted' : `${Math.round(audio.volume * 100)}%`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={audio.muted ? 0 : audio.volume}
            onChange={(e) => onUpdateAudio({ volume: parseFloat(e.target.value), muted: false })}
            className="w-full h-1.5 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <div>
              <span className="text-xs text-white font-medium block">Audio Clarity Boost</span>
              <span className="text-[10px] text-neutral-400">+50% speech enhancement</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={audio.boost}
            onChange={(e) => onUpdateAudio({ boost: e.target.checked })}
            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
