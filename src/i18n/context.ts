import { createContext, useContext } from 'react';
import { DEFAULT_LOCALE } from './config.js';
import { translate, type Locale, type TranslationKey, type TranslationVariables } from './types.js';

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
}

const defaultValue: LocaleContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (key, variables) => translate(DEFAULT_LOCALE, key, variables),
};

export const LocaleContext = createContext<LocaleContextValue>(defaultValue);

export function useI18n(): LocaleContextValue {
  return useContext(LocaleContext);
}
