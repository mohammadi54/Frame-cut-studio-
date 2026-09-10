import React, { useState } from 'react';
import { Sparkles, X, Copy, Check, Wand2, Youtube, Facebook, Scissors, BrainCircuit, RefreshCw } from 'lucide-react';
import { ProjectState } from '../types';
import { PLATFORMS } from '../constants/platforms';

interface AiKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectState: ProjectState;
  onApplyTitle: (title: string) => void;
  onApplySmartAnalysis: (analysis: any) => void;
}

export const AiKitModal: React.FC<AiKitModalProps> = ({
  isOpen,
  onClose,
  projectState,
  onApplyTitle,
  onApplySmartAnalysis,
}) => {
  const [activeTab, setActiveTab] = useState<'titles' | 'kit' | 'framing'>('titles');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [topic, setTopic] = useState('');
  const [generatedTitles, setGeneratedTitles] = useState<{ title: string; style: string }[]>([]);
  const [contentKit, setContentKit] = useState<{
    youtubeDescription?: string;
    facebookCaption?: string;
    hashtags?: string[];
  } | null>(null);

  const [smartAnalysis, setSmartAnalysis] = useState<any | null>(null);

  if (!isOpen) return null;

  const currentPlatform = PLATFORMS[projectState.platform];

  const handleGenerateTitles = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/ai/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || projectState.title.text || 'Creator viral video tips',
          platform: currentPlatform.name,
          currentTitle: projectState.title.text,
        }),
      });
      const data = await res.json();
      if (data.titles) setGeneratedTitles(data.titles);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateContentKit = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/ai/content-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: projectState.title.text || 'Untitled Video',
          platform: currentPlatform.name,
          duration: projectState.video?.duration || 10,
        }),
      });
      const data = await res.json();
      setContentKit(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSmartAnalysis = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/ai/smart-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aspectCategory: projectState.video?.aspectCategory || '16:9',
          videoWidth: projectState.video?.width || 1920,
          videoHeight: projectState.video?.height || 1080,
          duration: projectState.video?.duration || 10,
          platform: currentPlatform.name,
        }),
      });
      const data = await res.json();
      setSmartAnalysis(data);
      onApplySmartAnalysis(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                AI Creator Studio
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Gemini Powered
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                Generate viral hooks, SEO descriptions, captions & smart framing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-neutral-800 px-5 pt-2 gap-2 bg-neutral-950/40">
          <button
            onClick={() => {
              setActiveTab('titles');
              if (generatedTitles.length === 0) handleGenerateTitles();
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'titles'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Viral Titles</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('kit');
              if (!contentKit) handleGenerateContentKit();
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'kit'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Youtube className="w-3.5 h-3.5 text-rose-400" />
            <span>YouTube & FB Kit</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('framing');
              if (!smartAnalysis) handleSmartAnalysis();
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'framing'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" />
            <span>Smart Auto Framing</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: Viral Titles */}
          {activeTab === 'titles' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter topic or context (e.g. 5 productivity secrets)..."
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleGenerateTitles}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Generate</span>
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-neutral-400">
                  Click any title to apply directly to your video frame banner:
                </p>

                {generatedTitles.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800 hover:border-indigo-500/50 flex items-center justify-between gap-3 group transition-all"
                  >
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {item.title}
                      </div>
                      <span className="text-[10px] text-neutral-500 mt-0.5 inline-block">
                        Style: {item.style}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        onApplyTitle(item.title);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white text-xs font-medium transition-all shrink-0"
                    >
                      Apply Title
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: YouTube Description & Facebook Caption */}
          {activeTab === 'kit' && (
            <div className="space-y-5">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
                  <span>Drafting viral description & captions...</span>
                </div>
              ) : contentKit ? (
                <>
                  {/* YouTube Section */}
                  <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                        <Youtube className="w-4 h-4" /> YouTube Description & Timestamps
                      </span>
                      <button
                        onClick={() => copyToClipboard(contentKit.youtubeDescription || '', 'yt')}
                        className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedField === 'yt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'yt' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre className="text-xs text-neutral-300 font-sans whitespace-pre-wrap bg-neutral-900/90 p-3 rounded-lg border border-neutral-800/80 max-h-40 overflow-y-auto">
                      {contentKit.youtubeDescription}
                    </pre>
                  </div>

                  {/* Facebook Caption Section */}
                  <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <Facebook className="w-4 h-4" /> Facebook Post Caption
                      </span>
                      <button
                        onClick={() => copyToClipboard(contentKit.facebookCaption || '', 'fb')}
                        className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedField === 'fb' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'fb' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre className="text-xs text-neutral-300 font-sans whitespace-pre-wrap bg-neutral-900/90 p-3 rounded-lg border border-neutral-800/80 max-h-36 overflow-y-auto">
                      {contentKit.facebookCaption}
                    </pre>
                  </div>

                  {/* Hashtags */}
                  {contentKit.hashtags && (
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      <span className="text-neutral-400 font-medium">Hashtags:</span>
                      {contentKit.hashtags.map((h, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-neutral-800 text-indigo-300 font-mono text-[11px]">
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}

          {/* TAB 3: Smart Auto Framing Analysis */}
          {activeTab === 'framing' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-tr from-emerald-950/50 to-indigo-950/50 p-4 rounded-xl border border-emerald-500/30 space-y-2">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <BrainCircuit className="w-4 h-4" /> Framing Recommendation
                </span>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {smartAnalysis?.reasoning || 'Analyzing input video geometry to compute optimal scale, padding, and backdrop contrast.'}
                </p>
              </div>

              {smartAnalysis && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                    <span className="text-neutral-500 block text-[10px]">Recommended Border</span>
                    <span className="font-bold text-white capitalize">{smartAnalysis.recommendedBorder}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                    <span className="text-neutral-500 block text-[10px]">Recommended Backdrop</span>
                    <span className="font-bold text-white capitalize">{smartAnalysis.recommendedBackground}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                    <span className="text-neutral-500 block text-[10px]">Optimal Scale</span>
                    <span className="font-mono text-indigo-300">{Math.round((smartAnalysis.suggestedScale || 0.88) * 100)}%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                    <span className="text-neutral-500 block text-[10px]">Subject Centering Offset</span>
                    <span className="font-mono text-indigo-300">{smartAnalysis.suggestedOffsetY || 0}px</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
