import { describe, expect, it } from 'vitest';
import { surf } from '../geometry/fixtures';
import { upgradeV1 } from '../model/read';
import { exportMapping } from './export';

describe('exportMapping', () => {
  it('writes an upgraded v1 mapping as v2 with groups and layers', () => {
    const v1 = { version: 1 as const, canvas: { width: 1920, height: 1080 }, grid: { size: 10 }, surfaces: [surf('a', 0, 0)] };
    const json = JSON.parse(exportMapping(upgradeV1(v1))) as Record<string, unknown>;
    expect(json['version']).toBe(2);
    expect(json['groups']).toEqual([]);
    expect(json['layers']).toEqual([{ surface: 'a' }]);
  });
});
