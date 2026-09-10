import { SubtitleItem, SubtitleLanguage } from '../types';

export interface SubtitleCoverageInfo {
  coveredEnd: number;
  totalDuration: number;
  percent: number;
  remainingSeconds: number;
  isFullCoverage: boolean;
  itemCount: number;
}

/**
 * Calculates how much of the video timeline is actively covered by subtitles.
 */
export function calculateSubtitleCoverage(
  items: SubtitleItem[],
  totalDuration: number
): SubtitleCoverageInfo {
  const dur = Math.max(1, totalDuration || 10);
  if (!items || items.length === 0) {
    return {
      coveredEnd: 0,
      totalDuration: dur,
      percent: 0,
      remainingSeconds: Number(dur.toFixed(1)),
      isFullCoverage: false,
      itemCount: 0,
    };
  }

  const maxEnd = items.reduce((max, item) => Math.max(max, Number(item.end) || 0), 0);
  const clampedEnd = Math.min(dur, Math.max(0, maxEnd));
  const remainingSeconds = Math.max(0, Number((dur - clampedEnd).toFixed(1)));
  const percent = Math.min(100, Math.max(0, Math.round((clampedEnd / dur) * 100)));
  const isFullCoverage = remainingSeconds <= 0.3;

  return {
    coveredEnd: clampedEnd,
    totalDuration: dur,
    percent: isFullCoverage ? 100 : percent,
    remainingSeconds,
    isFullCoverage,
    itemCount: items.length,
  };
}

/**
 * High-quality scholarly and academic phrases for Mohammadi Academy
 * used to seamlessly fill remaining video segments if offline or network fails.
 */
const ACADEMIC_FILL_PHRASES = {
  fa: [
    { text: 'گسترش آگاهی و اخلاق در سایه پژوهش‌های دینی', highlight: 'پژوهش‌های' },
    { text: 'بررسی ژرف مبانی اندیشه و تمدن معاصر', highlight: 'اندیشه' },
    { text: 'تحلیل تطبیقی علوم و ارتقای فهم معنوی', highlight: 'معنوی' },
    { text: 'پیوند میان تفکر عقلانی و بصیرت معرفتی', highlight: 'بصیرت' },
    { text: 'آشنایی با درس‌گفتارهای برگزیده و منابع تخصصی', highlight: 'درس‌گفتارها' },
    { text: 'نقش علم و ایمان در پیشرفت انسان معاصر', highlight: 'پیشرفت' },
    { text: 'آموزش گام‌به‌گام و دسترسی آزاد به معارف', highlight: 'معارف' },
    { text: 'جهت مطالعه مقالات و پیگیری دوره‌ها', highlight: 'دوره‌ها' },
    { text: 'به وب‌سایت رسمی آکادمی محمدی مراجعه فرمایید', highlight: 'آکادمی' },
    { text: 'نشانی رسمی: Mohammadiacademy.org', highlight: 'Mohammadiacademy.org' },
  ],
  en: [
    { text: 'Deepening scholarly reflection and intellectual clarity', highlight: 'clarity' },
    { text: 'Bridging rational inquiry with enduring wisdom', highlight: 'wisdom' },
    { text: 'Exploring foundational principles in contemporary thought', highlight: 'contemporary' },
    { text: 'Dedicated research for ethical enlightenment', highlight: 'research' },
    { text: 'Structured lectures designed for advanced students', highlight: 'lectures' },
    { text: 'Fostering academic dialogue across diverse horizons', highlight: 'dialogue' },
    { text: 'Discover comprehensive series and research archives', highlight: 'archives' },
    { text: 'Continuing our commitment to scholarly excellence', highlight: 'excellence' },
    { text: 'Visit the official portal of Mohammadi Academy', highlight: 'Academy' },
    { text: 'Official resource hub: Mohammadiacademy.org', highlight: 'Mohammadiacademy.org' },
  ],
  bilingual: [
    { 
      text: 'گسترش آگاهی و حکمت در پژوهش‌های معاصر', 
      translation: 'Expanding wisdom and intellectual clarity in contemporary studies', 
      highlight: 'حکمت' 
    },
    { 
      text: 'بررسی ژرف مبانی اخلاق و اندیشه راستین', 
      translation: 'Deep exploration of ethical thought and enduring truth', 
      highlight: 'اندیشه' 
    },
    { 
      text: 'پیوند میان تفکر عقلانی و معرفت معنوی', 
      translation: 'Bridging rational inquiry with spiritual knowledge', 
      highlight: 'معرفت' 
    },
    { 
      text: 'ارائه درس‌گفتارهای تخصصی برای پژوهشگران', 
      translation: 'Specialized lectures crafted for advanced researchers', 
      highlight: 'درس‌گفتارها' 
    },
    { 
      text: 'جهت مطالعه مقالات تکمیلی و دریافت دوره‌ها', 
      translation: 'To explore supplementary articles and enroll in courses', 
      highlight: 'مقالات' 
    },
    { 
      text: 'به درگاه رسمی آکادمی محمدی مراجعه فرمایید', 
      translation: 'Visit the official portal of Mohammadi Academy', 
      highlight: 'آکادمی' 
    },
    { 
      text: 'پایگاه معارف و پژوهش: Mohammadiacademy.org', 
      translation: 'Official Research Portal: Mohammadiacademy.org', 
      highlight: 'Mohammadiacademy.org' 
    },
  ]
};

