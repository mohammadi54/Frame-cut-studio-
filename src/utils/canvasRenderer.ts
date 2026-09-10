import { ProjectState, PlatformConfig } from '../types';

export function renderCompositeFrame(
  canvas: HTMLCanvasElement,
  videoEl: HTMLVideoElement | null,
  state: ProjectState,
  platformConfig: PlatformConfig,
  currentTime: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const targetW = platformConfig.width;
  const targetH = platformConfig.height;

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  // 1. Draw Background
  drawBackground(ctx, targetW, targetH, videoEl, state);

  // 2. Draw Framed Video
  if (videoEl && videoEl.readyState >= 2) {
    drawVideoWithFrame(ctx, targetW, targetH, videoEl, state);
  }

  // 3. Draw Title
  if (state.title.enabled && state.title.text.trim()) {
    drawTitle(ctx, targetW, targetH, state);
  }

  // 4. Draw Subtitles
  if (state.subtitles.enabled && state.subtitles.items.length > 0) {
    drawSubtitles(ctx, targetW, targetH, state, currentTime);
  }

  // 5. Draw Logo
  if (state.logo.enabled) {
    drawLogo(ctx, targetW, targetH, state);
  }

  // 6. Draw Watermark
  if (state.watermark.enabled && state.watermark.text.trim()) {
    drawWatermark(ctx, targetW, targetH, state);
  }
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  videoEl: HTMLVideoElement | null,
  state: ProjectState
) {
  ctx.save();

  if (state.background === 'mohammadi-royal') {
    // Prestigious Mohammadi Academy Royal Navy & Gold Aura
    const grad = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.1, w / 2, h / 2, Math.max(w, h) * 0.85);
    grad.addColorStop(0, '#102a4e');
    grad.addColorStop(0.45, '#0a1a33');
    grad.addColorStop(0.85, '#050d1a');
    grad.addColorStop(1, '#02060d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle golden corner flourishes
    ctx.save();
    const goldGrad = ctx.createRadialGradient(w / 2, 0, 10, w / 2, 0, w * 0.6);
    goldGrad.addColorStop(0, 'rgba(245, 158, 11, 0.15)');
    goldGrad.addColorStop(0.7, 'rgba(217, 119, 6, 0.04)');
    goldGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = goldGrad;
    ctx.fillRect(0, 0, w, h * 0.4);
    ctx.restore();
  } else if (state.background === 'mohammadi-emerald') {
    // Prestigious Islamic Scholar Emerald & Gold
    const grad = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.1, w / 2, h / 2, Math.max(w, h) * 0.85);
    grad.addColorStop(0, '#064e3b');
    grad.addColorStop(0.5, '#022c22');
    grad.addColorStop(0.9, '#021812');
    grad.addColorStop(1, '#010e0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    const goldGrad = ctx.createRadialGradient(w / 2, h, 20, w / 2, h, w * 0.6);
    goldGrad.addColorStop(0, 'rgba(245, 158, 11, 0.16)');
    goldGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = goldGrad;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
    ctx.restore();
  } else if (state.background === 'blur-video' && videoEl && videoEl.readyState >= 2) {
    // Blurred video backdrop
    ctx.filter = 'blur(40px) brightness(0.65) saturate(1.3)';
    // Draw enlarged video to cover canvas
    const videoAspect = videoEl.videoWidth / videoEl.videoHeight;
    const canvasAspect = w / h;
    let drawW = w;
    let drawH = h;
    if (videoAspect > canvasAspect) {
      drawH = h * 1.3;
      drawW = drawH * videoAspect;
    } else {
      drawW = w * 1.3;
      drawH = drawW / videoAspect;
    }
    const x = (w - drawW) / 2;
    const y = (h - drawH) / 2;
    ctx.drawImage(videoEl, x, y, drawW, drawH);
    ctx.filter = 'none';

    // Dark gradient overlay for readable contrast
    const overlay = ctx.createLinearGradient(0, 0, 0, h);
    overlay.addColorStop(0, 'rgba(10, 10, 18, 0.45)');
    overlay.addColorStop(0.5, 'rgba(10, 10, 18, 0.2)');
    overlay.addColorStop(1, 'rgba(10, 10, 18, 0.6)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, w, h);
  } else if (state.background === 'gradient-sunset') {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#31103f');
    grad.addColorStop(0.4, '#7c1e55');
    grad.addColorStop(0.8, '#c2410c');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (state.background === 'gradient-cyber') {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0f051d');
    grad.addColorStop(0.5, '#2e1065');
    grad.addColorStop(1, '#083344');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (state.background === 'gradient-midnight') {
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.8);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.7, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (state.background === 'studio-dark') {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, Math.max(w, h));
    grad.addColorStop(0, '#1c1917');
    grad.addColorStop(0.6, '#0c0a09');
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (state.background === 'mesh-aurora') {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#064e3b');
    grad.addColorStop(0.4, '#1e1b4b');
    grad.addColorStop(1, '#701a75');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (state.background === 'solid-slate') {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = state.customBackgroundColor || '#050505';
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}

function drawVideoWithFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  videoEl: HTMLVideoElement,
  state: ProjectState
) {
  const vw = videoEl.videoWidth || 1920;
  const vh = videoEl.videoHeight || 1080;
  const videoAspect = vw / vh;
  const canvasAspect = w / h;

  // Base bounding box fitting within canvas with padding
  const baseMargin = 0.88;
  let boxW = w * baseMargin;
  let boxH = boxW / videoAspect;

  if (boxH > h * baseMargin) {
    boxH = h * baseMargin;
    boxW = boxH * videoAspect;
  }

  // Apply user transform
  const scale = state.transform.scale || 1;
  const finalW = boxW * scale;
  const finalH = boxH * scale;

  const centerX = w / 2 + (state.transform.offsetX || 0);
  const centerY = h / 2 + (state.transform.offsetY || 0);

  ctx.save();
  ctx.translate(centerX, centerY);

  if (state.transform.rotation) {
    ctx.rotate((state.transform.rotation * Math.PI) / 180);
  }

  if (state.transform.flipH || state.transform.flipV) {
    ctx.scale(state.transform.flipH ? -1 : 1, state.transform.flipV ? -1 : 1);
  }

  const vx = -finalW / 2;
  const vy = -finalH / 2;

  // Frame Styles implementation
  const fStyle = state.frameStyle;
  const borderRadius = fStyle === 'none' ? 0 : fStyle === 'clean' ? 12 : fStyle === 'mohammadi-gold' ? 22 : 28;

  // Draw shadow if needed
  if (fStyle === 'rounded-shadow' || fStyle === 'studio-card' || fStyle === 'polaroid') {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 45;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = '#000000';
    roundRect(ctx, vx, vy, finalW, finalH, borderRadius);
    ctx.fill();
    ctx.restore();
  } else if (fStyle === 'mohammadi-gold') {
    // Mohammadi Academy signature gold luxury shadow & border glow
    ctx.save();
    ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#030a16';
    roundRect(ctx, vx, vy, finalW, finalH, borderRadius);
    ctx.fill();
    ctx.restore();
  } else if (fStyle === 'gradient-glow' || fStyle === 'neon-cyber') {
    ctx.save();
    ctx.shadowColor = fStyle === 'neon-cyber' ? '#06b6d4' : '#ec4899';
    ctx.shadowBlur = 35;
    ctx.strokeStyle = fStyle === 'neon-cyber' ? '#22d3ee' : '#f43f5e';
    ctx.lineWidth = 6;
    roundRect(ctx, vx - 3, vy - 3, finalW + 6, finalH + 6, borderRadius + 3);
    ctx.stroke();
    ctx.restore();
  }

  // Polaroid extra bottom border
  if (fStyle === 'polaroid') {
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, vx - 16, vy - 16, finalW + 32, finalH + 72, 16);
    ctx.fill();
    ctx.restore();
  }

  // Film strip sprockets
  if (fStyle === 'film-strip') {
    ctx.save();
    ctx.fillStyle = '#18181b';
    ctx.fillRect(vx - 20, vy - 30, finalW + 40, finalH + 60);
    // Draw sprocket holes
    ctx.fillStyle = '#ffffff';
    const holes = 12;
    const holeStep = (finalW + 20) / holes;
    for (let i = 0; i < holes; i++) {
      ctx.fillRect(vx - 10 + i * holeStep, vy - 24, 12, 16);
      ctx.fillRect(vx - 10 + i * holeStep, vy + finalH + 8, 12, 16);
    }
    ctx.restore();
  }

  // Clip and draw video
  ctx.save();
  if (borderRadius > 0) {
    roundRect(ctx, vx, vy, finalW, finalH, borderRadius);
    ctx.clip();
  }
  ctx.drawImage(videoEl, vx, vy, finalW, finalH);
  ctx.restore();

  // Outer Border Rim
  if (fStyle === 'clean') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    roundRect(ctx, vx, vy, finalW, finalH, borderRadius);
    ctx.stroke();
  } else if (fStyle === 'mohammadi-gold') {
    // Elegant dual gold stroke for Mohammadi Academy
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    roundRect(ctx, vx, vy, finalW, finalH, borderRadius);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(254, 243, 199, 0.6)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, vx + 3, vy + 3, finalW - 6, finalH - 6, Math.max(0, borderRadius - 3));
    ctx.stroke();
  } else if (fStyle === 'rounded-shadow') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 3;
    roundRect(ctx, vx, vy, finalW, finalH, borderRadius);
    ctx.stroke();
  } else if (fStyle === 'studio-card') {
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 4;
    roundRect(ctx, vx, vy, finalW, finalH, borderRadius);
    ctx.stroke();
  }

  ctx.restore();
}

