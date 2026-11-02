import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { collapsedGroupsAtom, toggleCollapsedAtom } from '.';

describe('layers atoms', () => {
  it('starts with no collapsed group', () => {
    expect(createStore().get(collapsedGroupsAtom).size).toBe(0);
  });

  it('toggleCollapsedAtom collapses then expands again', () => {
    const store = createStore();
    store.set(toggleCollapsedAtom, 'g1');
    expect([...store.get(collapsedGroupsAtom)]).toEqual(['g1']);
    store.set(toggleCollapsedAtom, 'g1');
    expect(store.get(collapsedGroupsAtom).size).toBe(0);
  });
});
