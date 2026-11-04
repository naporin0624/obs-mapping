import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ja } from './ja';

describe('messages', () => {
  it('ja and en have identical keys', () => {
    expect(Object.keys(en).toSorted()).toEqual(Object.keys(ja).toSorted());
  });
  it('each key has the same kind (text or function) in both languages', () => {
    const kinds = (m: Record<string, unknown>) => Object.entries(m).map(([k, v]) => [k, typeof v]);
    expect(kinds(en)).toEqual(kinds(ja));
  });
});

describe('surfaceCount', () => {
  it('uses a dash for zero in both languages', () => {
    expect([ja.surfaceCount(0), en.surfaceCount(0)]).toEqual(['—', '—']);
  });
  it('is singular for one in English', () => {
    expect([ja.surfaceCount(1), en.surfaceCount(1)]).toEqual(['1 面', '1 surface']);
  });
  it('is plural for many in English', () => {
    expect([ja.surfaceCount(3), en.surfaceCount(3)]).toEqual(['3 面', '3 surfaces']);
  });
});

describe('bulk source', () => {
  it('counts the selected layers, singular for one in English', () => {
    expect([ja.bulkHeading(1), en.bulkHeading(1), ja.bulkHeading(5), en.bulkHeading(5)]).toEqual(['1 レイヤーを変更', 'Change 1 layer', '5 レイヤーを変更', 'Change 5 layers']);
  });
  it('shows how many kinds of source are mixed', () => {
    expect([ja.bulkMixed(2), en.bulkMixed(2)]).toEqual(['混在 (2種)', 'Mixed (2)']);
  });
});
