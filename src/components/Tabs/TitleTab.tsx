import React, { useState } from 'react';
import { Type, Sparkles, Wand2, Check, RefreshCw, Palette } from 'lucide-react';
import { TitleSettings, Platform } from '../../types';

interface TitleTabProps {
  title: TitleSettings;
  platform: Platform;
  onChange: (patch: Partial<TitleSettings>) => void;
}

const FONTS: { id: TitleSettings['font']; label: string }[] = [
  { id: 'Vazirmatn', label: 'Vazirmatn (وزیرمتن • Persian)' },
  { id: 'Amiri', label: 'Amiri (امیری • Persian Serif)' },
  { id: 'Outfit', label: 'Outfit (Modern Latin)' },
  { id: 'Bebas Neue', label: 'Bebas Neue (Viral Uppercase)' },
  { id: 'Plus Jakarta Sans', label: 'Plus Jakarta (Clean)' },
  { id: 'serif', label: 'Classic Serif' },
];

const ACADEMY_TITLE_PRESETS = [
  'آکادمی محمدی | درس‌گفتار تخصصی و پژوهشی',
  'Mohammadiacademy.org | شرح و تفسیر معارف',
  'آکادمی محمدی • حکمت، اخلاق و بصیرت',
  'Mohammadi Academy | Official Lecture Series',
];

export const TitleTab: React.FC<TitleTabProps> = ({
  title,
  platform,
  onChange,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{ title: string; style: string }[]>([]);
  const [showAiModal, setShowAiModal] = useState(false);
  const [topicInput, setTopicInput] = useState('');

  const handleGenerateTitles = async () => {
    try {
      setIsGenerating(true);
      setShowAiModal(true);
      const res = await fetch('/api/ai/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicInput || title.text || 'Shorts viral video tips',
          platform,
          currentTitle: title.text,
        }),
      });
      const data = await res.json();
      if (data.titles && Array.isArray(data.titles)) {
        setAiSuggestions(data.titles);
      }
    } catch (err) {
      console.error('Failed to generate titles:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Enable Title Toggle */}
      <div className="flex items-center justify-between bg-neutral-900/80 p-3 rounded-xl border border-neutral-800">
        <div>
          <span className="text-xs font-bold text-white block">Header Title Banner</span>
          <span className="text-[11px] text-neutral-400">
            Display headline text above the framed video
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={title.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
        </label>
      </div>

      {title.enabled && (
        <>
          {/* Title Input & AI Generator Button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Title Text
              </label>
              <button
                onClick={handleGenerateTitles}
                disabled={isGenerating}
                className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 transition-all cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>AI Viral Title Suggestions</span>
              </button>
            </div>
            <input
              type="text"
              value={title.text}
              onChange={(e) => onChange({ text: e.target.value })}
              placeholder="e.g. آکادمی محمدی | درس‌گفتار تخصصی"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-indigo-500 transition-all"
            />

            {/* Quick Mohammadi Academy title chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ACADEMY_TITLE_PRESETS.map((preset, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => onChange({ text: preset, font: preset.includes('آکادمی') ? 'Vazirmatn' : title.font })}
                  className="text-[10px] px-2 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-amber-300 transition-all cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* AI Suggestions dropdown preview if available */}
          {aiSuggestions.length > 0 && (
            <div className="bg-neutral-900/90 border border-amber-500/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Viral Title Ideas
                </span>
                <button
                  onClick={handleGenerateTitles}
                  className="text-[10px] text-neutral-400 hover:text-neutral-200 flex items-center gap-0.5"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Re-generate
                </button>
              </div>
              <div className="space-y-1.5">
                {aiSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => onChange({ text: item.title })}
                    className="w-full text-left p-2 rounded-lg bg-neutral-950/70 hover:bg-indigo-950/50 border border-neutral-800/80 hover:border-indigo-500/40 text-xs text-neutral-200 flex items-center justify-between group transition-all"
                  >
                    <span className="font-medium truncate pr-2">{item.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 shrink-0 group-hover:text-indigo-300">
                      {item.style}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Font Family Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Typography Font
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onChange({ font: f.id })}
                  className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all ${
                    title.font === f.id
                      ? 'border-indigo-500 bg-indigo-950/40 text-white'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Position & Size */}
          <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300">Vertical Position</span>
                <span className="font-mono text-indigo-300">{title.positionY}% from top</span>
              </div>
              <input
                type="range"
                min="4"
                max="85"
                step="1"
                value={title.positionY}
                onChange={(e) => onChange({ positionY: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300">Font Scale</span>
                <span className="font-mono text-indigo-300">{title.size}pt</span>
              </div>
              <input
                type="range"
                min="18"
                max="64"
                step="2"
                value={title.size}
                onChange={(e) => onChange({ size: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-neutral-800 rounded appearance-none accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Background Card / Pill Option */}
          <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-white block">Background Pill Card</span>
                <span className="text-[10px] text-neutral-400">High contrast backing behind text</span>
              </div>
              <input
                type="checkbox"
                checked={title.backgroundEnabled}
                onChange={(e) => onChange({ backgroundEnabled: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            {title.backgroundEnabled && (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-400">Pill Color:</span>
                  <input
                    type="color"
                    value={title.backgroundColor}
                    onChange={(e) => onChange({ backgroundColor: e.target.value })}
                    className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-neutral-400">Text Color:</span>
                  <input
                    type="color"
                    value={title.color}
                    onChange={(e) => onChange({ color: e.target.value })}
                    className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