/**
 * Generates local fallback cues to seamlessly fill a time span [startTime, endTime].
 */
export function generateLocalFillCues(
  startTime: number,
  endTime: number,
  language: SubtitleLanguage,
  baseIndex = 1
): SubtitleItem[] {
  const span = Math.max(1, endTime - startTime);
  const targetCues = Math.max(1, Math.round(span / 3.2));
  const step = span / targetCues;

  const phrasePool = ACADEMIC_FILL_PHRASES[language] || ACADEMIC_FILL_PHRASES.bilingual;
  const newCues: SubtitleItem[] = [];

  for (let i = 0; i < targetCues; i++) {
    const cueStart = Number((startTime + i * step).toFixed(1));
    const cueEnd = i === targetCues - 1 
      ? Number(endTime.toFixed(1)) 
      : Number((startTime + (i + 1) * step).toFixed(1));

    const phrase = phrasePool[(baseIndex + i) % phrasePool.length];

    newCues.push({
      id: `cue-fill-${Date.now()}-${i + 1}`,
      start: cueStart,
      end: Math.max(cueStart + 0.5, cueEnd),
      text: phrase.text,
      translation: 'translation' in phrase ? (phrase as any).translation : undefined,
      highlight: phrase.highlight,
    });
  }

  return newCues;
}

/**
 * Calls backend API to complete subtitles for remaining duration of the video.
 * If server fails, gracefully uses high-quality local generator to ensure 100% video coverage.
 */
export async function completeRemainingVideoSubtitles({
  existingItems,
  totalDuration,
  language,
  title,
}: {
  existingItems: SubtitleItem[];
  totalDuration: number;
  language: SubtitleLanguage;
  title?: string;
}): Promise<SubtitleItem[]> {
  const duration = Math.max(2, totalDuration);
  
  // Find where existing items end
  let lastEnd = 0;
  if (existingItems && existingItems.length > 0) {
    lastEnd = existingItems.reduce((max, item) => Math.max(max, Number(item.end) || 0), 0);
  }

  // If already at or beyond video duration, return current items
  if (lastEnd >= duration - 0.3) {
    return existingItems;
  }

  const startTime = Number(lastEnd.toFixed(1));
  const endTime = Number(duration.toFixed(1));

  try {
    const res = await fetch('/api/ai/complete-subtitles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startTime,
        endTime,
        duration,
        language,
        title: title || 'Mohammadi Academy Lecture',
        existingSubtitles: existingItems.slice(-3),
      }),
    });

    const data = await res.json();
    if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
      // Re-map IDs to prevent collision
      const formatted = data.subtitles.map((sub: any, idx: number) => ({
        id: `cue-${Date.now()}-${idx + 1}`,
        start: Number(sub.start),
        end: Number(sub.end),
        text: sub.text,
        translation: sub.translation,
        highlight: sub.highlight,
      }));

      return [...existingItems, ...formatted];
    }
  } catch (err) {
    console.warn('AI subtitle completion endpoint unavailable, applying local fill:', err);
  }

  // Fallback to local fill cues to guarantee 100% full coverage
  const fillCues = generateLocalFillCues(startTime, endTime, language, existingItems.length);
  return [...existingItems, ...fillCues];
}

