import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { maskContains } from '../../../../ui/src/geometry/mask';
import { MASK_MAX_POINTS, type Point } from '../../../../ui/src/model/mapping';
import { checkImportable } from '../../mapping/importable';
import { cropAspect, faceAspect } from '../../scene/aspect-checks';
import { BOX_SIDES, boxFace, boxFaceNormal } from '../../scene/box-face';
import { buildMapping } from '../../scene/build-mapping';
import { createProjectorCamera, projectToCanvas } from '../../scene/projector';
import { serializeMapping } from '../../scene/serialize';
import { CANVAS } from '../../scene/spec';
import type { Face, Prop, Vec3 } from '../../scene/spec';
import { cubesScene } from './scene';

type Box = Extract<Prop, { kind: 'box' }>;

const IDS = ['large-left', 'large-right', 'large-top-left', 'large-top-right', 'medium-left', 'medium-right', 'medium-top-left', 'medium-top-right', 'small-left', 'small-right', 'small-top'];
const HOLED = ['large-left', 'large-right', 'medium-right'];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const centroid = (cs: readonly Vec3[]): Vec3 => cs.reduce<Vec3>((s, c) => [s[0] + c[0] / cs.length, s[1] + c[1] / cs.length, s[2] + c[2] / cs.length], [0, 0, 0]);

const boxes = (): Box[] => cubesScene.props.filter((p): p is Box => p.kind === 'box');
const faceById = (id: string): Face => {
  const face = cubesScene.faces.find((f) => f.id === id);
  if (face === undefined) throw new Error(`missing ${id}`);
  return face;
};
const toProjector = (box: Box, side: (typeof BOX_SIDES)[number]): number => dot(boxFaceNormal(box, side), unit(sub(cubesScene.projector.position, centroid(boxFace(box, side)))));

const canvasQuads = (): Point[][] => buildMapping(cubesScene).surfaces.map((s) => [...s.corners]);
const signedArea = (q: readonly Point[]): number => q.reduce((s, [x, y], i) => s + x * (q[(i + 1) % q.length]?.[1] ?? y) - (q[(i + 1) % q.length]?.[0] ?? x) * y, 0) / 2;

const projectAxis = (q: readonly Point[], [ax, ay]: Point): number[] => q.map(([x, y]) => x * ax + y * ay);
const edgeNormals = (q: readonly Point[]): Point[] =>
  q.map(([x, y], i) => {
    const [nx, ny] = q[(i + 1) % q.length] ?? [x, y];
    return [-(ny - y), nx - x];
  });
// Convex quads overlap iff no edge normal separates them; touching edges count as apart.
const interiorsOverlap = (a: readonly Point[], b: readonly Point[]): boolean =>
  [...edgeNormals(a), ...edgeNormals(b)].every((axis) => {
    const pa = projectAxis(a, axis);
    const pb = projectAxis(b, axis);
    return Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) > 0.5 * Math.hypot(...axis);
  });

