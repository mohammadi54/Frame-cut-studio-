import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Scissors, 
  Maximize2, 
  Zap, 
  Move, 
  Crosshair, 
  Sparkles,
  MousePointer,
  RotateCw
} from 'lucide-react';
import { ProjectState, VideoTransform, LogoSettings } from '../types';
import { PLATFORMS } from '../constants/platforms';
import { renderCompositeFrame, getVideoBoundingBox, getLogoBoundingBox } from '../utils/canvasRenderer';

interface VideoPreviewCanvasProps {
  projectState: ProjectState;
  onTrimChange: (start: number, end: number) => void;
  onAudioChange: (volume: number, muted: boolean) => void;
  onTransformChange?: (patch: Partial<VideoTransform>) => void;
  onLogoChange?: (patch: Partial<LogoSettings>) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

type DragTarget = 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br' | 'video-body' | 'logo' | null;

export const VideoPreviewCanvas: React.FC<VideoPreviewCanvasProps> = ({
  projectState,
  onTrimChange,
  onAudioChange,
  onTransformChange,
  onLogoChange,
  videoRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(10);
  const [showInteractiveHandles, setShowInteractiveHandles] = useState(true);

  // Mouse interaction state for video resize and logo placer
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [cursorStyle, setCursorStyle] = useState<string>('default');
  const [hoverTarget, setHoverTarget] = useState<DragTarget>(null);

  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    scale: number;
    offsetX: number;
    offsetY: number;
    logoXPercent: number;
    logoYPercent: number;
    centerX: number;
    centerY: number;
    initDist: number;
  }>({
    mouseX: 0,
    mouseY: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    logoXPercent: 50,
    logoYPercent: 50,
    centerX: 0,
    centerY: 0,
    initDist: 1,
  });

  const platform = PLATFORMS[projectState.platform];

  // Sync video element with duration and currentTime
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const dur = video.duration || 10;
      setDuration(dur);
      if (projectState.trim.end === 0 || projectState.trim.end > dur) {
        onTrimChange(projectState.trim.start, dur);
      }
    };

