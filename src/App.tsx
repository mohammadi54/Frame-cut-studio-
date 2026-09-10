import React, { useState, useRef, useEffect } from 'react';
import { 
  Layers, 
  Crop, 
  Type, 
  MessageSquareQuote, 
  ShieldCheck, 
  Sparkles, 
  Wand2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  ProjectState, 
  Platform, 
  VideoMetadata, 
  VideoTransform, 
  TitleSettings, 
  SubtitleSettings, 
  LogoSettings, 
  WatermarkSettings,
  AudioSettings 
} from './types';
import { PLATFORMS } from './constants/platforms';
import { applyProfessionalFrame } from './utils/proFraming';
import { exportCompositeVideo, ExportProgress, ExportJob, capturePosterSnapshot, downloadBlob } from './utils/videoExporter';
import { transcribeVideoSpeech } from './utils/audioTranscriber';
import { ensureFullDurationCoverage } from './utils/subtitleUtils';

import { Header } from './components/Header';
import { VideoUploadZone } from './components/VideoUploadZone';
import { VideoPreviewCanvas } from './components/VideoPreviewCanvas';
import { FrameTab } from './components/Tabs/FrameTab';
import { TransformTab } from './components/Tabs/TransformTab';
import { TitleTab } from './components/Tabs/TitleTab';
import { SubtitlesTab } from './components/Tabs/SubtitlesTab';
import { BrandingTab } from './components/Tabs/BrandingTab';
import { AiKitModal } from './components/AiKitModal';
import { ExportModal } from './components/ExportModal';
import { BackgroundExportWidget } from './components/BackgroundExportWidget';

const INITIAL_STATE: ProjectState = {
  video: null,
  platform: 'shorts', // default to popular Shorts/Reels vertical
  frameStyle: 'mohammadi-gold',
  background: 'mohammadi-royal',
  customBackgroundColor: '#030a16',
  transform: {
    scale: 0.92,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    flipH: false,
    flipV: false,
  },
  trim: {
    start: 0,
    end: 10,
    duration: 10,
  },
  audio: {
    volume: 1.0,
    muted: false,
    boost: false,
  },
  title: {
    enabled: true,
    text: 'آکادمی محمدی | درس‌گفتار تخصصی و پژوهشی',
    font: 'Vazirmatn',
    size: 34,
    color: '#ffffff',
    backgroundColor: 'rgba(5, 13, 26, 0.88)',
    backgroundEnabled: true,
    positionY: 12,
    letterSpacing: 0,
  },
  subtitles: {
    enabled: true,
    language: 'bilingual',
    items: [
      { 
        id: '1', 
        start: 0.0, 
        end: 2.8, 
        text: 'به آکادمی محمدی خوش آمدید', 
        translation: 'Welcome to Mohammadi Academy', 
        highlight: 'محمدی' 
      },
      { 
        id: '2', 
        start: 2.9, 
        end: 5.6, 
        text: 'مرکز تخصصی حکمت، اخلاق و معارف', 
        translation: 'Center for Wisdom, Ethics & Knowledge', 
        highlight: 'حکمت' 
      },
      { 
        id: '3', 
        start: 5.7, 
        end: 9.0, 
        text: 'پایگاه رسمی ما: Mohammadiacademy.org', 
        translation: 'Official Portal: Mohammadiacademy.org', 
        highlight: 'Mohammadiacademy.org' 
      },
    ],
    style: 'academic-gold',
    positionY: 18,
    fontSize: 30,
    primaryColor: '#ffffff',
    highlightColor: '#facc15',
    fontFamily: 'Vazirmatn',
  },
  logo: {
    enabled: true,
    url: null,
    preset: 'mohammadi-crest',
    size: 65,
    opacity: 0.95,
    position: 'top-right',
  },
  watermark: {
    enabled: true,
    text: 'Mohammadiacademy.org',
    opacity: 0.85,
    position: 'bottom-right',
  },
};

type ActiveSidebarTab = 'frame' | 'transform' | 'title' | 'subtitles' | 'branding';

