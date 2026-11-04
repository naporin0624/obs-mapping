import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkImportable } from '../../mapping/importable';
import { cropAspect, faceAspect } from '../../scene/aspect-checks';
import { buildMapping } from '../../scene/build-mapping';
import { CANVAS } from '../../scene/spec';
import type { Vec3 } from '../../scene/spec';
import { createProjectorCamera, projectToCanvas } from '../../scene/projector';
import { serializeMapping } from '../../scene/serialize';
import { RISERS, stairsScene } from './scene';
import type { Box } from './scene';

const boxes = (): Box[] => stairsScene.props.filter((p): p is Box => p.kind === 'box');

describe('stairsScene', () => {
  it('has exactly 5 faces without masks', () => {
    expect(stairsScene.faces).toHaveLength(RISERS);
    expect(stairsScene.faces.every((f) => f.mask === undefined)).toBe(true);
    expect(stairsScene.faces.map((f) => [f.id, f.name])).toEqual(Array.from({ length: RISERS }, (_, i) => [`riser-${String(i + 1)}`, `Riser ${String(i + 1)}`]));
    expect(stairsScene.steps).toEqual(['place', 'fit', 'done']);
  });

  it('slices a centred full-width band top to bottom without gaps or overlaps', () => {
    const crops = buildMapping(stairsScene).surfaces.map((s) => s.crop);
    for (const c of crops) {
      expect(c.x).toBe(0);
      expect(c.width).toBe(1);
    }
    crops.slice(1).forEach((c, i) => expect(c.y).toBeCloseTo((crops[i]?.y ?? NaN) + (crops[i]?.height ?? NaN), 5));
    const top = crops[0]?.y ?? NaN;
    const bottom = 1 - ((crops.at(-1)?.y ?? NaN) + (crops.at(-1)?.height ?? NaN));
    expect(top).toBeGreaterThan(0);
    expect(bottom).toBeCloseTo(top, 5);
  });

  it('keeps each crop at the aspect of its riser within 1%', () => {
    const { surfaces } = buildMapping(stairsScene);
    stairsScene.faces.forEach((face, i) => {
      const crop = surfaces[i]?.crop;
      if (crop === undefined) throw new Error('missing surface');
      expect(Math.abs(cropAspect(crop) / faceAspect(face) - 1)).toBeLessThan(0.01);
    });
  });

  it('puts each face on the projector-side face of its box', () => {
    const bs = boxes();
    expect(bs).toHaveLength(RISERS);
    stairsScene.faces.forEach((face, i) => {
      const box = bs[i];
      if (box === undefined) throw new Error('missing box');
      const [cx, cy, cz] = box.center;
      const [sx, sy, sz] = box.size;
      const z = cz + sz / 2;
      const expected: Vec3[] = [
        [cx - sx / 2, cy + sy / 2, z],
        [cx + sx / 2, cy + sy / 2, z],
        [cx + sx / 2, cy - sy / 2, z],
        [cx - sx / 2, cy - sy / 2, z],
      ];
      face.corners.forEach((c, k) => {
        c.forEach((v, axis) => expect(v).toBeCloseTo(expected[k]?.[axis] ?? NaN, 9));
      });
      expect(box.rotationY).toBe(0);
    });
  });

  it('keeps the projector in front of every riser face', () => {
    for (const { center, size } of boxes()) expect(stairsScene.projector.position[2]).toBeGreaterThan(center[2] + size[2] / 2);
  });

  it('places higher risers farther from the projector', () => {
    const byHeight = boxes().toSorted((a, b) => a.center[1] - b.center[1]);
    byHeight.slice(1).forEach((higher, i) => {
      const lower = byHeight[i];
      expect(higher.center[1]).toBeGreaterThan(lower?.center[1] ?? NaN);
      expect(higher.center[2]).toBeLessThan(lower?.center[2] ?? NaN);
    });
  });

  it('keeps every projected corner inside the canvas', () => {
    const camera = createProjectorCamera(stairsScene.projector);
    for (const face of stairsScene.faces) {
      for (const corner of face.corners) {
        const [x, y] = projectToCanvas(camera, corner);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(CANVAS.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(CANVAS.height);
      }
    }
  });

  it('looks up at the stairs from below the lowest riser top', () => {
    const lowestTop = Math.min(...boxes().map((b) => b.center[1] + b.size[1] / 2));
    expect(stairsScene.projector.position[1]).toBeLessThan(lowestTop);
  });

  it('matches the committed mapping.json', () => {
    const json = readFileSync(new URL('./mapping.json', import.meta.url), 'utf8');
    expect(json).toBe(serializeMapping(buildMapping(stairsScene)));
  });

  it('is importable', () => {
    expect(checkImportable(buildMapping(stairsScene))).toBeNull();
  });
});
