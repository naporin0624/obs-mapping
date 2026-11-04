import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkImportable } from '../../mapping/importable';
import { cropAspect, faceAspect } from '../../scene/aspect-checks';
import { buildMapping } from '../../scene/build-mapping';
import { hexPanelFace, type HexPanel } from '../../scene/hex-panel-face';
import { createProjectorCamera, projectToCanvas } from '../../scene/projector';
import { serializeMapping } from '../../scene/serialize';
import { CANVAS } from '../../scene/spec';
import type { CropRect, Vec3 } from '../../scene/spec';
import { hexagonScene } from './scene';

type P2 = readonly [number, number];

const HEX: readonly P2[] = [
  [0, 0.5],
  [0.25, 0],
  [0.75, 0],
  [1, 0.5],
  [0.75, 1],
  [0.25, 1],
];

const panels = (): HexPanel[] => hexagonScene.props.filter((p): p is HexPanel => p.kind === 'hexPanel');

const cropHexagon = ({ x, y, width, height }: CropRect): P2[] => HEX.map(([u, v]) => [x + u * width, y + v * height]);

const axisOverlap = (a: readonly P2[], b: readonly P2[], [ax, ay]: P2): number => {
  const pa = a.map(([x, y]) => x * ax + y * ay);
  const pb = b.map(([x, y]) => x * ax + y * ay);
  return Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
};

const normals = (poly: readonly P2[]): P2[] =>
  poly.map(([x, y], i) => {
    const [nx, ny] = poly[(i + 1) % poly.length] ?? [x, y];
    return [-(ny - y), nx - x];
  });

const interiorsOverlap = (a: readonly P2[], b: readonly P2[]): boolean => [...normals(a), ...normals(b)].every((axis) => axisOverlap(a, b, axis) > 1e-6 * Math.hypot(...axis));

describe('hexagonScene', () => {
  it('has 9 to 14 hexagon tiles named Tile n with flat-top polygon masks', () => {
    const { faces, steps } = hexagonScene;
    expect(faces.length).toBeGreaterThanOrEqual(9);
    expect(faces.length).toBeLessThanOrEqual(14);
    expect(faces.map((f) => [f.id, f.name])).toEqual(faces.map((_, i) => [`tile-${String(i + 1)}`, `Tile ${String(i + 1)}`]));
    for (const f of faces) expect(f.mask).toEqual({ type: 'polygon', points: HEX });
    expect(steps).toEqual(['place', 'fit', 'shape', 'done']);
  });

  it('derives every face from its hexPanel prop', () => {
    const ps = panels();
    expect(ps).toHaveLength(hexagonScene.faces.length);
    hexagonScene.faces.forEach((face, i) => {
      const panel = ps[i];
      if (panel === undefined) throw new Error('missing panel');
      expect(face.corners).toEqual(hexPanelFace(panel));
    });
  });

  it('uses at least 3 distinct normals including one tilted 8 degrees or more from the wall', () => {
    const keys = new Set(panels().map((p) => p.normal.map((v) => v.toFixed(6)).join(',')));
    expect(keys.size).toBeGreaterThanOrEqual(3);
    const wall: Vec3 = [0, 0, 1];
    const angles = panels().map((p) => (Math.acos(p.normal[0] * wall[0] + p.normal[1] * wall[1] + p.normal[2] * wall[2]) * 180) / Math.PI);
    expect(Math.max(...angles)).toBeGreaterThanOrEqual(8);
  });

  it('varies the depth and keeps unit normals facing the projector', () => {
    expect(new Set(panels().map((p) => p.depth)).size).toBeGreaterThan(2);
    for (const p of panels()) {
      expect(Math.hypot(...p.normal)).toBeCloseTo(1, 9);
      expect(p.normal[2]).toBeGreaterThan(0);
      expect(hexagonScene.projector.position[2]).toBeGreaterThan(p.center[2] + p.depth);
    }
  });

  it('crops the honeycomb layout inside [0,1] with no overlapping hexagons', () => {
    const crops = hexagonScene.faces.map((f) => f.crop);
    for (const c of crops) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width).toBeLessThanOrEqual(1 + 1e-9);
      expect(c.y + c.height).toBeLessThanOrEqual(1 + 1e-9);
    }
    const hexes = crops.map(cropHexagon);
    hexes.forEach((a, i) => hexes.slice(i + 1).forEach((b) => expect(interiorsOverlap(a, b)).toBe(false)));
  });

  it('spans the centred full-height region of the source: some crop touches each of its edges', () => {
    const crops = hexagonScene.faces.map((f) => f.crop);
    const left = Math.min(...crops.map((c) => c.x));
    expect(left).toBeGreaterThan(0);
    expect(Math.max(...crops.map((c) => c.x + c.width))).toBeCloseTo(1 - left, 9);
    expect(Math.min(...crops.map((c) => c.y))).toBe(0);
    expect(Math.max(...crops.map((c) => c.y + c.height))).toBeCloseTo(1, 9);
  });

  it('keeps each crop at the aspect of its tile within 1%', () => {
    const { surfaces } = buildMapping(hexagonScene);
    hexagonScene.faces.forEach((face, i) => {
      const crop = surfaces[i]?.crop;
      if (crop === undefined) throw new Error('missing surface');
      expect(Math.abs(cropAspect(crop) / faceAspect(face) - 1)).toBeLessThan(0.01);
    });
  });

  it('keeps every projected corner inside the canvas and fills a good part of it', () => {
    const camera = createProjectorCamera(hexagonScene.projector);
    const pts = hexagonScene.faces.flatMap((f) => f.corners.map((c) => projectToCanvas(camera, c)));
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(CANVAS.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(CANVAS.height);
    }
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    expect((Math.max(...xs) - Math.min(...xs)) / CANVAS.width).toBeGreaterThan(0.6);
    expect((Math.max(...ys) - Math.min(...ys)) / CANVAS.height).toBeGreaterThan(0.6);
  });

  it('builds crops that satisfy the plugin import limits exactly', () => {
    for (const { crop } of buildMapping(hexagonScene).surfaces) {
      expect(crop.x + crop.width).toBeLessThanOrEqual(1);
      expect(crop.y + crop.height).toBeLessThanOrEqual(1);
    }
  });

  it('matches the committed mapping.json', () => {
    const json = readFileSync(new URL('./mapping.json', import.meta.url), 'utf8');
    expect(json).toBe(serializeMapping(buildMapping(hexagonScene)));
  });

  it('is importable', () => {
    expect(checkImportable(buildMapping(hexagonScene))).toBeNull();
  });
});
