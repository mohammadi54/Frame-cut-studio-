import { VideoMetadata } from '../types';
import { detectAspectCategory } from './proFraming';

export function createProceduralSampleVideo(
  type: 'landscape' | 'portrait'
): Promise<VideoMetadata> {
  return new Promise((resolve) => {
    const isLandscape = type === 'landscape';
    const width = isLandscape ? 1280 : 720;
    const height = isLandscape ? 720 : 1280;
    const duration = 6; // 6 seconds loop
    const fps = 30;
    const totalFrames = duration * fps;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Create AudioContext for gentle audio tone
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(dest);
    osc.start();

    // Canvas stream
    const canvasStream = canvas.captureStream(fps);
    const audioTrack = dest.stream.getAudioTracks()[0];
    if (audioTrack) {
      canvasStream.addTrack(audioTrack);
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4';

    const recorder = new MediaRecorder(canvasStream, {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
      videoBitsPerSecond: 2500000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      osc.stop();
      audioCtx.close();
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const name = isLandscape ? 'sample_landscape_16-9.webm' : 'sample_portrait_9-16.webm';
      resolve({
        file: new File([blob], name, { type: mimeType }),
        url,
        name,
        width,
        height,
        duration,
        aspectRatio: width / height,
        aspectCategory: isLandscape ? '16:9' : '9:16',
        isDemo: true,
      });
    };

    recorder.start();

    let frame = 0;
    const renderInterval = setInterval(() => {
      const progress = frame / totalFrames;
      const time = progress * duration;

      // Draw dynamic visual scene
      const grad = ctx.createLinearGradient(0, 0, width, height);
      if (isLandscape) {
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(0.5, '#4338ca');
        grad.addColorStop(1, '#065f46');
      } else {
        grad.addColorStop(0, '#831843');
        grad.addColorStop(0.5, '#be185d');
        grad.addColorStop(1, '#4c1d95');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Rotating geometric elements
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(progress * Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 4;
      ctx.strokeRect(-120, -120, 240, 240);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(Math.sin(progress * Math.PI * 4) * 80, 0, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Audio visualizer bars
      const barCount = 18;
      const barWidth = width / (barCount * 2);
      ctx.fillStyle = '#38bdf8';
      for (let i = 0; i < barCount; i++) {
        const h = Math.abs(Math.sin(progress * 10 + i)) * (isLandscape ? 120 : 90) + 15;
        const x = width / 2 - (barCount * barWidth) / 2 + i * barWidth;
        const y = height * 0.72 - h / 2;
        ctx.fillRect(x, y, barWidth - 4, h);
      }

      // Dynamic text
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${isLandscape ? 40 : 36}px sans-serif`;
      ctx.fillText(
        isLandscape ? '🎬 16:9 Landscape Demo Video' : '📱 9:16 Portrait Demo Video',
        width / 2,
        height * 0.28
      );

      ctx.font = '20px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(`Frame ${frame} / ${totalFrames} • ${time.toFixed(1)}s`, width / 2, height * 0.35);

      frame++;
      if (frame >= totalFrames) {
        clearInterval(renderInterval);
        recorder.stop();
      }
    }, 1000 / fps);
  });
}
