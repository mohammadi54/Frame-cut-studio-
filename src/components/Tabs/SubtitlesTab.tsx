import React, { useState } from 'react';
import { 
  Sparkles, 
  Languages, 
  Plus, 
  Trash2, 
  Clock, 
  Check, 
  RefreshCw, 
  Mic, 
  Volume2, 
  Globe, 
  BookOpen 
} from 'lucide-react';
import { SubtitleSettings, SubtitleStyle, SubtitleItem, SubtitleLanguage } from '../../types';
import { transcribeVideoSpeech } from '../../utils/audioTranscriber';

interface SubtitlesTabProps {
  subtitles: SubtitleSettings;
  videoDuration: number;
  videoTitle: string;
  videoElement?: HTMLVideoElement | null;
  onChange: (patch: Partial<SubtitleSettings>) => void;
}

const SUBTITLE_STYLES: { id: SubtitleStyle; label: string; desc: string }[] = [
  { id: 'academic-gold', label: 'Mohammadi Gold ⚜️', desc: 'Royal navy pill with 24k gold trim & academic typography' },
  { id: 'hormozi', label: 'Hormozi Viral Pop', desc: 'Bold uppercase with yellow active keyword pop' },
  { id: 'modern-pill', label: 'Modern Pill', desc: 'Curved translucent dark pill container' },
  { id: 'minimal-shadow', label: 'Minimal Glow', desc: 'Clean high-contrast text with diffuse drop shadow' },
  { id: 'classic-box', label: 'Classic Box', desc: 'Standard solid black scholarly subtitle box' },
];

const QUICK_LANGUAGES: { id: SubtitleLanguage; label: string; subLabel: string; flag: string }[] = [
  { id: 'bilingual', label: 'Bilingual Dual', subLabel: 'Persian + English', flag: '🇮🇷/🇬🇧' },
  { id: 'fa', label: 'Persian (فارسی)', subLabel: 'Mohammadi Academy', flag: '🇮🇷' },
  { id: 'en', label: 'English', subLabel: 'International', flag: '🇬🇧' },
];

