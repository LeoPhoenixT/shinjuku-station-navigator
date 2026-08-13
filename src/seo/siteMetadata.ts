import type { Locale } from '../i18n/types.js';

export const SITE_ORIGIN = 'https://shinjuku.leotctam.com';

export const SEO_METADATA: Record<Locale, { title: string; description: string; path: string; ogLocale: string }> = {
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
