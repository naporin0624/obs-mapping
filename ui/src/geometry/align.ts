import type { Point, Surface } from '../model/mapping';
import { boundsOf, type Bounds } from './rect';

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY';

export type Item = { id: string; bounds: Bounds };

export const translateSurface = (s: Surface, dx: number, dy: number): Surface => {
  const corners = s.corners.map((p): Point => [p[0] + dx, p[1] + dy]) as unknown as Surface['corners'];
  return { ...s, corners };
};

const selected = (ss: readonly Surface[], ids: readonly string[]): readonly Surface[] => ss.filter((s) => ids.includes(s.id));

const asItems = (ss: readonly Surface[]): Item[] => ss.map((s) => ({ id: s.id, bounds: boundsOf(s) }));

const canvasBounds = (canvas: { width: number; height: number }): Bounds => ({ x: 0, y: 0, width: canvas.width, height: canvas.height });

export const itemsReference = (items: readonly Item[], canvas: { width: number; height: number }): Bounds | undefined => (items.length === 1 ? canvasBounds(canvas) : undefined);

export const alignReference = (ss: readonly Surface[], ids: readonly string[], canvas: { width: number; height: number }): Bounds | undefined => itemsReference(asItems(selected(ss, ids)), canvas);

const unionBounds = (bs: readonly Bounds[]): Bounds => {
  const x = Math.min(...bs.map((b) => b.x));
  const y = Math.min(...bs.map((b) => b.y));
  return { x, y, width: Math.max(...bs.map((b) => b.x + b.width)) - x, height: Math.max(...bs.map((b) => b.y + b.height)) - y };
};

const alignDelta = (b: Bounds, target: Bounds, mode: AlignMode): Point => {
  switch (mode) {
    case 'left':
      return [target.x - b.x, 0];
    case 'right':
      return [target.x + target.width - (b.x + b.width), 0];
    case 'top':
      return [0, target.y - b.y];
    case 'bottom':
      return [0, target.y + target.height - (b.y + b.height)];
    case 'centerX':
      return [target.x + target.width / 2 - (b.x + b.width / 2), 0];
    case 'centerY':
      return [0, target.y + target.height / 2 - (b.y + b.height / 2)];
  }
};

export const alignDeltas = (items: readonly Item[], mode: AlignMode, reference?: Bounds): ReadonlyMap<string, Point> => {
  if (items.length === 0) return new Map();
  const target = reference ?? unionBounds(items.map((i) => i.bounds));
  return new Map(items.map((i) => [i.id, alignDelta(i.bounds, target, mode)]));
};

const startOf = (b: Bounds, axis: 'x' | 'y'): number => (axis === 'x' ? b.x : b.y);

const sizeOf = (b: Bounds, axis: 'x' | 'y'): number => (axis === 'x' ? b.width : b.height);

const centerOf = (b: Bounds, axis: 'x' | 'y'): number => startOf(b, axis) + sizeOf(b, axis) / 2;

export const distributeDeltas = (items: readonly Item[], axis: 'x' | 'y'): ReadonlyMap<string, Point> => {
  if (items.length < 3) return new Map();
  const sorted = [...items].sort((a, b) => centerOf(a.bounds, axis) - centerOf(b.bounds, axis));
  const first = sorted[0] as Item;
  const last = sorted[sorted.length - 1] as Item;
  const span = startOf(last.bounds, axis) + sizeOf(last.bounds, axis) - startOf(first.bounds, axis);
  const gap = (span - sorted.reduce((acc, i) => acc + sizeOf(i.bounds, axis), 0)) / (sorted.length - 1);

  const starts = sorted.reduce<readonly number[]>((acc, item, i) => {
    const prev = sorted[i - 1];
    const prevStart = acc[i - 1];
    return prev === undefined || prevStart === undefined ? [startOf(item.bounds, axis)] : [...acc, prevStart + sizeOf(prev.bounds, axis) + gap];
  }, []);

  return new Map(
    sorted.map((item, i): [string, Point] => {
      const d = (starts[i] ?? 0) - startOf(item.bounds, axis);
      return [item.id, axis === 'x' ? [d, 0] : [0, d]];
    }),
  );
};

const applyDeltas = (ss: readonly Surface[], deltas: ReadonlyMap<string, Point>): Surface[] =>
  ss.map((s) => {
    const d = deltas.get(s.id);
    return d === undefined ? s : translateSurface(s, d[0], d[1]);
  });

export const alignSurfaces = (ss: readonly Surface[], ids: readonly string[], mode: AlignMode, reference?: Bounds): Surface[] =>
  applyDeltas(ss, alignDeltas(asItems(selected(ss, ids)), mode, reference));

export const distributeSurfaces = (ss: readonly Surface[], ids: readonly string[], axis: 'x' | 'y'): Surface[] => applyDeltas(ss, distributeDeltas(asItems(selected(ss, ids)), axis));
