import { describe, expect, it } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import type { Mapping, Surface } from '../model/mapping';
import { clickTarget, deepTarget, drillTarget, pickPath, surfaceAt } from './stage-pick';
import { emptySelection, type Selection } from './state';

const tree = (): Mapping => ({
  ...mapOf(surf('s1', 0, 0), surf('s2', 20, 0), surf('s3', 100, 0)),
  groups: [groupOf('g1'), groupOf('g2')],
  layers: [gn('g1', gn('g2', sn('s1'), sn('s2'))), sn('s3')],
});

const sel = (surfaceIds: string[] = [], groupIds: string[] = []): Selection => ({ ...emptySelection(), surfaceIds, groupIds });

describe('pickPath', () => {
  it('lists ids from the outermost group to the surface', () => {
    expect(pickPath(tree(), 's1')).toEqual(['g1', 'g2', 's1']);
    expect(pickPath(tree(), 's3')).toEqual(['s3']);
  });
});

describe('clickTarget', () => {
  const m = tree();
  it('selects the outermost group when nothing is selected', () => {
    expect(clickTarget(m, pickPath(m, 's1'), emptySelection())).toBe('g1');
  });
  it('selects a top-level surface itself', () => {
    expect(clickTarget(m, pickPath(m, 's3'), emptySelection())).toBe('s3');
  });
  it('stays at the level already drilled into', () => {
    expect(clickTarget(m, pickPath(m, 's2'), sel(['s1']))).toBe('s2');
    expect(clickTarget(m, pickPath(m, 's1'), sel([], ['g2']))).toBe('g2');
  });
  it('keeps the selected group when pressed again', () => {
    expect(clickTarget(m, pickPath(m, 's1'), sel([], ['g1']))).toBe('g1');
  });
});

describe('drillTarget', () => {
  const m = tree();
  const path = pickPath(m, 's1');
  it('goes one level in per double click and stops at the surface', () => {
    expect(drillTarget(path, emptySelection())).toBe('g1');
    expect(drillTarget(path, sel([], ['g1']))).toBe('g2');
    expect(drillTarget(path, sel([], ['g2']))).toBe('s1');
    expect(drillTarget(path, sel(['s1']))).toBe('s1');
  });
});

describe('deepTarget', () => {
  it('is the surface itself', () => {
    expect(deepTarget(['g1', 'g2', 's1'])).toBe('s1');
  });
});

describe('surfaceAt', () => {
  it('returns the frontmost of overlapping surfaces', () => {
    const m = mapOf(surf('back', 0, 0, 100, 100), surf('front', 50, 50, 100, 100));
    expect(surfaceAt(m, [60, 60])).toBe('front');
    expect(surfaceAt(m, [10, 10])).toBe('back');
    expect(surfaceAt(m, [500, 500])).toBeNull();
  });
  it('skips surfaces hidden by a group', () => {
    const m: Mapping = { ...tree(), groups: [groupOf('g1', { visible: false }), groupOf('g2')] };
    expect(surfaceAt(m, [5, 5])).toBeNull();
    expect(surfaceAt(m, [105, 5])).toBe('s3');
  });
});

describe('surfaceAt even-odd rule', () => {
  const quad = (id: string, corners: Surface['corners']): Surface => ({ ...surf(id, 0, 0), corners });
  it('excludes the notch of a non-convex quad', () => {
    const m = mapOf(
      quad('c', [
        [0, 0],
        [100, 0],
        [50, 40],
        [0, 100],
      ]),
    );
    expect([surfaceAt(m, [10, 50]), surfaceAt(m, [80, 80])]).toEqual(['c', null]);
  });
  it('excludes the crossing-over lobes of a bow-tie by even-odd', () => {
    const m = mapOf(
      quad('b', [
        [0, 0],
        [100, 100],
        [100, 0],
        [0, 100],
      ]),
    );
    expect([surfaceAt(m, [50, 10]), surfaceAt(m, [10, 50]), surfaceAt(m, [50, 90])]).toEqual([null, 'b', null]);
  });
});
