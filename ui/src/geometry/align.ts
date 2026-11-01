import type { Point, Surface } from '../model/mapping';
import { boundsOf, type Bounds } from './rect';

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY';

export const translateSurface = (s: Surface, dx: number, dy: number): Surface => {
  const corners = s.corners.map((p): Point => [p[0] + dx, p[1] + dy]) as unknown as Surface['corners'];
  return { ...s, corners };
};

const selected = (ss: readonly Surface[], ids: readonly string[]): readonly Surface[] => ss.filter((s) => ids.includes(s.id));

export const alignReference = (ss: readonly Surface[], ids: readonly string[], canvas: { width: number; height: number }): Bounds | undefined =>
  selected(ss, ids).length === 1 ? { x: 0, y: 0, width: canvas.width, height: canvas.height } : undefined;

const unionBounds = (sel: readonly Surface[]): Bounds => {
  const bs = sel.map(boundsOf);
  const x = Math.min(...bs.map((b) => b.x));
  const y = Math.min(...bs.map((b) => b.y));
  return { x, y, width: Math.max(...bs.map((b) => b.x + b.width)) - x, height: Math.max(...bs.map((b) => b.y + b.height)) - y };
};

export const alignSurfaces = (ss: readonly Surface[], ids: readonly string[], mode: AlignMode, reference?: Bounds): Surface[] => {
  const sel = selected(ss, ids);
  if (sel.length === 0) return [...ss];
  const target = reference ?? unionBounds(sel);
  const minX = target.x;
  const maxX = target.x + target.width;
  const minY = target.y;
  const maxY = target.y + target.height;

  const delta = (s: Surface): readonly [number, number] => {
    const b = boundsOf(s);
    switch (mode) {
      case 'left':
        return [minX - b.x, 0];
      case 'right':
        return [maxX - (b.x + b.width), 0];
      case 'top':
        return [0, minY - b.y];
      case 'bottom':
        return [0, maxY - (b.y + b.height)];
      case 'centerX':
        return [(minX + maxX) / 2 - (b.x + b.width / 2), 0];
      case 'centerY':
        return [0, (minY + maxY) / 2 - (b.y + b.height / 2)];
    }
  };

  return ss.map((s) => {
    if (!ids.includes(s.id)) return s;
    const [dx, dy] = delta(s);
    return translateSurface(s, dx, dy);
  });
};

export const distributeSurfaces = (ss: readonly Surface[], ids: readonly string[], axis: 'x' | 'y'): Surface[] => {
  const sel = selected(ss, ids);
  if (sel.length < 3) return [...ss];

  const start = (s: Surface): number => (axis === 'x' ? boundsOf(s).x : boundsOf(s).y);
  const size = (s: Surface): number => (axis === 'x' ? boundsOf(s).width : boundsOf(s).height);
  const sorted = [...sel].sort((a, b) => start(a) + size(a) / 2 - (start(b) + size(b) / 2));
  const first = sorted[0] as Surface;
  const last = sorted[sorted.length - 1] as Surface;

  const span = start(last) + size(last) - start(first);
  const gap = (span - sorted.reduce((acc, s) => acc + size(s), 0)) / (sorted.length - 1);

  // Target start position of each selected surface, keyed by id.
  const targets = new Map(
    sorted.reduce<readonly (readonly [string, number])[]>((acc, s, i) => {
      const prev = i === 0 ? null : (sorted[i - 1] as Surface);
      const prevTarget = acc.length === 0 ? 0 : (acc[acc.length - 1] as readonly [string, number])[1];
      const pos = prev === null ? start(s) : prevTarget + size(prev) + gap;
      return [...acc, [s.id, pos] as const];
    }, []),
  );

  return ss.map((s) => {
    const target = targets.get(s.id);
    if (target === undefined) return s;
    const d = target - start(s);
    return axis === 'x' ? translateSurface(s, d, 0) : translateSurface(s, 0, d);
  });
};
