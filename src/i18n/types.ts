import { en, type TranslationKey } from './catalogs/en.js';
import { ja } from './catalogs/ja.js';

export const SUPPORTED_LOCALES = ['en', 'ja'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TranslationVariables = Readonly<Record<string, string | number>>;

const catalogs = { en, ja } as const;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as Locale);
}

export function translate(locale: Locale, key: TranslationKey, variables: TranslationVariables = {}): string {
  return Object.entries(variables).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    catalogs[locale][key] as string,
  );
}

export type { TranslationKey };
