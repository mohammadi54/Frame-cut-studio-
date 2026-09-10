import React, { useState, useRef } from 'react';
import { Upload, Film, PlayCircle, Sparkles, CheckCircle2, RotateCw } from 'lucide-react';
import { VideoMetadata } from '../types';
import { detectAspectCategory } from '../utils/proFraming';
import { createProceduralSampleVideo } from '../utils/sampleVideos';

interface VideoUploadZoneProps {
  currentVideo: VideoMetadata | null;
  onVideoLoaded: (video: VideoMetadata) => void;
  onApplyProFrame: () => void;
}

export const VideoUploadZone: React.FC<VideoUploadZoneProps> = ({
  currentVideo,
  onVideoLoaded,
  onApplyProFrame,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processVideoFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = url;

    tempVideo.onloadedmetadata = () => {
      const width = tempVideo.videoWidth || 1920;
      const height = tempVideo.videoHeight || 1080;
      const duration = tempVideo.duration || 10;
      const aspectCategory = detectAspectCategory(width, height);

      const metadata: VideoMetadata = {
        file,
        url,
        name: file.name,
        width,
        height,
        duration,
        aspectRatio: width / height,
        aspectCategory,
      };

      onVideoLoaded(metadata);
    };
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processVideoFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processVideoFile(e.target.files[0]);
    }
  };

  const handleLoadSample = async (type: 'landscape' | 'portrait') => {
    try {
      setIsLoadingSample(true);
      const sample = await createProceduralSampleVideo(type);
      onVideoLoaded(sample);
      // Auto apply pro frame after a small tick
      setTimeout(() => {
        onApplyProFrame();
      }, 100);
    } catch (err) {
      console.error('Failed to load sample video:', err);
    } finally {
      setIsLoadingSample(false);
    }
  };

  if (currentVideo) {
    return (
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-200 truncate max-w-[180px] sm:max-w-[260px]">
                {currentVideo.name}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] border border-indigo-500/30">
                {currentVideo.aspectCategory} ({currentVideo.width}×{currentVideo.height})
              </span>
            </div>
            <p className="text-neutral-400 text-[11px]">
              Duration: {currentVideo.duration.toFixed(1)}s • Aspect Ratio: {(currentVideo.aspectRatio).toFixed(2)}:1
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-all"
          >
            Replace Video
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all bg-neutral-900/40 ${
        isDragging
          ? 'border-indigo-500 bg-indigo-500/10'
          : 'border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-indigo-600/30 to-violet-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/10">
        <Upload className="w-7 h-7" />
      </div>

      <h2 className="text-base font-bold text-white mb-1">
        Upload video to frame
      </h2>
      <p className="text-xs text-neutral-400 max-w-md mx-auto mb-5">
        Drag & drop any video here. Mohammadi Academy framing, official branding, and synchronized subtitles are automatically applied every time.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all active:scale-95 cursor-pointer"
        >
          Select Video File
        </button>
      </div>

      {/* Demo sample videos for zero-friction trial */}
      <div className="pt-4 border-t border-neutral-800/80 max-w-lg mx-auto">
        <p className="text-[11px] font-medium text-neutral-400 mb-2 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Or test instantly with a demo clip:
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => handleLoadSample('landscape')}
            disabled={isLoadingSample}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700/80 transition-all flex items-center gap-1.5"
          >
            <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Load 16:9 Landscape Demo</span>
          </button>
          <button
            onClick={() => handleLoadSample('portrait')}
            disabled={isLoadingSample}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700/80 transition-all flex items-center gap-1.5"
          >
            <PlayCircle className="w-3.5 h-3.5 text-violet-400" />
            <span>Load 9:16 Portrait Demo</span>
          </button>
        </div>
        {isLoadingSample && (
          <p className="text-[10px] text-indigo-400 mt-2 flex items-center justify-center gap-1">
            <RotateCw className="w-3 h-3 animate-spin" /> Generating test video in memory...
          </p>
        )}
      </div>
    </div>
  );
};