/**
 * Guarantees that an array of subtitles covers 100% of the video duration.
 * If the provided cues terminate before the video finishes, it automatically
 * completes the remaining section right up to totalDuration.
 */
export function ensureFullDurationCoverage(
  items: SubtitleItem[],
  totalDuration: number,
  language: SubtitleLanguage = 'bilingual',
  title?: string
): SubtitleItem[] {
  const dur = Math.max(2, totalDuration || 10);
  if (!items || items.length === 0) {
    return generateLocalFillCues(0, dur, language, 0);
  }

  // Find max end
  const maxEnd = items.reduce((max, i) => Math.max(max, Number(i.end) || 0), 0);

  // If the last cue ends more than 0.5s before video duration, fill the gap!
  if (maxEnd < dur - 0.5) {
    const fillCues = generateLocalFillCues(Number(maxEnd.toFixed(1)), Number(dur.toFixed(1)), language, items.length);
    return [...items, ...fillCues];
  }

  // Otherwise, ensure the very last cue extends to the end of the video
  const cloned = [...items];
  const lastIndex = cloned.length - 1;
  if (cloned[lastIndex].end < dur) {
    cloned[lastIndex] = {
      ...cloned[lastIndex],
      end: Number(dur.toFixed(1)),
    };
  }

  return cloned;
}

/**
 * Proportionally rescales and stretches existing subtitle cues so they span the entire
 * duration of the video from 0.0s to totalDuration.
 */
export function stretchCuesToFullVideo(
  items: SubtitleItem[],
  totalDuration: number
): SubtitleItem[] {
  if (!items || items.length === 0) return [];
  const dur = Math.max(2, totalDuration || 10);

  const firstStart = Math.max(0, items[0].start);
  const lastEnd = Math.max(firstStart + 0.5, items[items.length - 1].end);
  const originalSpan = lastEnd - firstStart;

  if (originalSpan <= 0) return items;

  return items.map((item, index) => {
    // Relative position in original span [0, 1]
    const relStart = (item.start - firstStart) / originalSpan;
    const relEnd = (item.end - firstStart) / originalSpan;

    const newStart = Number((relStart * dur).toFixed(1));
    let newEnd = Number((relEnd * dur).toFixed(1));

    if (index === items.length - 1) {
      newEnd = Number(dur.toFixed(1));
    }

    return {
      ...item,
      start: newStart,
      end: Math.max(newStart + 0.4, newEnd),
    };
  });
}

/**
 * Snaps consecutive cues together to eliminate awkward dead gaps during speech playback.
 */
export function snapCuesContinuity(
  items: SubtitleItem[],
  totalDuration?: number
): SubtitleItem[] {
  if (!items || items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.start - b.start);

  for (let i = 0; i < sorted.length; i++) {
    // Ensure start < end
    if (sorted[i].end <= sorted[i].start) {
      sorted[i].end = Number((sorted[i].start + 1.5).toFixed(1));
    }

    // Snap to previous if small gap or overlap
    if (i > 0) {
      const prevEnd = sorted[i - 1].end;
      const gap = sorted[i].start - prevEnd;
      if (gap > 0 && gap < 0.8) {
        // Close gap
        sorted[i].start = prevEnd;
      } else if (gap < 0) {
        // Fix overlap
        sorted[i].start = prevEnd;
        if (sorted[i].end <= sorted[i].start) {
          sorted[i].end = Number((sorted[i].start + 1.2).toFixed(1));
        }
      }
    }
  }

  // Extend last to totalDuration if provided and close
  if (totalDuration && totalDuration > 0) {
    const last = sorted[sorted.length - 1];
    if (last && Math.abs(totalDuration - last.end) < 1.5) {
      last.end = Number(totalDuration.toFixed(1));
    }
  }

  return sorted;
}
