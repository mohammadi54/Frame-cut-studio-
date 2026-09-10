import { Platform, PlatformConfig } from '../types';

export const PLATFORMS: Record<Platform, PlatformConfig> = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    badge: '16:9 Landscape',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    recommendedDescription: 'Standard YouTube widescreen, HD 1080p presentation.',
    icon: 'Youtube',
  },
  shorts: {
    id: 'shorts',
    name: 'YouTube Shorts',
    badge: '9:16 Vertical',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    recommendedDescription: 'Optimized vertical feed with viral hook headlines and bottom subtitles.',
    icon: 'Smartphone',
  },
  reels: {
    id: 'reels',
    name: 'Facebook Reels',
    badge: '9:16 Vertical',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    recommendedDescription: 'Full-screen mobile reels with dynamic captions and brand watermark.',
    icon: 'Film',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook Feed',
    badge: '1:1 Square',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    recommendedDescription: 'Square video feed card with header title and bottom brand bar.',
    icon: 'Share2',
  },
};
