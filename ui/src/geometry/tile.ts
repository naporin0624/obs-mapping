import type { Direction, Surface } from '../model/mapping';
import { boundsOf, rectCorners, type Bounds } from './rect';

export type TileGrid = { cols: number; rows: number; gap: number };

/** One line of equal cells across the whole canvas, as a group lays its children out. */
export type LineTile = { direction: Direction; gap: number };

export const lineGrid = (count: number, { direction, gap }: LineTile): TileGrid => (direction === 'row' ? { cols: count, rows: 1, gap } : { cols: 1, rows: count, gap });

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

const span = (length: number, count: number, gap: number): number => (length - gap * (count - 1)) / count;

/** Equal row-major cells covering the area, with the gap between cells only. Empty when the gaps leave no room. */
export const tileCells = (area: Bounds, { cols, rows, gap }: TileGrid): Bounds[] => {
  const width = span(area.width, cols, gap);
  const height = span(area.height, rows, gap);
  if (width <= 0 || height <= 0) return [];
  return Array.from({ length: rows * cols }, (_, i): Bounds => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return { x: round3(area.x + col * (width + gap)), y: round3(area.y + row * (height + gap)), width: round3(width), height: round3(height) };
  });
};

const centerOf = (s: Surface): { x: number; y: number } => {
  const b = boundsOf(s);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

const rowOf = (y: number, area: Bounds, rows: number): number => Math.min(rows - 1, Math.max(0, Math.floor(((y - area.y) / area.height) * rows)));

/** Reading order: centers bucketed into the target rows, then left to right within a row. */
export const tileOrder = (ss: readonly Surface[], area: Bounds, rows: number): Surface[] => {
  const keyed = ss.map((s) => ({ s, row: rowOf(centerOf(s).y, area, rows), x: centerOf(s).x }));
  return keyed.toSorted((a, b) => a.row - b.row || a.x - b.x).map((k) => k.s);
};

/** Fits the selected surfaces into the cells in reading order; surfaces beyond the last cell stay put. */
export const tileSurfaces = (ss: readonly Surface[], ids: readonly string[], area: Bounds, grid: TileGrid): readonly Surface[] => {
  const cells = tileCells(area, grid);
  if (cells.length === 0) return ss;
  const ordered = tileOrder(
    ss.filter((s) => ids.includes(s.id)),
    area,
    grid.rows,
  );
  const target = new Map(ordered.flatMap((s, i) => (cells[i] === undefined ? [] : [[s.id, cells[i]] as const])));
  return ss.map((s) => {
    const cell = target.get(s.id);
    return cell === undefined ? s : { ...s, corners: rectCorners(cell) };
  });
};
