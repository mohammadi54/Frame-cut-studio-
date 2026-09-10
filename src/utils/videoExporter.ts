import { ProjectState, PlatformConfig } from '../types';
import { renderCompositeFrame } from './canvasRenderer';

export interface ExportProgress {
  status: 'idle' | 'rendering' | 'completed' | 'error';
  progress: number; // 0 to 100
  downloadUrl?: string;
  filename?: string;
  errorMessage?: string;
}

export interface ExportJob {
  cancel: () => void;
}

export function exportCompositeVideo(
  videoSource: HTMLVideoElement | string,
  state: ProjectState,
  platformConfig: PlatformConfig,
  onProgress: (p: ExportProgress) => void
): ExportJob {
  let isCancelled = false;
  let checkInterval: any = null;
  let recorder: MediaRecorder | null = null;
  let audioCtx: AudioContext | null = null;

  // Offscreen dedicated video element so main preview canvas is completely uninterrupted
  const bgVideo = document.createElement('video');
  bgVideo.crossOrigin = 'anonymous';
  bgVideo.playsInline = true;
  bgVideo.preload = 'auto';
  bgVideo.muted = false;

  const srcUrl = typeof videoSource === 'string' ? videoSource : (state.video?.url || videoSource.src);
  bgVideo.src = srcUrl;

  const cancel = () => {
    isCancelled = true;
    if (checkInterval) clearInterval(checkInterval);
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch (_) {}
    }
    bgVideo.pause();
    bgVideo.src = '';
    bgVideo.load();
    if (audioCtx) {
      try { audioCtx.close(); } catch (_) {}
    }
    onProgress({
      status: 'idle',
      progress: 0,
    });
  };

  const run = async () => {
    try {
      // Wait for offscreen video metadata
      await new Promise<void>((resolve, reject) => {
        if (bgVideo.readyState >= 1) return resolve();
        const onLoaded = () => {
          bgVideo.removeEventListener('loadedmetadata', onLoaded);
          bgVideo.removeEventListener('error', onError);
          resolve();
        };
        const onError = () => {
          bgVideo.removeEventListener('loadedmetadata', onLoaded);
          bgVideo.removeEventListener('error', onError);
          reject(new Error('Failed to load background video source'));
        };
        bgVideo.addEventListener('loadedmetadata', onLoaded);
        bgVideo.addEventListener('error', onError);
      });

      if (isCancelled) return;

      const dur = bgVideo.duration || 10;
      const startTime = state.trim.start || 0;
      const endTime = Math.min(dur, state.trim.end && state.trim.end > 0 ? state.trim.end : dur);
      const renderDuration = Math.max(1, endTime - startTime);

      // Create dedicated export canvas
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = platformConfig.width;
      exportCanvas.height = platformConfig.height;

      // Audio pipeline
      let stream = exportCanvas.captureStream(30);
      try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        const sourceNode = audioCtx.createMediaElementSource(bgVideo);
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = state.audio.muted
          ? 0
          : state.audio.boost
          ? state.audio.volume * 1.5
          : state.audio.volume;
        sourceNode.connect(gainNode);
        gainNode.connect(dest);

        const audioTracks = dest.stream.getAudioTracks();
        if (audioTracks.length > 0 && !state.audio.muted) {
          stream.addTrack(audioTracks[0]);
        }
      } catch (err) {
        console.warn('Background audio routing notice:', err);
      }

      // MIME type detection
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
      }

      recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        videoBitsPerSecond: 6000000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const filename = `FrameCut_${platformConfig.id}_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;

      recorder.onstop = () => {
        if (isCancelled) return;
        bgVideo.pause();
        const blob = new Blob(chunks, { type: mimeType });
        const downloadUrl = URL.createObjectURL(blob);
        onProgress({
          status: 'completed',
          progress: 100,
          downloadUrl,
          filename,
        });
        if (audioCtx) {
          try { audioCtx.close(); } catch (_) {}
        }
      };

      recorder.onerror = (err) => {
        if (isCancelled) return;
        onProgress({
          status: 'error',
          progress: 0,
          errorMessage: 'Background export error: ' + (err as any).message,
        });
      };

      // Seek offscreen video to start
      bgVideo.currentTime = startTime;
      bgVideo.playbackRate = 1.0;
      bgVideo.volume = state.audio.muted ? 0 : Math.min(1, state.audio.volume);

      await new Promise<void>((r) => {
        const onSeeked = () => {
          bgVideo.removeEventListener('seeked', onSeeked);
          r();
        };
        bgVideo.addEventListener('seeked', onSeeked);
      });

      if (isCancelled) return;

      recorder.start(100);
      await bgVideo.play();

      checkInterval = setInterval(() => {
        if (isCancelled) {
          clearInterval(checkInterval);
          return;
        }

        const current = bgVideo.currentTime;
        const elapsed = current - startTime;
        const pct = Math.min(99, Math.max(0, Math.round((elapsed / renderDuration) * 100)));

        renderCompositeFrame(exportCanvas, bgVideo, state, platformConfig, current);

        onProgress({
          status: 'rendering',
          progress: pct,
        });

        if (current >= endTime || bgVideo.ended) {
          clearInterval(checkInterval);
          if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
          }
        }
      }, 33);
    } catch (err: any) {
      if (isCancelled) return;
      console.error('Background export failed:', err);
      onProgress({
        status: 'error',
        progress: 0,
        errorMessage: err.message || 'Background export encountered an error',
      });
    }
  };

  run();

  return { cancel };
}

export function downloadBlob(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function capturePosterSnapshot(
  videoEl: HTMLVideoElement,
  state: ProjectState,
  platformConfig: PlatformConfig,
  currentTime: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = platformConfig.width;
  canvas.height = platformConfig.height;
  renderCompositeFrame(canvas, videoEl, state, platformConfig, currentTime);
  return canvas.toDataURL('image/png');
}
