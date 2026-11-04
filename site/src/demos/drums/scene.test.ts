import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyH, unitSquareToQuad } from '../../../../ui/src/geometry/homography';
import { checkImportable } from '../../mapping/importable';
import { cropAspect, faceAspect } from '../../scene/aspect-checks';
import { buildMapping } from '../../scene/build-mapping';
import { drumHeadCenter, drumHeadFace } from '../../scene/drum-head-face';
import type { DrumProp } from '../../scene/drum-head-face';
import { createProjectorCamera, projectToCanvas } from '../../scene/projector';
import { serializeMapping } from '../../scene/serialize';
import { CANVAS } from '../../scene/spec';
import type { Vec3 } from '../../scene/spec';
import { drumsScene } from './scene';

const drums = (): DrumProp[] => drumsScene.props.filter((p): p is DrumProp => p.kind === 'drum');

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = ([x, y, z]: Vec3, k: number): Vec3 => [x * k, y * k, z * k];
const add = ([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 => [ax + bx, ay + by, az + bz];
const cross = ([ax, ay, az]: Vec3, [bx, by, bz]: Vec3): Vec3 => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
const unit = (v: Vec3): Vec3 => scale(v, 1 / Math.hypot(...v));

const headRimPoint = (drum: DrumProp, theta: number): Vec3 => {
  const n = unit(drum.normal);
  const right = unit(cross([0, 1, 0], n));
  const up = cross(n, right);
  return add(drumHeadCenter(drum), add(scale(right, drum.radius * Math.cos(theta)), scale(up, -drum.radius * Math.sin(theta))));
};

const degFromSight = (drum: DrumProp): number => {
  const toProjector = unit(sub(drumsScene.projector.position, drumHeadCenter(drum)));
  return (Math.acos(dot(unit(drum.normal), toProjector)) * 180) / Math.PI;
};

describe('drumsScene', () => {
  it('has five heads with an ellipse mask filling the face and the 4-step flow', () => {
    const { faces, steps } = drumsScene;
    expect(faces.map((f) => [f.id, f.name])).toEqual([
      ['kick', 'Kick'],
      ['snare', 'Snare'],
      ['tom-1', 'Tom 1'],
      ['tom-2', 'Tom 2'],
      ['floor-tom', 'Floor Tom'],
    ]);
    for (const f of faces) expect(f.mask).toEqual({ type: 'ellipse', x: 0, y: 0, width: 1, height: 1 });
    expect(steps).toEqual(['place', 'fit', 'shape', 'done']);
  });

  it('derives every face from its drum prop', () => {
    const ps = drums();
    expect(ps).toHaveLength(drumsScene.faces.length);
    drumsScene.faces.forEach((face, i) => {
      const prop = ps[i];
      if (prop === undefined) throw new Error('missing drum');
      expect(face.corners).toEqual(drumHeadFace(prop));
    });
  });

  it('crops the centered square of the 16:9 source for every face', () => {
    for (const f of drumsScene.faces) expect(f.crop).toEqual({ x: 7 / 32, y: 0, width: 9 / 16, height: 1 });
  });

  it('keeps each crop at the aspect of its face', () => {
    for (const f of buildMapping(drumsScene).surfaces) expect(cropAspect(f.crop)).toBeCloseTo(1, 2);
    for (const f of drumsScene.faces) expect(cropAspect(f.crop) / faceAspect(f)).toBeCloseTo(1, 2);
  });

  it('keeps the ellipse mask on the projected head rim within 0.5px', () => {
    const camera = createProjectorCamera(drumsScene.projector);
    const { surfaces } = buildMapping(drumsScene);
    drums().forEach((drum, i) => {
      const surface = surfaces[i];
      if (surface === undefined) throw new Error('missing surface');
      const h = unitSquareToQuad(surface.corners);
      if (h === null) throw new Error('degenerate quad');
      for (let k = 0; k < 8; k++) {
        const theta = (k * Math.PI) / 4;
        const [ex, ey] = projectToCanvas(camera, headRimPoint(drum, theta));
        const mapped = applyH(h, [0.5 + 0.5 * Math.cos(theta), 0.5 + 0.5 * Math.sin(theta)]);
        if (mapped === null) throw new Error('unmapped point');
        expect(Math.hypot(mapped[0] - ex, mapped[1] - ey)).toBeLessThan(0.5);
      }
    });
  });

  it('tilts every head except the kick at least 20 degrees from the line of sight', () => {
    drums().forEach((drum, i) => {
      if (i === 0) expect(degFromSight(drum)).toBeLessThan(20);
      else expect(degFromSight(drum)).toBeGreaterThanOrEqual(20);
    });
  });

  it('has unit normals facing the projector and no two heads overlapping in 3D', () => {
    const ps = drums();
    for (const p of ps) {
      expect(Math.hypot(...p.normal)).toBeCloseTo(1, 9);
      expect(degFromSight(p)).toBeLessThan(90);
    }
    ps.forEach((a, i) =>
      ps.slice(i + 1).forEach((b) => {
        const gap = Math.hypot(...sub(drumHeadCenter(a), drumHeadCenter(b)));
        expect(gap).toBeGreaterThan(a.radius + b.radius);
      }),
    );
  });

  it('keeps every projected corner inside the canvas and fills a good part of it', () => {
    const camera = createProjectorCamera(drumsScene.projector);
    const pts = drumsScene.faces.flatMap((f) => f.corners.map((c) => projectToCanvas(camera, c)));
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(CANVAS.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(CANVAS.height);
    }
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    expect((Math.max(...xs) - Math.min(...xs)) / CANVAS.width).toBeGreaterThan(0.6);
    expect((Math.max(...ys) - Math.min(...ys)) / CANVAS.height).toBeGreaterThan(0.5);
  });

  it('matches the committed mapping.json', () => {
    const json = readFileSync(new URL('./mapping.json', import.meta.url), 'utf8');
    expect(json).toBe(serializeMapping(buildMapping(drumsScene)));
  });

  it('is importable', () => {
    expect(checkImportable(buildMapping(drumsScene))).toBeNull();
  });
});