export const SubtitlesTab: React.FC<SubtitlesTabProps> = ({
  subtitles,
  videoDuration,
  videoTitle,
  videoElement,
  onChange,
}) => {
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedLanguage: SubtitleLanguage = subtitles.language || 'bilingual';

  const handleLanguageChange = (lang: SubtitleLanguage) => {
    onChange({ 
      language: lang,
      fontFamily: lang === 'fa' || lang === 'bilingual' ? 'Vazirmatn' : subtitles.fontFamily,
      style: subtitles.style || 'academic-gold',
    });
  };

  // 1. Core Feature: Automatic Speech-to-Subtitles from Speaker's Voice
  const handleAutoTranscribeSpeakerVoice = async () => {
    try {
      setIsTranscribingVoice(true);
      setStatusMessage('Extracting audio track from video & transcribing speaker voice...');

      const items = await transcribeVideoSpeech({
        source: videoElement || null,
        language: selectedLanguage,
        duration: videoDuration || 15,
        title: videoTitle || 'Mohammadi Academy Lecture',
      });

      if (items && items.length > 0) {
        onChange({
          enabled: true,
          language: selectedLanguage,
          style: subtitles.style || 'academic-gold',
          fontFamily: selectedLanguage === 'en' ? 'Outfit' : 'Vazirmatn',
          items,
        });
        setStatusMessage(`Transcribed ${items.length} synchronized speech cues in ${selectedLanguage.toUpperCase()}!`);
      } else {
        setStatusMessage('No speech cues generated.');
      }
    } catch (err: any) {
      console.error('Speech transcription failed, falling back to script generation:', err);
      // Graceful fallback to text-based AI generator
      handleFallbackTextGenerator();
    } finally {
      setIsTranscribingVoice(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Fallback AI generator if direct audio stream is silent
  const handleFallbackTextGenerator = async () => {
    try {
      setStatusMessage('Generating synchronized subtitles via AI...');
      const res = await fetch('/api/ai/subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: videoTitle || 'Mohammadi Academy Official Lecture',
          duration: videoDuration || 15,
          language: selectedLanguage,
        }),
      });
      const data = await res.json();
      if (data.subtitles && Array.isArray(data.subtitles)) {
        onChange({
          enabled: true,
          language: selectedLanguage,
          items: data.subtitles,
        });
        setStatusMessage(`Generated ${data.subtitles.length} subtitle cues!`);
      }
    } catch (fallbackErr) {
      console.error('Fallback subtitle generation failed:', fallbackErr);
      setStatusMessage('Generation failed. Please try again.');
    }
  };

  // 2. Bilingual and Target Language Translation
  const handleTranslateAll = async (targetLang: 'Persian' | 'English' | 'Bilingual') => {
    if (subtitles.items.length === 0) return;
    try {
      setIsTranslating(true);
      setStatusMessage(`Translating captions to ${targetLang}...`);
      const res = await fetch('/api/ai/translate-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles: subtitles.items,
          targetLanguage: targetLang,
        }),
      });
      const data = await res.json();
      if (data.subtitles && Array.isArray(data.subtitles)) {
        onChange({ 
          items: data.subtitles,
          language: targetLang === 'Persian' ? 'fa' : targetLang === 'English' ? 'en' : 'bilingual',
        });
        setStatusMessage(`Successfully translated to ${targetLang}!`);
      }
    } catch (err) {
      console.error('Translation failed:', err);
      setStatusMessage('Translation failed. Check connection.');
    } finally {
      setIsTranslating(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handleUpdateItem = (id: string, field: keyof SubtitleItem, value: any) => {
    const updated = subtitles.items.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    onChange({ items: updated });
  };

  const handleDeleteItem = (id: string) => {
    onChange({ items: subtitles.items.filter((item) => item.id !== id) });
  };

  const handleAddItem = () => {
    const lastItem = subtitles.items[subtitles.items.length - 1];
    const newStart = lastItem ? Number((lastItem.end + 0.2).toFixed(1)) : 0;
    const newEnd = Number((newStart + 2.4).toFixed(1));
    const newItem: SubtitleItem = {
      id: Date.now().toString(),
      start: newStart,
      end: newEnd,
      text: selectedLanguage === 'en' ? 'New lecture subtitle phrase' : 'فراز جدید از درس‌گفتار',
      translation: selectedLanguage === 'bilingual' ? 'New lecture phrase translation' : undefined,
      highlight: selectedLanguage === 'en' ? 'lecture' : 'درس‌گفتار',
    };
    onChange({ items: [...subtitles.items, newItem] });
  };

  return (
    <div className="space-y-6">
      {/* Enable Subtitles Toggle */}
      <div className="flex items-center justify-between bg-neutral-900/80 p-3 rounded-xl border border-neutral-800">
        <div>
          <span className="text-xs font-bold text-white block">Subtitles & Captions</span>
          <span className="text-[11px] text-neutral-400">
            Show timed on-screen speech captions (English & Persian)
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={subtitles.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
        </label>
      </div>

      {subtitles.enabled && (
        <>
          {/* Language Selector: English, Persian, or Bilingual */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Caption Language Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_LANGUAGES.map((lang) => {
                const isSelected = selectedLanguage === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => handleLanguageChange(lang.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-950/40 text-white shadow-md shadow-amber-500/10'
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      {lang.subLabel}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Automatic Speaker Voice Transcription Action */}
          <div className="bg-gradient-to-r from-amber-950/40 via-neutral-900 to-indigo-950/40 p-4 rounded-xl border border-amber-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-amber-400" />
                <span>Automatic Speaker Speech Recognition</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Gemini Audio AI
              </span>
            </div>

            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Automatically listens to the speaker's voice in the video and generates timed 
              <span className="text-amber-300 font-semibold"> {selectedLanguage === 'bilingual' ? 'Persian & English Bilingual' : selectedLanguage === 'fa' ? 'Persian (فارسی)' : 'English'} </span> 
              subtitles with keyword highlights.
            </p>

            <button
              type="button"
              onClick={handleAutoTranscribeSpeakerVoice}
              disabled={isTranscribingVoice}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:brightness-110 text-neutral-950 text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isTranscribingVoice ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-neutral-950" />
                  <span>Transcribing Speaker Speech...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-neutral-950" />
                  <span>🎙️ Auto-Generate Subtitles From Speaker Voice</span>
                </>
              )}
            </button>

            {statusMessage && (
              <div className="text-[11px] text-amber-300 font-medium text-center bg-amber-950/60 py-1 px-2 rounded-lg border border-amber-500/30">
                {statusMessage}
              </div>
            )}

            {/* Quick Translation & Conversion Tools */}
            <div className="flex items-center gap-2 pt-1 border-t border-neutral-800">
              <span className="text-[10px] text-neutral-400 font-medium">Quick Translate:</span>
              <button
                type="button"
                onClick={() => handleTranslateAll('Persian')}
                disabled={isTranslating || subtitles.items.length === 0}
                className="text-[10px] px-2 py-1 rounded bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-amber-300 transition-all cursor-pointer disabled:opacity-40"
              >
                🇮🇷 To Persian
              </button>
              <button
                type="button"
                onClick={() => handleTranslateAll('English')}
                disabled={isTranslating || subtitles.items.length === 0}
                className="text-[10px] px-2 py-1 rounded bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-amber-300 transition-all cursor-pointer disabled:opacity-40"
              >
                🇬🇧 To English
              </button>
              <button
                type="button"
                onClick={() => handleTranslateAll('Bilingual')}
                disabled={isTranslating || subtitles.items.length === 0}
                className="text-[10px] px-2 py-1 rounded bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-amber-300 transition-all cursor-pointer disabled:opacity-40"
              >
                ⚜️ Make Bilingual
              </button>
            </div>
          </div>

          {/* Subtitle Visual Styles */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
              Caption Style Preset
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SUBTITLE_STYLES.map((st) => {
                const isSelected = (subtitles.style || 'academic-gold') === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => onChange({ style: st.id })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-950/30 text-white'
                        : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-200">{st.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                      {st.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Position & Font Size */}
          <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300">Position From Bottom</span>
                <span className="font-mono text-amber-300">{subtitles.positionY}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="65"
                step="1"
                value={subtitles.positionY}
                onChange={(e) => onChange({ positionY: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-neutral-800 rounded appearance-none accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300">Font Scale</span>
                <span className="font-mono text-amber-300">{subtitles.fontSize}pt</span>
              </div>
              <input
                type="range"
                min="18"
                max="54"
                step="2"
                value={subtitles.fontSize}
                onChange={(e) => onChange({ fontSize: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-neutral-800 rounded appearance-none accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Interactive Timed Subtitles List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Timeline Subtitle Cues ({subtitles.items.length})
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Cue
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {subtitles.items.map((item) => {
                const isPersian = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(item.text);
                return (
                  <div
                    key={item.id}
                    className="bg-neutral-900/90 border border-neutral-800 p-2.5 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-neutral-400 font-mono text-[11px]">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <input
                          type="number"
                          step="0.1"
                          value={item.start}
                          onChange={(e) => handleUpdateItem(item.id, 'start', parseFloat(e.target.value))}
                          className="w-12 bg-neutral-950 border border-neutral-800 rounded px-1 text-center text-white"
                        />
                        <span>→</span>
                        <input
                          type="number"
                          step="0.1"
                          value={item.end}
                          onChange={(e) => handleUpdateItem(item.id, 'end', parseFloat(e.target.value))}
                          className="w-12 bg-neutral-950 border border-neutral-800 rounded px-1 text-center text-white"
                        />
                        <span>s</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-neutral-500 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                        title="Delete cue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Primary Text */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5 text-[10px] text-neutral-400">
                        <span>{isPersian ? 'فارسی (Persian Speech)' : 'Primary Text'}</span>
                      </div>
                      <input
                        type="text"
                        value={item.text}
                        dir={isPersian ? 'rtl' : 'ltr'}
                        onChange={(e) => handleUpdateItem(item.id, 'text', e.target.value)}
                        placeholder="Subtitle text..."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-500 font-medium"
                      />
                    </div>

                    {/* Translation row (for bilingual or when translation exists) */}
                    {(selectedLanguage === 'bilingual' || item.translation !== undefined) && (
                      <div>
                        <div className="flex items-center justify-between mb-0.5 text-[10px] text-amber-400/90">
                          <span>English Translation (ترجمه انگلیسی)</span>
                        </div>
                        <input
                          type="text"
                          dir="ltr"
                          value={item.translation || ''}
                          onChange={(e) => handleUpdateItem(item.id, 'translation', e.target.value)}
                          placeholder="English translation..."
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-amber-200 focus:outline-none focus:border-amber-500 text-xs"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[11px] pt-0.5">
                      <span className="text-neutral-500">Highlight word:</span>
                      <input
                        type="text"
                        value={item.highlight || ''}
                        onChange={(e) => handleUpdateItem(item.id, 'highlight', e.target.value)}
                        placeholder="Word to emphasize..."
                        className="bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-amber-300 text-[11px] focus:outline-none w-36"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
