import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isLocale, translate, type Locale, type TranslationKey, type TranslationVariables } from './types.js';
import { LocaleContext } from './context.js';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from './config.js';
import { applyDocumentMetadata } from '../seo/metadata.js';

function readSavedLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function saveLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The selected locale remains active for this session when storage is unavailable.
  }
}

export function LocaleProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? readSavedLocale());
  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    saveLocale(nextLocale);
  }, []);
  const t = useCallback(
    (key: TranslationKey, variables?: TranslationVariables) => translate(locale, key, variables),
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    applyDocumentMetadata(locale);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