describe('cubesScene', () => {
  it('stacks three cubes with eleven named faces and the 4-step flow', () => {
    expect(cubesScene.slug).toBe('cubes');
    expect(boxes()).toHaveLength(3);
    for (const b of boxes()) expect(new Set(b.size).size).toBe(1);
    expect(cubesScene.faces.map((f) => f.id)).toEqual(IDS);
    expect(new Set(cubesScene.faces.map((f) => f.name)).size).toBe(IDS.length);
    expect(cubesScene.steps).toEqual(['place', 'fit', 'shape', 'done']);
  });

  it('rests each cube on the back corner of the one below, inside its top', () => {
    const [large, medium, small] = boxes();
    for (const [lower, upper] of [
      [large, medium],
      [medium, small],
    ] as const) {
      if (lower === undefined || upper === undefined) throw new Error('missing box');
      expect(upper.center[1] - upper.size[1] / 2).toBeCloseTo(lower.center[1] + lower.size[1] / 2, 9);
      expect(upper.rotationY).toBe(lower.rotationY);
      const [tl] = boxFace(lower, 'top');
      const [upperTl] = boxFace(upper, 'top');
      upperTl.forEach((v, axis) => {
        if (axis !== 1) expect(v).toBeCloseTo(tl[axis] ?? NaN, 9);
      });
    }
    expect(large?.center[1]).toBeCloseTo((large?.size[1] ?? NaN) / 2, 9);
  });

  it('turns a vertical edge of every cube to the projector so two sides and the top face it', () => {
    for (const b of boxes()) {
      const lit = BOX_SIDES.filter((side) => toProjector(b, side) > 0.15);
      expect(lit).toEqual(['front', 'right', 'top']);
      expect(Math.abs(toProjector(b, 'front') - toProjector(b, 'right'))).toBeLessThan(0.3);
    }
  });

  it('puts the side faces exactly on their cube and the top strips on the uncovered part of the top', () => {
    const [large, medium, small] = boxes();
    if (large === undefined || medium === undefined || small === undefined) throw new Error('missing box');
    const pairs: [string, Box, 'front' | 'right' | 'top'][] = [
      ['large-left', large, 'front'],
      ['large-right', large, 'right'],
      ['medium-left', medium, 'front'],
      ['medium-right', medium, 'right'],
      ['small-left', small, 'front'],
      ['small-right', small, 'right'],
      ['small-top', small, 'top'],
    ];
    for (const [id, box, side] of pairs) expect(faceById(id).corners).toEqual(boxFace(box, side));
    for (const [lower, upper, name] of [
      [large, medium, 'large'],
      [medium, small, 'medium'],
    ] as const) {
      const top = lower.center[1] + lower.size[1] / 2;
      const strips = [faceById(`${name}-top-left`), faceById(`${name}-top-right`)];
      for (const s of strips) for (const c of s.corners) expect(c[1]).toBeCloseTo(top, 9);
      const area = (f: Face): number => Math.hypot(...sub(f.corners[1], f.corners[0])) * Math.hypot(...sub(f.corners[3], f.corners[0]));
      expect(strips.reduce((s, f) => s + area(f), 0) + upper.size[0] * upper.size[2]).toBeCloseTo(lower.size[0] * lower.size[2], 9);
    }
  });

  it('orders every projected quad TL, TR, BR, BL clockwise, sides upright and Left left of Right', () => {
    const { surfaces } = buildMapping(cubesScene);
    for (const s of surfaces) expect(signedArea(s.corners)).toBeGreaterThan(0);
    for (const s of surfaces.filter((x) => !x.id.includes('top'))) {
      const [tl, tr, br, bl] = s.corners;
      expect(tl[1]).toBeLessThan(bl[1]);
      expect(tr[1]).toBeLessThan(br[1]);
    }
    for (const name of ['large', 'medium', 'small']) {
      const left = surfaces.find((s) => s.id === `${name}-left`)?.corners ?? [];
      const right = surfaces.find((s) => s.id === `${name}-right`)?.corners ?? [];
      const meanX = (q: readonly Point[]): number => q.reduce((sum, [x]) => sum + x, 0) / q.length;
      expect(meanX(left)).toBeLessThan(meanX(right));
    }
  });

  it('never overlaps two projected quads, so layer order cannot matter', () => {
    const quads = canvasQuads();
    quads.forEach((a, i) => quads.slice(i + 1).forEach((b) => expect(interiorsOverlap(a, b)).toBe(false)));
  });

  it('keeps every projected corner inside the canvas and fills a good part of it', () => {
    const camera = createProjectorCamera(cubesScene.projector);
    const points = cubesScene.faces.flatMap((f) => f.corners.map((c) => projectToCanvas(camera, c)));
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(CANVAS.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(CANVAS.height);
    }
    const ys = points.map(([, y]) => y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(CANVAS.height * 0.6);
  });

  it('looks down at the stack from 25 to 35 degrees above it', () => {
    const { position, target } = cubesScene.projector;
    const d = sub(target, position);
    const down = (Math.atan2(-d[1], Math.hypot(d[0], d[2])) * 180) / Math.PI;
    expect(down).toBeGreaterThanOrEqual(25);
    expect(down).toBeLessThanOrEqual(35);
  });

  it('crops the centre of the source at the aspect of each face', () => {
    for (const f of cubesScene.faces) {
      expect(Math.abs(cropAspect(f.crop) / faceAspect(f) - 1)).toBeLessThan(0.01);
      expect(f.crop.x + f.crop.width / 2).toBeCloseTo(0.5, 9);
      expect(f.crop.y + f.crop.height / 2).toBeCloseTo(0.5, 9);
    }
  });

  it('cuts an even-odd hole into three faces and leaves the rest unmasked', () => {
    expect(cubesScene.faces.filter((f) => f.mask !== undefined).map((f) => f.id)).toEqual(HOLED);
    for (const id of HOLED) {
      const { mask } = faceById(id);
      if (mask?.type !== 'polygon') throw new Error(`${id}: expected a polygon mask`);
      expect(mask.points.length).toBeLessThanOrEqual(MASK_MAX_POINTS);
      expect(maskContains(mask, [0.5, 0.5])).toBe(false);
      for (const lit of [
        [0.5, 0.24],
        [0.5, 0.76],
        [0.24, 0.5],
        [0.76, 0.5],
        [0.03, 0.03],
        [0.97, 0.97],
      ] as const)
        expect(maskContains(mask, lit)).toBe(true);
    }
  });

  it('matches the committed mapping.json', () => {
    const json = readFileSync(new URL('./mapping.json', import.meta.url), 'utf8');
    expect(json).toBe(serializeMapping(buildMapping(cubesScene)));
  });

  it('is importable', () => {
    expect(checkImportable(buildMapping(cubesScene))).toBeNull();
  });
});
