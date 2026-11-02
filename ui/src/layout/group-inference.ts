import { boundsOf, type Bounds } from '../geometry/rect';
import { findNode, findParent } from '../model/layers';
import type { Direction, GroupLayout, Mapping, Point } from '../model/mapping';
import { MAX_SPACING } from '../model/validate-tree';
import { groupFrame, nodeSize } from './frame';

export type InferredGroup = { layout: GroupLayout; origin: Point; order: string[] };

type Item = { id: string; rect: Bounds; index: number };

const rectOf = (m: Mapping, id: string): Bounds => {
  if (m.groups.some((g) => g.id === id)) return groupFrame(m, id);
  const surface = m.surfaces.find((s) => s.id === id);
  if (!surface) throw new Error(`unknown item: ${id}`);
  return boundsOf(surface);
};

const toItem = (m: Mapping, id: string): Item => ({ id, rect: rectOf(m, id), index: findParent(m.layers, id)?.index ?? 0 });

const isShown = (m: Mapping, id: string): boolean => {
  const node = findNode(m.layers, id);
  return node !== null && nodeSize(m, node) !== null;
};

/** Hidden items take no part in the flow, so they must not shape it. */
const measuredItems = (m: Mapping, items: readonly Item[]): Item[] => {
  const shown = items.filter((i) => isShown(m, i.id));
  return shown.length > 0 ? shown : [...items];
};

const minOf = (r: Bounds, dir: Direction): number => (dir === 'row' ? r.x : r.y);

const sizeOf = (r: Bounds, dir: Direction): number => (dir === 'row' ? r.width : r.height);

const totalBounds = (rects: readonly Bounds[]): Bounds => {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, width: Math.max(...rects.map((r) => r.x + r.width)) - x, height: Math.max(...rects.map((r) => r.y + r.height)) - y };
};

const averageGap = (items: readonly Item[], dir: Direction): number => {
  const gaps = items.slice(1).map((next, i) => {
    const prev = items[i]!.rect;
    return minOf(next.rect, dir) - (minOf(prev, dir) + sizeOf(prev, dir));
  });
  if (gaps.length === 0) return 0;
  return Math.min(MAX_SPACING, Math.max(0, Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)));
};

const byPosition = (items: readonly Item[], dir: Direction): Item[] => items.toSorted((a, b) => a.index - b.index).toSorted((a, b) => minOf(a.rect, dir) - minOf(b.rect, dir));

/** Reads the current arrangement of the items as the group layout that reproduces it. */
export const inferGroup = (m: Mapping, itemIds: readonly string[]): InferredGroup => {
  const items = itemIds.map((id) => toItem(m, id));
  const measured = measuredItems(m, items);
  const box = totalBounds(measured.map((i) => i.rect));
  const direction: Direction = box.width >= box.height ? 'row' : 'column';
  return {
    layout: { direction, gap: averageGap(byPosition(measured, direction), direction), align: 'start', padding: 0 },
    origin: [box.x, box.y],
    order: byPosition(items, direction).map((i) => i.id),
  };
};
