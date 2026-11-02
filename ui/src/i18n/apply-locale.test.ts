import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { applyLocale } from './apply-locale';
import { localeAtom } from './locale';

describe('applyLocale', () => {
  it('sets en into the store for a non-Japanese browser', () => {
    const store = createStore();
    expect(applyLocale(store, { languages: ['en-US'], language: 'en-US' })).toBe('en');
    expect(store.get(localeAtom)).toBe('en');
  });
  it('keeps ja for a Japanese browser', () => {
    const store = createStore();
    expect(applyLocale(store, { languages: ['ja-JP'], language: 'ja-JP' })).toBe('ja');
    expect(store.get(localeAtom)).toBe('ja');
  });
});
