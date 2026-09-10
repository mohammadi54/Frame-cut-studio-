import { SubtitleItem, SubtitleLanguage } from '../types';
import { ensureFullDurationCoverage } from './subtitleUtils';

/**
 * Extracts a compact mono 16kHz WAV audio segment from a video File or HTMLVideoElement
 * suitable for sending directly to Gemini AI multimodal audio transcription.
 */
export async function extractVideoAudioBuffer(
  source: File | HTMLVideoElement,
  maxSeconds = 300
): Promise<{ base64Audio: string; duration: number } | null> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    let arrayBuffer: ArrayBuffer | null = null;

    if (source instanceof File) {
      // Direct file reading
      arrayBuffer = await source.arrayBuffer();
    } else if (source instanceof HTMLVideoElement && source.src) {
      if (source.src.startsWith('blob:') || source.src.startsWith('data:')) {
        const res = await fetch(source.src);
        arrayBuffer = await res.arrayBuffer();
      }
    }

    if (!arrayBuffer) return null;

    const audioCtx = new AudioContextClass();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

    // Limit to maxSeconds
    const sampleRate = 16000;
    const duration = Math.min(maxSeconds, audioBuffer.duration);
    const numSamples = Math.floor(duration * sampleRate);

    // Render downsampled mono buffer using OfflineAudioContext
    const offlineCtx = new OfflineAudioContext(1, numSamples, sampleRate);
    const sourceNode = offlineCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(offlineCtx.destination);
    sourceNode.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const channelData = renderedBuffer.getChannelData(0);

    // Convert float32 PCM to 16-bit signed PCM WAV file
    const wavBytes = encodeWav(channelData, sampleRate);
    const base64Audio = uint8ArrayToBase64(wavBytes);

    audioCtx.close();

    return {
      base64Audio,
      duration,
    };
  } catch (err) {
    console.warn('Direct audio extraction unavailable (silent or DRM protected):', err);
    return null;
  }
}

/**
 * Encodes Float32 mono PCM audio into a standard 16-bit WAV ArrayBuffer
 */
function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // channel count (1 is mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples (clamp float to 16-bit int)
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Calls the backend Gemini speech-to-subtitles engine with audio or video context
 */
export async function transcribeVideoSpeech({
  source,
  language,
  duration,
  title,
}: {
  source?: File | HTMLVideoElement | null;
  language: SubtitleLanguage;
  duration: number;
  title?: string;
}): Promise<SubtitleItem[]> {
  let audioBase64: string | undefined;

  if (source) {
    const audioData = await extractVideoAudioBuffer(source, Math.min(300, Math.max(10, duration || 30)));
    if (audioData) {
      audioBase64 = audioData.base64Audio;
    }
  }

  const response = await fetch('/api/ai/transcribe-video-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioBase64,
      mimeType: 'audio/wav',
      language,
      duration: duration || 15,
      title: title || 'Mohammadi Academy Video Lecture',
    }),
  });

  const data = await response.json();
  if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
    // Ensure that the returned subtitles cover the full duration of the video
    return ensureFullDurationCoverage(data.subtitles, duration, language, title);
  }

  throw new Error(data.error || 'Failed to transcribe video speech');
}
