import React from 'react';
import { RotateCw, RotateCcw, FlipHorizontal, FlipVertical, RefreshCw, Move, ZoomIn } from 'lucide-react';
import { VideoTransform, ProjectState } from '../../types';

interface TransformTabProps {
  transform: VideoTransform;
  onChange: (patch: Partial<VideoTransform>) => void;
  onReset: () => void;
  onAutoCenter: () => void;
}

export const TransformTab: React.FC<TransformTabProps> = ({
  transform,
  onChange,
  onReset,
  onAutoCenter,
}) => {
  const rotateStep = (degrees: number) => {
    let next = (transform.rotation + degrees) % 360;
    if (next > 180) next -= 360;
    if (next < -180) next += 360;
    onChange({ rotation: next });
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
          Video Crop, Size & Position
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onAutoCenter}
            className="px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-medium hover:bg-indigo-900/60 transition-all flex items-center gap-1"
          >
            <Move className="w-3 h-3" />
            <span>Auto Center</span>
          </button>
          <button
            onClick={onReset}
            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white transition-all"
            title="Reset Transform"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Scale / Resize */}
      <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-neutral-300 font-medium">
            <ZoomIn className="w-3.5 h-3.5 text-indigo-400" /> Scale / Zoom
          </span>
          <span className="font-mono text-indigo-300">
            {Math.round(transform.scale * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.4"
          max="1.8"
          step="0.02"
          value={transform.scale}
          onChange={(e) => onChange({ scale: parseFloat(e.target.value) })}
          className="w-full h-1.5 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-neutral-500">
          <span>40% (Fit)</span>
          <span>100% (Default)</span>
          <span>180% (Crop In)</span>
        </div>
      </div>

      {/* Rotation & Quick Angles */}
      <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-300 font-medium">Rotation Angle</span>
          <span className="font-mono text-indigo-300">{transform.rotation}°</span>
        </div>
        <input
          type="range"
          min="-180"
          max="180"
          step="1"
          value={transform.rotation}
          onChange={(e) => onChange({ rotation: parseInt(e.target.value) })}
          className="w-full h-1.5 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
        />

        <div className="grid grid-cols-4 gap-2 pt-1">
          <button
            onClick={() => rotateStep(-90)}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center justify-center gap-1 transition-all"
          >
            <RotateCcw className="w-3 h-3" /> -90°
          </button>
          <button
            onClick={() => rotateStep(90)}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center justify-center gap-1 transition-all"
          >
            <RotateCw className="w-3 h-3" /> +90°
          </button>
          <button
            onClick={() => onChange({ flipH: !transform.flipH })}
            className={`p-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
              transform.flipH
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
            }`}
          >
            <FlipHorizontal className="w-3 h-3" /> Flip H
          </button>
          <button
            onClick={() => onChange({ flipV: !transform.flipV })}
            className={`p-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
              transform.flipV
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
            }`}
          >
            <FlipVertical className="w-3 h-3" /> Flip V
          </button>
        </div>
      </div>

      {/* Position Offsets (X / Y) */}
      <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 space-y-3">
        <span className="text-xs text-neutral-300 font-medium block">
          Position Adjustment (Subject Centering)
        </span>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-400">Horizontal Offset (X)</span>
            <span className="font-mono text-neutral-300">{transform.offsetX}px</span>
          </div>
          <input
            type="range"
            min="-300"
            max="300"
            step="5"
            value={transform.offsetX}
            onChange={(e) => onChange({ offsetX: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-400">Vertical Offset (Y)</span>
            <span className="font-mono text-neutral-300">{transform.offsetY}px</span>
          </div>
          <input
            type="range"
            min="-400"
            max="400"
            step="5"
            value={transform.offsetY}
            onChange={(e) => onChange({ offsetY: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