    const handleTimeUpdate = () => {
      const cur = video.currentTime;
      setCurrentTime(cur);

      // Enforce trim loop
      if (cur >= (projectState.trim.end || duration)) {
        video.currentTime = projectState.trim.start || 0;
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    if (video.duration) {
      setDuration(video.duration);
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [videoRef, projectState.trim.start, projectState.trim.end, duration, onTrimChange]);

  // Real-time canvas render loop
  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      if (canvasRef.current) {
        const current = videoRef.current ? videoRef.current.currentTime : currentTime;
        renderCompositeFrame(
          canvasRef.current,
          videoRef.current,
          projectState,
          platform,
          current
        );
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [projectState, platform, currentTime, videoRef]);

  // Audio settings sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = projectState.audio.muted ? 0 : Math.min(1, projectState.audio.volume);
  }, [projectState.audio, videoRef]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime >= (projectState.trim.end || duration)) {
        video.currentTime = projectState.trim.start || 0;
      }
      video.play();
    } else {
      video.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    const video = videoRef.current;
    if (video) {
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleTrimStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = Math.min(parseFloat(e.target.value), (projectState.trim.end || duration) - 0.5);
    onTrimChange(newStart, projectState.trim.end || duration);
    if (videoRef.current && videoRef.current.currentTime < newStart) {
      videoRef.current.currentTime = newStart;
    }
  };

  const handleTrimEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = Math.max(parseFloat(e.target.value), (projectState.trim.start || 0) + 0.5);
    onTrimChange(projectState.trim.start || 0, newEnd);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`;
  };

  // Convert browser event coordinates to canvas space (0..platform.width, 0..platform.height)
  const getCanvasCoords = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const scaleX = platform.width / rect.width;
    const scaleY = platform.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, [platform.width, platform.height]);

  // Compute bounding boxes for mouse interaction
  const videoBox = getVideoBoundingBox(
    platform.width,
    platform.height,
    videoRef.current,
    projectState
  );

  const logoBox = projectState.logo.enabled
    ? getLogoBoundingBox(platform.width, platform.height, projectState)
    : null;

  // Hit test mouse location to find if user is hovering over handles, logo, or video
  const testHit = useCallback((canvasX: number, canvasY: number): DragTarget => {
    // 1. Check Corner Resize Handles of Video
    const handleRadius = Math.max(24, platform.width * 0.04);
    const dTL = Math.hypot(canvasX - videoBox.x, canvasY - videoBox.y);
    const dTR = Math.hypot(canvasX - (videoBox.x + videoBox.width), canvasY - videoBox.y);
    const dBL = Math.hypot(canvasX - videoBox.x, canvasY - (videoBox.y + videoBox.height));
    const dBR = Math.hypot(canvasX - (videoBox.x + videoBox.width), canvasY - (videoBox.y + videoBox.height));

    if (dTL <= handleRadius) return 'corner-tl';
    if (dTR <= handleRadius) return 'corner-tr';
    if (dBL <= handleRadius) return 'corner-bl';
    if (dBR <= handleRadius) return 'corner-br';

    // 2. Check Logo Placer Hit (if enabled)
    if (logoBox) {
      const logoCenterX = logoBox.x + logoBox.size / 2;
      const logoCenterY = logoBox.y + logoBox.size / 2;
      const dLogo = Math.hypot(canvasX - logoCenterX, canvasY - logoCenterY);
      if (dLogo <= logoBox.size * 0.75) {
        return 'logo';
      }
    }

    // 3. Check Inside Video Box
    if (
      canvasX >= videoBox.x &&
      canvasX <= videoBox.x + videoBox.width &&
      canvasY >= videoBox.y &&
      canvasY <= videoBox.y + videoBox.height
    ) {
      return 'video-body';
    }

    return null;
  }, [videoBox, logoBox, platform.width]);

  // Handle Mouse Down on Canvas (Start Drag / Resize)
  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    const target = testHit(coords.x, coords.y);
    if (!target) return;

    const initDist = Math.hypot(coords.x - videoBox.centerX, coords.y - videoBox.centerY) || 1;

    dragStartRef.current = {
      mouseX: coords.x,
      mouseY: coords.y,
      scale: projectState.transform.scale || 1,
      offsetX: projectState.transform.offsetX || 0,
      offsetY: projectState.transform.offsetY || 0,
      logoXPercent: projectState.logo.xPercent ?? 50,
      logoYPercent: projectState.logo.yPercent ?? 50,
      centerX: videoBox.centerX,
      centerY: videoBox.centerY,
      initDist,
    };

    setDragTarget(target);
  };

  // Handle Mouse Move over Canvas (Drag or Cursor Update)
  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);

    if (dragTarget) {
      // User is actively dragging
      if (
        dragTarget === 'corner-tl' ||
        dragTarget === 'corner-tr' ||
        dragTarget === 'corner-bl' ||
        dragTarget === 'corner-br'
      ) {
        // Selected Resize of the Video with Mouse
        if (onTransformChange) {
          const curDist = Math.hypot(
            coords.x - dragStartRef.current.centerX,
            coords.y - dragStartRef.current.centerY
          );
          const ratio = curDist / dragStartRef.current.initDist;
          const newScale = Math.max(0.2, Math.min(2.8, dragStartRef.current.scale * ratio));
          onTransformChange({ scale: parseFloat(newScale.toFixed(3)) });
        }
      } else if (dragTarget === 'video-body') {
        // Move / Reposition Video
        if (onTransformChange) {
          const deltaX = coords.x - dragStartRef.current.mouseX;
          const deltaY = coords.y - dragStartRef.current.mouseY;
          onTransformChange({
            offsetX: Math.round(dragStartRef.current.offsetX + deltaX),
            offsetY: Math.round(dragStartRef.current.offsetY + deltaY),
          });
        }
      } else if (dragTarget === 'logo') {
        // Logo Placer: Move logo anywhere on screen
        if (onLogoChange) {
          const xPercent = Math.max(2, Math.min(98, (coords.x / platform.width) * 100));
          const yPercent = Math.max(2, Math.min(98, (coords.y / platform.height) * 100));
          onLogoChange({
            position: 'custom',
            xPercent: parseFloat(xPercent.toFixed(1)),
            yPercent: parseFloat(yPercent.toFixed(1)),
          });
        }
      }
    } else {
      // Hover feedback
      const hit = testHit(coords.x, coords.y);
      setHoverTarget(hit);

      if (hit === 'corner-tl' || hit === 'corner-br') {
        setCursorStyle('nwse-resize');
      } else if (hit === 'corner-tr' || hit === 'corner-bl') {
        setCursorStyle('nesw-resize');
      } else if (hit === 'logo') {
        setCursorStyle('move');
      } else if (hit === 'video-body') {
        setCursorStyle('grab');
      } else {
        setCursorStyle('default');
      }
    }
  };

  const handleMouseUp = () => {
    setDragTarget(null);
  };

  // Determine container aspect ratio for visual framing
  const isVertical = platform.aspectRatio === '9:16';
  const isSquare = platform.aspectRatio === '1:1';

  return (
    <div className="flex flex-col h-full bg-neutral-950/70 rounded-2xl border border-neutral-800/90 overflow-hidden shadow-2xl">
      {/* Canvas Viewport Stage */}
      <div
        ref={stageRef}
        className="flex-1 min-h-[360px] max-h-[520px] lg:max-h-[580px] p-4 flex items-center justify-center relative bg-[radial-gradient(#1e1e2d_1px,transparent_1px)] [background-size:16px_16px] overflow-hidden select-none"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Aspect Ratio Guide Frame */}
        <div
          className={`relative flex items-center justify-center transition-all duration-300 shadow-2xl rounded-xl overflow-hidden border border-neutral-800 ${
            isVertical
              ? 'h-full aspect-[9/16] max-w-[320px]'
              : isSquare
              ? 'h-full aspect-square max-w-[460px]'
              : 'w-full aspect-[16/9] max-h-[460px]'
          }`}
        >
          {/* Main Rendering Canvas */}
          <canvas
            ref={canvasRef}
            style={{ cursor: dragTarget ? 'grabbing' : cursorStyle }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            className="w-full h-full object-contain block select-none"
          />

          {/* Interactive Mouse Resize & Logo Placer Overlay (SVG Guides) */}
          {showInteractiveHandles && (
            <svg
              viewBox={`0 0 ${platform.width} ${platform.height}`}
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {/* Video Selection Bounding Box */}
              <rect
                x={videoBox.x}
                y={videoBox.y}
                width={videoBox.width}
                height={videoBox.height}
                fill="none"
                stroke={dragTarget ? 'rgba(99, 102, 241, 0.95)' : 'rgba(99, 102, 241, 0.5)'}
                strokeWidth={Math.max(2, platform.width * 0.0025)}
                strokeDasharray="8 6"
                rx={12}
              />

              {/* 4 Corner Resize Handles */}
              {(
                [
                  { cx: videoBox.x, cy: videoBox.y, id: 'corner-tl' },
                  { cx: videoBox.x + videoBox.width, cy: videoBox.y, id: 'corner-tr' },
                  { cx: videoBox.x, cy: videoBox.y + videoBox.height, id: 'corner-bl' },
                  { cx: videoBox.x + videoBox.width, cy: videoBox.y + videoBox.height, id: 'corner-br' },
                ] as const
              ).map((handle) => {
                const isHovered = hoverTarget === handle.id || dragTarget === handle.id;
                const r = isHovered ? platform.width * 0.016 : platform.width * 0.012;
                return (
                  <g key={handle.id}>
                    <circle
                      cx={handle.cx}
                      cy={handle.cy}
                      r={r + 3}
                      fill="rgba(0,0,0,0.4)"
                    />
                    <circle
                      cx={handle.cx}
                      cy={handle.cy}
                      r={r}
                      fill={isHovered ? '#818cf8' : '#ffffff'}
                      stroke="#4f46e5"
                      strokeWidth={platform.width * 0.003}
                    />
                  </g>
                );
              })}

              {/* Video Scale HUD Tag */}
              <g transform={`translate(${videoBox.centerX}, ${Math.max(34, videoBox.y - 14)})`}>
                <rect
                  x="-65"
                  y="-14"
                  width="130"
                  height="22"
                  rx="6"
                  fill="rgba(15, 15, 26, 0.85)"
                  stroke="rgba(99, 102, 241, 0.4)"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="2"
                  fill="#c7d2fe"
                  fontSize={Math.max(11, platform.width * 0.014)}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  Scale: {Math.round((projectState.transform.scale || 1) * 100)}%
                </text>
              </g>
            </svg>
          )}

          {/* Canvas Platform Tag overlay */}
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-neutral-300 border border-white/10 pointer-events-none flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            <span>{platform.name}</span>
            <span className="text-neutral-500">({platform.width}×{platform.height})</span>
          </div>

          {/* Mouse Resize HUD Tooltip */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
            <button
              onClick={() => setShowInteractiveHandles((prev) => !prev)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium border backdrop-blur-md transition-all flex items-center gap-1 cursor-pointer ${
                showInteractiveHandles
                  ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
                  : 'bg-black/60 border-neutral-700 text-neutral-400 hover:text-white'
              }`}
              title="Toggle interactive mouse resizing handles"
            >
              <MousePointer className="w-3 h-3" />
              <span>{showInteractiveHandles ? 'Mouse Resize: On' : 'Handles: Off'}</span>
            </button>
          </div>

          {/* Watermark overlay indicator */}
          {projectState.watermark.enabled && (
            <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/50 text-[10px] text-neutral-400 font-mono pointer-events-none">
              {projectState.watermark.text}
            </div>
          )}
        </div>
      </div>

      {/* Control Bar & Interactive Timeline */}
      <div className="bg-neutral-900/95 border-t border-neutral-800 px-4 py-3 flex flex-col gap-2.5">
        {/* Mouse Interaction Quick Toolbar */}
        <div className="flex items-center justify-between text-[11px] text-neutral-400 pb-1 border-b border-neutral-800/60">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-indigo-300 font-medium">
              <Move className="w-3 h-3" /> Mouse Controls:
            </span>
            <span className="text-neutral-400 hidden sm:inline">
              Drag corners to resize • Drag video body to move • Drag logo to place
            </span>
          </div>

          {onTransformChange && (
            <button
              onClick={() => onTransformChange({ scale: 0.92, offsetX: 0, offsetY: 0 })}
              className="text-[10px] text-neutral-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset video scale and center position"
            >
              <RotateCw className="w-3 h-3" /> Reset Video Position
            </button>
          )}
        </div>

        {/* Main Playhead Slider */}
        <div className="relative flex items-center">
          <input
            type="range"
            min="0"
            max={duration || 10}
            step="0.05"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
          />
        </div>

        {/* Trim Timeline Controls */}
        <div className="bg-neutral-950/80 p-2 rounded-xl border border-neutral-800/80 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1 font-medium text-neutral-300">
              <Scissors className="w-3.5 h-3.5 text-indigo-400" /> Trim Bounds:
            </span>
            <span className="font-mono text-indigo-300">
              {formatTime(projectState.trim.start || 0)} → {formatTime(projectState.trim.end || duration)}
              <span className="text-neutral-500 ml-1.5">
                ({((projectState.trim.end || duration) - (projectState.trim.start || 0)).toFixed(1)}s active)
              </span>
            </span>
          </div>

          {/* Dual Handle Sliders for Trim */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500 w-8">Start:</span>
              <input
                type="range"
                min="0"
                max={duration || 10}
                step="0.1"
                value={projectState.trim.start || 0}
                onChange={handleTrimStartChange}
                className="w-full h-1 bg-neutral-800 rounded appearance-none accent-amber-500 cursor-pointer"
              />
              <span className="font-mono text-[10px] text-neutral-400 w-10 text-right">
                {formatTime(projectState.trim.start || 0)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500 w-8">End:</span>
              <input
                type="range"
                min="0"
                max={duration || 10}
                step="0.1"
                value={projectState.trim.end || duration}
                onChange={handleTrimEndChange}
                className="w-full h-1 bg-neutral-800 rounded appearance-none accent-amber-500 cursor-pointer"
              />
              <span className="font-mono text-[10px] text-neutral-400 w-10 text-right">
                {formatTime(projectState.trim.end || duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Playback Controls & Audio Bar */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = projectState.trim.start || 0;
                  setCurrentTime(projectState.trim.start || 0);
                }
              }}
              title="Restart from trim beginning"
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="text-xs font-mono text-neutral-300 px-2 py-1 rounded bg-neutral-950 border border-neutral-800">
              <span>{formatTime(currentTime)}</span>
              <span className="text-neutral-500"> / {formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume & Audio Adjustments */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAudioChange(projectState.audio.volume, !projectState.audio.muted)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                projectState.audio.muted
                  ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
              title={projectState.audio.muted ? 'Unmute' : 'Mute'}
            >
              {projectState.audio.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            <div className="flex items-center gap-1.5 w-24">
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={projectState.audio.muted ? 0 : projectState.audio.volume}
                onChange={(e) => onAudioChange(parseFloat(e.target.value), false)}
                className="w-full h-1 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
              />
              <span className="text-[10px] font-mono text-neutral-400 w-8">
                {Math.round((projectState.audio.muted ? 0 : projectState.audio.volume) * 100)}%
              </span>
            </div>

            {projectState.audio.boost && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" /> Boost
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
