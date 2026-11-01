import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
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
});
