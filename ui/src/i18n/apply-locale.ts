import type { createStore } from 'jotai';
import { detectLocale, languagesOf, localeAtom, type Locale } from './locale';

type Store = ReturnType<typeof createStore>;

/** Puts the browser's language into the store; the caller mirrors the result onto <html lang>. */
export const applyLocale = (store: Store, nav: Parameters<typeof languagesOf>[0]): Locale => {
  const locale = detectLocale(languagesOf(nav));
  store.set(localeAtom, locale);
  return locale;
};
