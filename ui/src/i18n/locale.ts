import { atom } from 'jotai';

export type Locale = 'ja' | 'en';

export const localeAtom = atom<Locale>('ja');

export const detectLocale = (languages: readonly string[]): Locale => (languages[0]?.toLowerCase().startsWith('ja') === true ? 'ja' : 'en');

type NavigatorLanguages = Pick<Navigator, 'languages' | 'language'>;

export const languagesOf = (nav: NavigatorLanguages): readonly string[] => (nav.languages.length > 0 ? nav.languages : [nav.language]);
