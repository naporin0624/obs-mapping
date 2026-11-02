import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { localeAtom } from '../../i18n/locale';
import { EMPTY_RESPONSE } from '../../i18n/localize-error';
import { dismissToastAtom, reportErrorAtom, toastAtom } from '.';

describe('toast atoms', () => {
  it('shows an error with a new id each time and clears on dismiss', () => {
    const store = createStore();
    store.set(reportErrorAtom, 'one');
    store.set(reportErrorAtom, 'two');
    expect(store.get(toastAtom)).toEqual({ id: 2, text: 'two' });
    store.set(dismissToastAtom);
    expect(store.get(toastAtom)).toBeNull();
  });

  it('localizes the app-originated empty response message', () => {
    const store = createStore();
    store.set(localeAtom, 'en');
    store.set(reportErrorAtom, EMPTY_RESPONSE);
    expect(store.get(toastAtom)?.text).toBe('Empty response from the plugin');
  });
});
