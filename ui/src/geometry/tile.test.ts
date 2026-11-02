import { describe, expect, it } from 'vitest';
import type { Surface } from '../model/mapping';
import { surf } from './fixtures';
import { boundsOf, rectCorners } from './rect';
import { lineGrid, tileCells, tileOrder, tileSurfaces } from './tile';

const area = { x: 0, y: 0, width: 1920, height: 1080 };

describe('tileCells', () => {
  it('splits the area into equal row-major cells', () => {
    expect(tileCells(area, { cols: 3, rows: 2, gap: 0 })).toEqual([
      { x: 0, y: 0, width: 640, height: 540 },
      { x: 640, y: 0, width: 640, height: 540 },
      { x: 1280, y: 0, width: 640, height: 540 },
      { x: 0, y: 540, width: 640, height: 540 },
      { x: 640, y: 540, width: 640, height: 540 },
      { x: 1280, y: 540, width: 640, height: 540 },
    ]);
  });
  it('puts the gap between cells only, never on the outer edge', () => {
    const cells = tileCells(area, { cols: 2, rows: 1, gap: 20 });
    expect(cells).toEqual([
      { x: 0, y: 0, width: 950, height: 1080 },
      { x: 970, y: 0, width: 950, height: 1080 },
    ]);
  });
  it('rounds uneven splits to 3 decimals', () => {
    const [first, second] = tileCells(area, { cols: 7, rows: 1, gap: 0 });
    expect(first?.width).toBe(274.286);
    expect(second?.x).toBe(274.286);
  });
  it('is empty when the gaps leave no room for the cells', () => {
    expect(tileCells(area, { cols: 3, rows: 1, gap: 960 })).toEqual([]);
  });
});

describe('tileOrder', () => {
  it('reads a single row left to right even when the surfaces sit at different heights', () => {
    const ss = [surf('c', 1500, 0), surf('a', 100, 600), surf('b', 800, 300)];
    expect(tileOrder(ss, area, 1).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
  it('reads a single column top to bottom', () => {
    const ss = [surf('b', 0, 500), surf('a', 900, 10), surf('c', 400, 1000)];
    expect(tileOrder(ss, area, 3).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
  it('buckets centers into the target rows, then reads each row left to right', () => {
    const ss = [surf('d', 1000, 700), surf('b', 1000, 100), surf('c', 0, 800), surf('a', 0, 200)];
    expect(tileOrder(ss, area, 2).map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('keeps centers past the area edge in the nearest row', () => {
    const ss = [surf('b', 0, 2000), surf('a', 0, -500)];
    expect(tileOrder(ss, area, 2).map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('tileSurfaces', () => {
  const grid = { cols: 3, rows: 1, gap: 0 };

  it('sets each selected surface to its cell rectangle in reading order', () => {
    const ss = [surf('b', 900, 0), surf('a', 0, 0), surf('c', 1800, 0)];
    const out = tileSurfaces(ss, ['a', 'b', 'c'], area, grid);
    expect(out.map((s) => [s.id, boundsOf(s).x, boundsOf(s).width])).toEqual([
      ['b', 640, 640],
      ['a', 0, 640],
      ['c', 1280, 640],
    ]);
  });
  it('discards a perspective warp by writing all four corners from the cell', () => {
    const warped: Surface = {
      ...surf('a', 0, 0),
      corners: [
        [5, 5],
        [100, 0],
        [90, 80],
        [0, 100],
      ],
    };
    const [out] = tileSurfaces([warped], ['a'], area, { cols: 1, rows: 1, gap: 0 });
    expect(out?.corners).toEqual(rectCorners(area));
  });
  it('leaves unselected surfaces as they are', () => {
    const other = surf('x', 5, 5);
    const out = tileSurfaces([surf('a', 0, 0), other], ['a'], area, grid);
    expect(out[1]).toBe(other);
  });
  it('leaves the surfaces that do not fit in the cells untouched', () => {
    const ss = [surf('a', 0, 0), surf('b', 500, 0), surf('c', 1000, 0)];
    const out = tileSurfaces(ss, ['a', 'b', 'c'], area, { cols: 2, rows: 1, gap: 0 });
    expect(out[2]).toBe(ss[2]);
    expect(boundsOf(out[1]!).x).toBe(960);
  });
  it('leaves the remaining cells empty when fewer surfaces are selected', () => {
    const out = tileSurfaces([surf('a', 0, 0)], ['a'], area, { cols: 2, rows: 2, gap: 0 });
    expect(boundsOf(out[0]!)).toEqual({ x: 0, y: 0, width: 960, height: 540 });
  });
  it('returns the input when no cell fits', () => {
    const ss = [surf('a', 0, 0)];
    expect(tileSurfaces(ss, ['a'], area, { cols: 3, rows: 1, gap: 960 })).toBe(ss);
  });
});

describe('lineGrid', () => {
  it('lays a row out as one column per item and a column as one row per item', () => {
    expect(lineGrid(3, { direction: 'row', gap: 10 })).toEqual({ cols: 3, rows: 1, gap: 10 });
    expect(lineGrid(3, { direction: 'column', gap: 10 })).toEqual({ cols: 1, rows: 3, gap: 10 });
  });
});