export default function App() {
  const [projectState, setProjectState] = useState<ProjectState>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<ActiveSidebarTab>('frame');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    status: 'idle',
    progress: 0,
  });

  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const exportJobRef = useRef<ExportJob | null>(null);

  // Show friendly notification toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Auto-generate and apply synchronized speech subtitles whenever a video is loaded
  const autoGenerateAndApplySubtitles = async (video: VideoMetadata) => {
    try {
      const language = projectState.subtitles.language || 'bilingual';
      const duration = video.duration || 10;
      const title = video.name || projectState.title.text;

      // Listen to speech in the video audio track and transcribe
      const rawItems = await transcribeVideoSpeech({
        source: video.file || hiddenVideoRef.current,
        language,
        duration,
        title,
      });

      const items = ensureFullDurationCoverage(rawItems, duration, language, title);

      if (items && items.length > 0) {
        setProjectState((prev) => ({
          ...prev,
          subtitles: {
            ...prev.subtitles,
            enabled: true,
            items,
            language,
            style: prev.subtitles.style || 'academic-gold',
            fontFamily: language === 'en' ? 'Outfit' : 'Vazirmatn',
          },
        }));
        showToast('✨ Subtitles automatically applied for entire video (100% duration)!');
      }
    } catch (err) {
      console.warn('Auto-subtitle extraction error, ensuring baseline academic subtitles:', err);
      // Fallback AI subtitles if direct stream fails
      try {
        const duration = video.duration || 10;
        const language = projectState.subtitles.language || 'bilingual';
        const title = video.name || projectState.title.text;

        const res = await fetch('/api/ai/subtitles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            duration,
            language,
          }),
        });
        const data = await res.json();
        if (data.subtitles && Array.isArray(data.subtitles)) {
          const fullItems = ensureFullDurationCoverage(data.subtitles, duration, language, title);
          setProjectState((prev) => ({
            ...prev,
            subtitles: {
              ...prev.subtitles,
              enabled: true,
              items: fullItems,
              language,
              style: prev.subtitles.style || 'academic-gold',
              fontFamily: language === 'en' ? 'Outfit' : 'Vazirmatn',
            },
          }));
          showToast('✨ Subtitles automatically applied for full video duration!');
        }
      } catch (e) {
        // Keep baseline state with enabled: true
      }
    }
  };

  // Video Loaded Handler: applies framing and subtitles automatically every time
  const handleVideoLoaded = (video: VideoMetadata) => {
    // 1. Calculate intelligent framing with Mohammadi Academy rules
    const proFrameResult = applyProfessionalFrame(
      video,
      projectState.platform,
      projectState
    );

    // 2. Set video, trim, and activate subtitles automatically
    setProjectState((prev) => ({
      ...prev,
      video,
      ...proFrameResult.newState,
      trim: {
        start: 0,
        end: video.duration || 10,
        duration: video.duration || 10,
      },
      subtitles: {
        ...prev.subtitles,
        enabled: true,
        style: prev.subtitles.style || 'academic-gold',
        language: prev.subtitles.language || 'bilingual',
        fontFamily: prev.subtitles.language === 'en' ? 'Outfit' : 'Vazirmatn',
      },
    }));

    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.src = video.url;
      hiddenVideoRef.current.load();
    }

    showToast(`Loaded "${video.name}" • Automatically framing & generating subtitles...`);

    // 3. Immediately trigger automatic speaker voice transcription / subtitles
    autoGenerateAndApplySubtitles(video);
  };

  // Platform Change Handler
  const handlePlatformChange = (platform: Platform) => {
    setProjectState((prev) => {
      const next = { ...prev, platform };
      // If a video exists, intelligently adapt framing
      if (prev.video) {
        const result = applyProfessionalFrame(prev.video, platform, next);
        return {
          ...next,
          ...result.newState,
        };
      }
      return next;
    });
  };

  // The Key Feature: Apply Professional Frame Button
  const handleApplyProFrame = () => {
    if (!projectState.video) return;
    const result = applyProfessionalFrame(
      projectState.video,
      projectState.platform,
      projectState
    );

    setProjectState((prev) => ({
      ...prev,
      ...result.newState,
    }));

    showToast(`✨ ${result.matchedRule}: ${result.description}`);
  };

  // Background Export Logic
  const handleStartExport = () => {
    if (!hiddenVideoRef.current) return;

    if (exportJobRef.current) {
      exportJobRef.current.cancel();
    }

    setExportProgress({ status: 'rendering', progress: 0 });

    const job = exportCompositeVideo(
      hiddenVideoRef.current,
      projectState,
      PLATFORMS[projectState.platform],
      (p) => {
        setExportProgress(p);
        if (p.status === 'completed') {
          showToast(`🎉 Background export finished!`);
        } else if (p.status === 'error') {
          showToast(`⚠️ Export error: ${p.errorMessage || 'Failed'}`);
        }
      }
    );

    exportJobRef.current = job;
  };

  const handleCancelExport = () => {
    if (exportJobRef.current) {
      exportJobRef.current.cancel();
      exportJobRef.current = null;
    }
    setExportProgress({ status: 'idle', progress: 0 });
    showToast('Background export cancelled.');
  };

  const handleTakeSnapshot = () => {
    if (!hiddenVideoRef.current) return;
    const curTime = hiddenVideoRef.current.currentTime || 0;
    const dataUrl = capturePosterSnapshot(
      hiddenVideoRef.current,
      projectState,
      PLATFORMS[projectState.platform],
      curTime
    );
    downloadBlob(dataUrl, `FrameCut_Snapshot_${Date.now()}.png`);
    showToast('📸 Saved high-res PNG poster frame snapshot!');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-['Plus_Jakarta_Sans']">
      {/* Hidden Source Video Element Driving Canvas */}
      <video
        ref={hiddenVideoRef}
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        className="hidden"
      />

      {/* Global Header */}
      <Header
        projectState={projectState}
        onPlatformChange={handlePlatformChange}
        onApplyProFrame={handleApplyProFrame}
        onOpenExport={() => {
          setExportProgress({ status: 'idle', progress: 0 });
          setIsExportModalOpen(true);
        }}
        onOpenAiKit={() => setIsAiModalOpen(true)}
        onTakeSnapshot={handleTakeSnapshot}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/95 border border-indigo-500/40 px-4 py-2.5 rounded-xl shadow-2xl shadow-indigo-500/20 text-xs font-medium text-white flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col lg:flex-row gap-5">
        {/* Left Side: Video Upload + Canvas Preview + Timeline */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <VideoUploadZone
            currentVideo={projectState.video}
            onVideoLoaded={handleVideoLoaded}
            onApplyProFrame={handleApplyProFrame}
          />

          <div className="flex-1">
            <VideoPreviewCanvas
              projectState={projectState}
              onTrimChange={(start, end) =>
                setProjectState((prev) => ({
                  ...prev,
                  trim: { ...prev.trim, start, end },
                }))
              }
              onAudioChange={(volume, muted) =>
                setProjectState((prev) => ({
                  ...prev,
                  audio: { ...prev.audio, volume, muted },
                }))
              }
              onTransformChange={(patch) =>
                setProjectState((prev) => ({
                  ...prev,
                  transform: { ...prev.transform, ...patch },
                }))
              }
              onLogoChange={(patch) =>
                setProjectState((prev) => ({
                  ...prev,
                  logo: { ...prev.logo, ...patch },
                }))
              }
              videoRef={hiddenVideoRef}
            />
          </div>
        </div>

        {/* Right Side: Tools & Inspector Sidebar */}
        <div className="w-full lg:w-[410px] shrink-0 bg-neutral-900/80 border border-neutral-800/90 rounded-2xl flex flex-col overflow-hidden shadow-xl">
          {/* Sidebar Tabs Bar */}
          <div className="flex items-center border-b border-neutral-800 bg-neutral-950/60 p-1.5 gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('frame')}
              className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'frame'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Frame</span>
            </button>

            <button
              onClick={() => setActiveTab('transform')}
              className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'transform'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              <span>Transform</span>
            </button>

            <button
              onClick={() => setActiveTab('title')}
              className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'title'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Title</span>
            </button>

            <button
              onClick={() => setActiveTab('subtitles')}
              className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'subtitles'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              <MessageSquareQuote className="w-3.5 h-3.5" />
              <span>Captions</span>
            </button>

            <button
              onClick={() => setActiveTab('branding')}
              className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'branding'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Brand</span>
            </button>
          </div>

          {/* Active Tab Panel Body */}
          <div className="p-4 flex-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {activeTab === 'frame' && (
              <FrameTab
                projectState={projectState}
                onUpdateState={(patch) =>
                  setProjectState((prev) => ({ ...prev, ...patch }))
                }
                onApplyProFrame={handleApplyProFrame}
              />
            )}

            {activeTab === 'transform' && (
              <TransformTab
                transform={projectState.transform}
                onChange={(patch) =>
                  setProjectState((prev) => ({
                    ...prev,
                    transform: { ...prev.transform, ...patch },
                  }))
                }
                onReset={() =>
                  setProjectState((prev) => ({
                    ...prev,
                    transform: INITIAL_STATE.transform,
                  }))
                }
                onAutoCenter={() =>
                  setProjectState((prev) => ({
                    ...prev,
                    transform: { ...prev.transform, offsetX: 0, offsetY: 0 },
                  }))
                }
              />
            )}

            {activeTab === 'title' && (
              <TitleTab
                title={projectState.title}
                platform={projectState.platform}
                onChange={(patch) =>
                  setProjectState((prev) => ({
                    ...prev,
                    title: { ...prev.title, ...patch },
                  }))
                }
              />
            )}

            {activeTab === 'subtitles' && (
              <SubtitlesTab
                subtitles={projectState.subtitles}
                videoDuration={projectState.video?.duration || 10}
                videoTitle={projectState.title.text}
                videoElement={hiddenVideoRef.current}
                onChange={(patch) =>
                  setProjectState((prev) => ({
                    ...prev,
                    subtitles: { ...prev.subtitles, ...patch },
                  }))
                }
              />
            )}

            {activeTab === 'branding' && (
              <BrandingTab
                logo={projectState.logo}
                watermark={projectState.watermark}
                audio={projectState.audio}
                onUpdateLogo={(patch) =>
                  setProjectState((prev) => ({
                    ...prev,
                    logo: { ...prev.logo, ...patch },
                  }))
                }
                onUpdateWatermark={(patch) =>
                  setProjectState((prev) => ({
                    ...prev,
                    watermark: { ...prev.watermark, ...patch },
                  }))
                }
                onUpdateAudio={(patch) =>
                  setProjectState((prev) => ({
                    ...prev,
                    audio: { ...prev.audio, ...patch },
                  }))
                }
              />
            )}
          </div>
        </div>
      </main>

      {/* AI Creator Kit Modal */}
      <AiKitModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        projectState={projectState}
        onApplyTitle={(newTitle) =>
          setProjectState((prev) => ({
            ...prev,
            title: { ...prev.title, text: newTitle, enabled: true },
          }))
        }
        onApplySmartAnalysis={(analysis) => {
          if (analysis.suggestedScale) {
            setProjectState((prev) => ({
              ...prev,
              transform: {
                ...prev.transform,
                scale: analysis.suggestedScale,
                offsetY: analysis.suggestedOffsetY || 0,
              },
            }));
          }
        }}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        progress={exportProgress}
        platform={PLATFORMS[projectState.platform]}
        onStartExport={handleStartExport}
        onTakeSnapshot={handleTakeSnapshot}
        onCancelExport={handleCancelExport}
      />

      {/* Persistent Floating Background Export Widget */}
      <BackgroundExportWidget
        progress={exportProgress}
        platform={PLATFORMS[projectState.platform]}
        onCancel={handleCancelExport}
        onDismiss={() => setExportProgress({ status: 'idle', progress: 0 })}
        onExpand={() => setIsExportModalOpen(true)}
      />
    </div>
  );
}