function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number, state: ProjectState) {
  const { title } = state;
  const posY = (h * (title.positionY || 12)) / 100;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const text = title.text;
  const isPersian = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  const selectedFont = title.font || (isPersian ? 'Vazirmatn' : 'Outfit');
  const fontFamily = isPersian 
    ? `"${selectedFont}", "Vazirmatn", "Amiri", Tahoma, sans-serif`
    : `"${selectedFont}", "Outfit", sans-serif`;

  const fontSize = Math.max(24, Math.round(w * 0.045 * (title.size / 36)));
  ctx.font = `800 ${fontSize}px ${fontFamily}`;

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const pillPaddingX = fontSize * 0.8;
  const pillPaddingY = fontSize * 0.4;
  const pillH = fontSize + pillPaddingY * 2;

  if (title.backgroundEnabled) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = title.backgroundColor || '#000000';
    roundRect(
      ctx,
      w / 2 - textWidth / 2 - pillPaddingX,
      posY - pillH / 2,
      textWidth + pillPaddingX * 2,
      pillH,
      12
    );
    ctx.fill();
    ctx.restore();
  } else {
    // Draw text outline / glow for legibility against video
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 4;
    ctx.strokeText(text, w / 2, posY);
  }

  ctx.fillStyle = title.color || '#ffffff';
  ctx.fillText(text, w / 2, posY);
  ctx.restore();
}

function drawMohammadiAcademyLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  variant: 'crest' | 'gold' | 'emerald' = 'crest'
) {
  const r = size / 2;
  ctx.save();

  // Outer glow and drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  const primaryGold = '#f59e0b';

  // 1. Base circle fill
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  if (variant === 'emerald') {
    const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    grad.addColorStop(0, '#065f46');
    grad.addColorStop(0.7, '#022c22');
    grad.addColorStop(1, '#011913');
    ctx.fillStyle = grad;
  } else if (variant === 'gold') {
    const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.5, '#d97706');
    grad.addColorStop(1, '#78350f');
    ctx.fillStyle = grad;
  } else {
    // Crest default: Deep Royal Navy
    const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    grad.addColorStop(0, '#102a4e');
    grad.addColorStop(0.6, '#08172c');
    grad.addColorStop(1, '#030a16');
    ctx.fillStyle = grad;
  }
  ctx.fill();

  // 2. Outer Gold Ring
  ctx.lineWidth = Math.max(2, size * 0.04);
  ctx.strokeStyle = primaryGold;
  ctx.stroke();

  // 3. Inner filigree rim
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, size * 0.015);
  ctx.strokeStyle = 'rgba(253, 230, 138, 0.7)';
  ctx.stroke();

  // 4. Rosette dots around the inner rim
  ctx.fillStyle = primaryGold;
  const numDots = 16;
  for (let i = 0; i < numDots; i++) {
    const angle = (i * Math.PI * 2) / numDots;
    const dotX = cx + Math.cos(angle) * (r * 0.82);
    const dotY = cy + Math.sin(angle) * (r * 0.82);
    ctx.beginPath();
    ctx.arc(dotX, dotY, Math.max(1, size * 0.018), 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Stylized Open Book of Knowledge (Rihal)
  const bookW = r * 0.58;
  const bookH = r * 0.28;
  const bookY = cy - r * 0.04;

  // Book left page
  ctx.fillStyle = variant === 'gold' ? '#ffffff' : '#fef9c3';
  ctx.beginPath();
  ctx.moveTo(cx, bookY + bookH * 0.3);
  ctx.quadraticCurveTo(cx - bookW * 0.28, bookY - bookH * 0.25, cx - bookW * 0.5, bookY - bookH * 0.1);
  ctx.lineTo(cx - bookW * 0.5, bookY + bookH * 0.55);
  ctx.quadraticCurveTo(cx - bookW * 0.28, bookY + bookH * 0.4, cx, bookY + bookH * 0.85);
  ctx.closePath();
  ctx.fill();

  // Book right page
  ctx.beginPath();
  ctx.moveTo(cx, bookY + bookH * 0.3);
  ctx.quadraticCurveTo(cx + bookW * 0.28, bookY - bookH * 0.25, cx + bookW * 0.5, bookY - bookH * 0.1);
  ctx.lineTo(cx + bookW * 0.5, bookY + bookH * 0.55);
  ctx.quadraticCurveTo(cx + bookW * 0.28, bookY + bookH * 0.4, cx, bookY + bookH * 0.85);
  ctx.closePath();
  ctx.fill();

  // Book spine
  ctx.strokeStyle = primaryGold;
  ctx.lineWidth = Math.max(1.5, size * 0.022);
  ctx.beginPath();
  ctx.moveTo(cx, bookY + bookH * 0.25);
  ctx.lineTo(cx, bookY + bookH * 0.95);
  ctx.stroke();

  // 6. Persian and English Academy Identity
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const faFontSize = Math.max(9, Math.round(size * 0.135));
  ctx.font = `bold ${faFontSize}px "Vazirmatn", "Amiri", Tahoma, sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 4;
  ctx.fillText('آکادمی محمدی', cx, cy - r * 0.38);

  const enFontSize = Math.max(6, Math.round(size * 0.08));
  ctx.font = `bold ${enFontSize}px "Outfit", sans-serif`;
  ctx.fillStyle = primaryGold;
  ctx.fillText('MOHAMMADI ACADEMY', cx, cy + r * 0.38);

  const webFontSize = Math.max(5, Math.round(size * 0.062));
  ctx.font = `600 ${webFontSize}px "Outfit", sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText('Mohammadiacademy.org', cx, cy + r * 0.58);

  ctx.restore();
}

function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: ProjectState,
  currentTime: number
) {
  const { subtitles } = state;
  // Find active subtitle cue with micro-gap bridge (0.2s) so subtitles stay smooth throughout the video
  let currentItem = subtitles.items.find(
    (item) => currentTime >= item.start && currentTime <= item.end
  );

  if (!currentItem && subtitles.items.length > 0) {
    const bridgeItem = subtitles.items.find(
      (item) => currentTime >= item.end && currentTime <= item.end + 0.2
    );
    if (bridgeItem) {
      currentItem = bridgeItem;
    }
  }

  if (!currentItem) return;

  const posY = h - (h * (subtitles.positionY || 16)) / 100;
  const fontSize = Math.max(22, Math.round(w * 0.042 * (subtitles.fontSize / 32)));

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const style = subtitles.style;
  const isPersian = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(currentItem.text);
  const primaryFont = isPersian ? '"Vazirmatn", "Amiri", Tahoma, sans-serif' : '"Outfit", sans-serif';

  // Bilingual Subtitles: Line 1 (Primary / Persian) + Line 2 (English translation)
  if (currentItem.translation) {
    const mainFont = `700 ${fontSize}px ${primaryFont}`;
    const transFont = `600 ${Math.round(fontSize * 0.75)}px "Outfit", sans-serif`;

    ctx.font = mainFont;
    const m1 = ctx.measureText(currentItem.text);
    ctx.font = transFont;
    const m2 = ctx.measureText(currentItem.translation);

    const maxTextW = Math.max(m1.width, m2.width);
    const boxW = maxTextW + 56;
    const boxH = fontSize * 2.5;

    // Academic Gold backdrop pill for bilingual cues
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = 'rgba(5, 13, 26, 0.92)';
    roundRect(ctx, w / 2 - boxW / 2, posY - boxH / 2, boxW, boxH, 16);
    ctx.fill();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    roundRect(ctx, w / 2 - boxW / 2, posY - boxH / 2, boxW, boxH, 16);
    ctx.stroke();
    ctx.restore();

    // Line 1: Primary text (Persian / Farsi)
    ctx.font = mainFont;
    ctx.fillStyle = subtitles.primaryColor || '#ffffff';
    ctx.fillText(currentItem.text, w / 2, posY - fontSize * 0.42);

    // Line 2: Translation (English)
    ctx.font = transFont;
    ctx.fillStyle = subtitles.highlightColor || '#fef08a';
    ctx.fillText(currentItem.translation, w / 2, posY + fontSize * 0.5);

    ctx.restore();
    return;
  }

  // Academic Gold single-language style
  if (style === 'academic-gold') {
    ctx.font = `700 ${fontSize}px ${primaryFont}`;
    const metrics = ctx.measureText(currentItem.text);
    const boxW = metrics.width + 48;
    const boxH = fontSize * 1.6;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = 'rgba(6, 18, 36, 0.92)';
    roundRect(ctx, w / 2 - boxW / 2, posY - boxH / 2, boxW, boxH, 14);
    ctx.fill();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    roundRect(ctx, w / 2 - boxW / 2, posY - boxH / 2, boxW, boxH, 14);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = subtitles.primaryColor || '#ffffff';
    ctx.fillText(currentItem.text, w / 2, posY);
    ctx.restore();
    return;
  }

  // Hormozi Style
  if (style === 'hormozi') {
    if (isPersian) {
      // In Persian, keep cursive script connected (do not split words apart with English tracking)
      ctx.font = `800 ${fontSize * 1.15}px "Vazirmatn", "Amiri", Tahoma, sans-serif`;
      const metrics = ctx.measureText(currentItem.text);
      const boxW = metrics.width + 48;
      const boxH = fontSize * 1.7;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      roundRect(ctx, w / 2 - boxW / 2, posY - boxH / 2, boxW, boxH, 12);
      ctx.fill();

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      roundRect(ctx, w / 2 - boxW / 2, posY - boxH / 2, boxW, boxH, 12);
      ctx.stroke();

      ctx.fillStyle = subtitles.highlightColor || '#facc15';
      ctx.fillText(currentItem.text, w / 2, posY);
    } else {
      ctx.font = `900 ${fontSize * 1.15}px "Bebas Neue", "Outfit", sans-serif`;
      const words = currentItem.text.split(' ');
      const fullText = currentItem.text.toUpperCase();
      const metrics = ctx.measureText(fullText);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      roundRect(
        ctx,
        w / 2 - metrics.width / 2 - 20,
        posY - fontSize * 0.8,
        metrics.width + 40,
        fontSize * 1.6,
        10
      );
      ctx.fill();

      let currentX = w / 2 - metrics.width / 2;
      ctx.textAlign = 'left';
      for (let i = 0; i < words.length; i++) {
        const word = words[i].toUpperCase();
        const isHighlighted =
          currentItem.highlight &&
          word.toLowerCase().includes(currentItem.highlight.toLowerCase());
        ctx.fillStyle = isHighlighted ? subtitles.highlightColor || '#facc15' : '#ffffff';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.strokeText(word, currentX, posY);
        ctx.fillText(word, currentX, posY);

        currentX += ctx.measureText(word + ' ').width;
      }
    }
  } else if (style === 'modern-pill') {
    ctx.font = `700 ${fontSize}px ${primaryFont}`;
    const metrics = ctx.measureText(currentItem.text);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    roundRect(
      ctx,
      w / 2 - metrics.width / 2 - 24,
      posY - fontSize * 0.75,
      metrics.width + 48,
      fontSize * 1.5,
      999
    );
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = subtitles.primaryColor || '#ffffff';
    ctx.fillText(currentItem.text, w / 2, posY);
  } else if (style === 'classic-box') {
    ctx.font = `600 ${fontSize}px ${primaryFont}`;
    const metrics = ctx.measureText(currentItem.text);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(
      w / 2 - metrics.width / 2 - 16,
      posY - fontSize * 0.7,
      metrics.width + 32,
      fontSize * 1.4
    );
    ctx.fillStyle = '#ffffff';
    ctx.fillText(currentItem.text, w / 2, posY);
  } else {
    // Minimal shadow
    ctx.font = `700 ${fontSize}px ${primaryFont}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 4;
    ctx.strokeText(currentItem.text, w / 2, posY);
    ctx.fillStyle = subtitles.primaryColor || '#ffffff';
    ctx.fillText(currentItem.text, w / 2, posY);
  }

  ctx.restore();
}

// Image cache for custom logo URLs
const logoImageCache = new Map<string, HTMLImageElement>();

export function getVideoBoundingBox(
  w: number,
  h: number,
  videoEl: HTMLVideoElement | null,
  state: ProjectState
): { x: number; y: number; width: number; height: number; centerX: number; centerY: number; baseW: number; baseH: number } {
  const vw = videoEl?.videoWidth || 1920;
  const vh = videoEl?.videoHeight || 1080;
  const videoAspect = vw / vh;

  const baseMargin = 0.88;
  let boxW = w * baseMargin;
  let boxH = boxW / videoAspect;

  if (boxH > h * baseMargin) {
    boxH = h * baseMargin;
    boxW = boxH * videoAspect;
  }

  const scale = state.transform.scale || 1;
  const finalW = boxW * scale;
  const finalH = boxH * scale;

  const centerX = w / 2 + (state.transform.offsetX || 0);
  const centerY = h / 2 + (state.transform.offsetY || 0);

  return {
    x: centerX - finalW / 2,
    y: centerY - finalH / 2,
    width: finalW,
    height: finalH,
    centerX,
    centerY,
    baseW: boxW,
    baseH: boxH,
  };
}

export function getLogoBoundingBox(
  w: number,
  h: number,
  state: ProjectState
): { x: number; y: number; size: number } {
  const { logo } = state;
  const size = Math.round(w * 0.08 * (logo.size / 50));
  const padding = Math.round(w * 0.04);

  let x = padding;
  let y = padding;

  if (logo.position === 'custom' && logo.xPercent !== undefined && logo.yPercent !== undefined) {
    x = (w * logo.xPercent) / 100 - size / 2;
    y = (h * logo.yPercent) / 100 - size / 2;
  } else if (logo.position === 'top-right') {
    x = w - padding - size;
    y = padding;
  } else if (logo.position === 'bottom-left') {
    x = padding;
    y = h - padding - size;
  } else if (logo.position === 'bottom-right') {
    x = w - padding - size;
    y = h - padding - size;
  } else if (logo.position === 'center-top') {
    x = (w - size) / 2;
    y = padding;
  } else if (logo.position === 'center-bottom') {
    x = (w - size) / 2;
    y = h - padding - size;
  }

  return { x, y, size };
}

function drawLogo(ctx: CanvasRenderingContext2D, w: number, h: number, state: ProjectState) {
  const { logo } = state;
  const { x, y, size } = getLogoBoundingBox(w, h, state);
  const shape = logo.shape || 'circle';

  ctx.save();
  ctx.globalAlpha = logo.opacity || 0.9;

  // Outer shadow for logo visibility across all backgrounds
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;

  const drawContainerShape = () => {
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    } else if (shape === 'rounded') {
      const radius = size * 0.22;
      ctx.roundRect(x, y, size, size, radius);
    } else if (shape === 'square') {
      ctx.rect(x, y, size, size);
    }
  };

  if (logo.url) {
    // Custom logo uploaded by user
    let img = logoImageCache.get(logo.url);
    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = logo.url;
      logoImageCache.set(logo.url, img);
    }

    if (img.complete && img.naturalWidth > 0) {
      if (shape !== 'none') {
        ctx.save();
        drawContainerShape();
        ctx.clip();
        ctx.drawImage(img, x, y, size, size);
        ctx.restore();

        // Border if enabled
        if (logo.borderWidth && logo.borderWidth > 0) {
          ctx.lineWidth = logo.borderWidth;
          ctx.strokeStyle = logo.borderColor || '#ffffff';
          drawContainerShape();
          ctx.stroke();
        }
      } else {
        // Raw transparent image with drop shadow
        ctx.drawImage(img, x, y, size, size);
      }
    } else {
      // Loading placeholder
      drawContainerShape();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();
    }
  } else {
    // Preset Logo Badges
    const preset = logo.preset || 'mohammadi-crest';

    if (preset === 'mohammadi-crest' || preset === 'mohammadi-emerald' || preset === 'mohammadi-gold') {
      const variant = preset === 'mohammadi-gold' ? 'gold' : preset === 'mohammadi-emerald' ? 'emerald' : 'crest';
      drawMohammadiAcademyLogo(ctx, x + size / 2, y + size / 2, size, variant);
    } else if (preset === 'creator-star') {
      // Golden Amber Creator Star
      ctx.fillStyle = '#f59e0b';
      drawContainerShape();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${size * 0.55}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', x + size / 2, y + size / 2 + 1);
    } else if (preset === 'youtube-badge') {
      // Red YouTube Play Badge
      ctx.fillStyle = '#ef4444';
      drawContainerShape();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${size * 0.5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▶', x + size / 2 + 1, y + size / 2);
    } else if (preset === 'fire-trend') {
      // Hot Trending Flame Badge
      ctx.fillStyle = '#f97316';
      drawContainerShape();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `${size * 0.55}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔥', x + size / 2, y + size / 2);
    } else if (preset === 'brand-circle') {
      // Modern Dark Studio Mark
      ctx.fillStyle = '#09090b';
      drawContainerShape();
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#6366f1';
      ctx.stroke();
      ctx.fillStyle = '#818cf8';
      ctx.font = `bold ${size * 0.45}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FC', x + size / 2, y + size / 2);
    } else {
      // Default: Verified badge
      ctx.fillStyle = '#4f46e5';
      drawContainerShape();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${size * 0.55}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', x + size / 2, y + size / 2 + 1);
    }

    if (logo.borderWidth && logo.borderWidth > 0 && shape !== 'none' && !preset.startsWith('mohammadi')) {
      ctx.lineWidth = logo.borderWidth;
      ctx.strokeStyle = logo.borderColor || '#ffffff';
      drawContainerShape();
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: ProjectState
) {
  const { watermark } = state;
  const padding = Math.round(w * 0.035);
  const fontSize = Math.max(16, Math.round(w * 0.022));

  ctx.save();
  ctx.globalAlpha = watermark.opacity || 0.75;
  const isPersian = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(watermark.text || '');
  ctx.font = isPersian 
    ? `600 ${fontSize}px "Vazirmatn", "Amiri", Tahoma, sans-serif`
    : `600 ${fontSize}px "Outfit", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  let x = w - padding;
  let y = h - padding;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';

  if (watermark.position === 'bottom-left') {
    x = padding;
    ctx.textAlign = 'left';
  } else if (watermark.position === 'top-right') {
    x = w - padding;
    y = padding + fontSize;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
  }

  const watermarkLabel = watermark.text || 'Mohammadiacademy.org';
  ctx.fillText(watermarkLabel, x, y);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (width < 2 * radius) radius = width / 2;
  if (height < 2 * radius) radius = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
