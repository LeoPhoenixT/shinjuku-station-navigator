import type { Locale } from '../i18n/types.js';

export const SITE_ORIGIN = 'https://shinjuku.leotctam.com';

export interface SeoMetadata {
  title: string;
  description: string;
  path: string;
  ogLocale: string;
}

export interface SeoFallbackContent {
  intro: string;
  sectionTitle: string;
  sectionDescription: string;
  javascriptRequired: string;
}

export const SEO_METADATA: Record<Locale, SeoMetadata> = {
  en: {
    title: 'Shinjuku Station Navigator',
    description: 'Plan walking routes through Shinjuku Station with a 3D map, accessible route profiles, and searchable facilities.',
    path: '/',
    ogLocale: 'en_US',
  },
  ja: {
    title: '新宿駅ナビゲーター',
    description: '3D地図、バリアフリー経路、施設検索で新宿駅構内の徒歩ルートを計画できます。',
    path: '/ja/',
    ogLocale: 'ja_JP',
  },
};

export const SEO_FALLBACK_CONTENT: Record<Locale, SeoFallbackContent> = {
  en: {
    intro: 'Plan walking routes through Shinjuku Station with a 3D indoor map.',
    sectionTitle: 'Accessible station routes',
    sectionDescription: 'Search ticket gates, platforms, exits, and facilities, then choose a route that is shortest, wheelchair accessible, avoids stairs, or prefers elevators.',
    javascriptRequired: 'This interactive map needs JavaScript to calculate and display routes.',
  },
  ja: {
    intro: '3D屋内地図で新宿駅構内の徒歩ルートを計画できます。',
    sectionTitle: 'バリアフリー対応の駅構内ルート',
    sectionDescription: '改札、ホーム、出口、施設を検索し、最短、車いす対応、階段回避、エレベーター優先の経路を選べます。',
    javascriptRequired: '経路の検索と表示にはJavaScriptが必要です。',
  },
};
