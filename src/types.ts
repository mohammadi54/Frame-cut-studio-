export type Platform = 'youtube' | 'facebook' | 'shorts' | 'reels';

export interface PlatformConfig {
  id: Platform;
  name: string;
  badge: string;
  aspectRatio: string;
  width: number;
  height: number;
  recommendedDescription: string;
  icon: string;
}

export type FrameStyle = 
  | 'none'
  | 'clean'
  | 'rounded-shadow'
  | 'mohammadi-gold'
  | 'gradient-glow'
  | 'neon-cyber'
  | 'film-strip'
  | 'polaroid'
  | 'studio-card';

export type BackgroundPreset = 
  | 'mohammadi-royal'
  | 'mohammadi-emerald'
  | 'blur-video'
  | 'gradient-sunset'
  | 'gradient-cyber'
  | 'gradient-midnight'
  | 'studio-dark'
  | 'mesh-aurora'
  | 'solid-black'
  | 'solid-slate';

export interface VideoTransform {
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  flipH: boolean;
  flipV: boolean;
}

export interface TrimSettings {
  start: number;
  end: number;
  duration: number;
}

export interface AudioSettings {
  volume: number;
  muted: boolean;
  boost: boolean;
}

export type SubtitleLanguage = 'en' | 'fa' | 'bilingual';

export interface TitleSettings {
  enabled: boolean;
  text: string;
  font: 'Vazirmatn' | 'Amiri' | 'Outfit' | 'Bebas Neue' | 'Plus Jakarta Sans' | 'sans-serif' | 'serif';
  size: number;
  color: string;
  backgroundColor: string;
  backgroundEnabled: boolean;
  positionY: number; // percentage from top (e.g. 12 = 12%)
  letterSpacing: number;
}

export interface SubtitleItem {
  id: string;
  start: number;
  end: number;
  text: string;
  translation?: string; // For bilingual English + Persian captions
  highlight?: string;
}

export type SubtitleStyle = 'hormozi' | 'modern-pill' | 'minimal-shadow' | 'classic-box' | 'academic-gold';

export interface SubtitleSettings {
  enabled: boolean;
  language: SubtitleLanguage; // 'en' | 'fa' | 'bilingual'
  items: SubtitleItem[];
  style: SubtitleStyle;
  positionY: number; // percentage from bottom (e.g. 15 = 15%)
  fontSize: number;
  primaryColor: string;
  highlightColor: string;
  fontFamily?: string;
}

export interface LogoSettings {
  enabled: boolean;
  url: string | null;
  preset: 
    | 'mohammadi-crest' 
    | 'mohammadi-emerald' 
    | 'mohammadi-gold' 
    | 'badge-verified' 
    | 'creator-star' 
    | 'brand-circle' 
    | 'youtube-badge' 
    | 'fire-trend' 
    | 'custom' 
    | 'none';
  size: number;
  opacity: number;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center-top' | 'center-bottom' | 'custom';
  xPercent?: number; // 0 - 100% of canvas width
  yPercent?: number; // 0 - 100% of canvas height
  shape?: 'circle' | 'rounded' | 'square' | 'none';
  borderColor?: string;
  borderWidth?: number;
}

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  opacity: number;
  position: 'bottom-right' | 'bottom-left' | 'top-right';
}

export interface VideoMetadata {
  file: File | null;
  url: string;
  name: string;
  width: number;
  height: number;
  duration: number;
  aspectRatio: number;
  aspectCategory: '16:9' | '9:16' | '1:1' | '4:3' | 'other';
  isDemo?: boolean;
}

export interface ProjectState {
  video: VideoMetadata | null;
  platform: Platform;
  frameStyle: FrameStyle;
  background: BackgroundPreset;
  customBackgroundColor: string;
  transform: VideoTransform;
  trim: TrimSettings;
  audio: AudioSettings;
  title: TitleSettings;
  subtitles: SubtitleSettings;
  logo: LogoSettings;
  watermark: WatermarkSettings;
}
