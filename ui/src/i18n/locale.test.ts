import { getDefaultStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { detectLocale, languagesOf, localeAtom } from './locale';

describe('detectLocale', () => {
  it.each([
    [['ja'], 'ja'],
    [['ja-JP'], 'ja'],
    [['JA-jp'], 'ja'],
    [['en-US'], 'en'],
    [['fr'], 'en'],
    [['en-US', 'ja'], 'en'],
    [[], 'en'],
  ] as const)('%j -> %s', (languages, expected) => {
    expect(detectLocale(languages)).toBe(expected);
  });
});

describe('languagesOf', () => {
  it('prefers navigator.languages', () => {
    expect(languagesOf({ languages: ['ja-JP', 'en'], language: 'en' })).toEqual(['ja-JP', 'en']);
  });
  it('falls back to navigator.language when the list is empty', () => {
    expect(languagesOf({ languages: [], language: 'ja' })).toEqual(['ja']);
  });
});

describe('localeAtom', () => {
  it('defaults to ja so nothing reads navigator implicitly', () => {
    expect(getDefaultStore().get(localeAtom)).toBe('ja');
  });
});
