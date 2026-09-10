import { VideoMetadata, Platform, ProjectState, FrameStyle, BackgroundPreset } from '../types';
import { PLATFORMS } from '../constants/platforms';

export interface ProFrameResult {
  newState: Partial<ProjectState>;
  description: string;
  matchedRule: string;
}

export function detectAspectCategory(width: number, height: number): VideoMetadata['aspectCategory'] {
  if (!width || !height) return '16:9';
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.15) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.15) return '9:16';
  if (Math.abs(ratio - 1.0) < 0.15) return '1:1';
  if (Math.abs(ratio - 4 / 3) < 0.15) return '4:3';
  return 'other';
}

export function applyProfessionalFrame(
  video: VideoMetadata,
  targetPlatform: Platform,
  currentState: ProjectState
): ProFrameResult {
  const videoAspect = video.aspectRatio || (video.width && video.height ? video.width / video.height : 16 / 9);
  const platformConfig = PLATFORMS[targetPlatform];
  const isTargetVertical = targetPlatform === 'shorts' || targetPlatform === 'reels';
  const isTargetSquare = targetPlatform === 'facebook';
  const isTargetLandscape = targetPlatform === 'youtube';

  const isVideoLandscape = videoAspect > 1.2;
  const isVideoVertical = videoAspect < 0.8;

  let frameStyle: FrameStyle = currentState.frameStyle === 'mohammadi-gold' ? 'mohammadi-gold' : 'mohammadi-gold';
  let background: BackgroundPreset = currentState.background === 'mohammadi-emerald' ? 'mohammadi-emerald' : 'mohammadi-royal';
  let scale = 1.0;
  let offsetY = 0;
  let titlePositionY = 12;
  let subtitlePositionY = 18;
  let description = '';
  let matchedRule = '';

  // Rule 1: Landscape Video placed inside YouTube 16:9
  if (isVideoLandscape && isTargetLandscape) {
    matchedRule = '16:9 Video → Mohammadi Academy YouTube Frame';
    scale = 0.86;
    offsetY = 10;
    frameStyle = 'mohammadi-gold';
    background = currentState.background === 'mohammadi-emerald' ? 'mohammadi-emerald' : 'mohammadi-royal';
    titlePositionY = 8;
    description = 'Applied Mohammadi Academy YouTube studio frame: Academic header banner, dual gold frame border, and official crest logo.';
  }
  // Rule 2: Landscape Video placed inside Shorts / Reels 9:16
  else if (isVideoLandscape && isTargetVertical) {
    matchedRule = '16:9 Landscape Video → Mohammadi Academy Shorts/Reels 9:16';
    scale = 0.95;
    offsetY = -18; // slightly above center so subtitles fit below
    frameStyle = 'mohammadi-gold';
    background = currentState.background === 'mohammadi-emerald' ? 'mohammadi-emerald' : 'mohammadi-royal';
    titlePositionY = 14;
    subtitlePositionY = 22;
    description = 'Optimized horizontal video for vertical mobile: Royal academic backdrop, top lecture header, and synchronized bilingual subtitles.';
  }
  // Rule 3: Vertical 9:16 Video placed inside Shorts / Reels 9:16
  else if (isVideoVertical && isTargetVertical) {
    matchedRule = '9:16 Video → Mohammadi Academy Vertical Frame';
    scale = 0.92;
    offsetY = 15;
    frameStyle = 'mohammadi-gold';
    background = currentState.background === 'mohammadi-emerald' ? 'mohammadi-emerald' : 'mohammadi-royal';
    titlePositionY = 10;
    subtitlePositionY = 16;
    description = 'Fit vertical video inside 9:16 canvas with Mohammadi Academy gold border, crest logo, and Persian/English subtitle zone.';
  }
  // Rule 4: Vertical Video placed inside YouTube 16:9 Landscape
  else if (isVideoVertical && isTargetLandscape) {
    matchedRule = '9:16 Video → Mohammadi Academy 16:9 Letterboxed Frame';
    scale = 0.9;
    offsetY = 0;
    frameStyle = 'mohammadi-gold';
    background = currentState.background === 'mohammadi-emerald' ? 'mohammadi-emerald' : 'mohammadi-royal';
    titlePositionY = 10;
    description = 'Framed vertical video with prestigious Mohammadi Academy royal background and official branding.';
  }
  // Rule 5: Square / Facebook Feed (1:1)
  else if (isTargetSquare) {
    matchedRule = 'Video → Mohammadi Academy 1:1 Social Card Frame';
    scale = isVideoLandscape ? 0.96 : 0.88;
    offsetY = 0;
    frameStyle = 'mohammadi-gold';
    background = currentState.background === 'mohammadi-emerald' ? 'mohammadi-emerald' : 'mohammadi-royal';
    titlePositionY = 10;
    subtitlePositionY = 14;
    description = 'Applied Mohammadi Academy 1:1 social card: Dignified academic header, gold video framing, and bilingual captions.';
  }
  // Rule 6: General Fallback
  else {
    matchedRule = 'Mohammadi Academy Auto-Fit';
    scale = 0.88;
    offsetY = 0;
    frameStyle = 'mohammadi-gold';
    background = 'mohammadi-royal';
    titlePositionY = 12;
    description = `Optimized Mohammadi Academy frame for ${platformConfig.name} with signature royal backdrop and gold frame.`;
  }

  const newState: Partial<ProjectState> = {
    frameStyle,
    background,
    transform: {
      ...currentState.transform,
      scale,
      offsetY,
      offsetX: 0,
    },
    title: {
      ...currentState.title,
      enabled: true,
      text: currentState.title.text && currentState.title.text !== 'WATCH THIS BEFORE YOU START 🚀' 
        ? currentState.title.text 
        : 'آکادمی محمدی | Mohammadiacademy.org',
      font: currentState.title.font || 'Vazirmatn',
      positionY: titlePositionY,
    },
    subtitles: {
      ...currentState.subtitles,
      enabled: true,
      style: currentState.subtitles.style || 'academic-gold',
      positionY: subtitlePositionY,
    },
    watermark: {
      ...currentState.watermark,
      enabled: true,
      text: 'Mohammadiacademy.org',
    },
    logo: {
      ...currentState.logo,
      enabled: true,
      preset: currentState.logo.preset?.startsWith('mohammadi') ? currentState.logo.preset : 'mohammadi-crest',
    }
  };

  return {
    newState,
    description,
    matchedRule,
  };
}
