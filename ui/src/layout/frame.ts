import { boundsOf, type Bounds } from '../geometry/rect';
import { isGroupNode } from '../model/layers';
import type { Direction, Group, LayerNode, Mapping, Surface } from '../model/mapping';

export type Size = { width: number; height: number };

export const mainOf = (size: Size, dir: Direction): number => (dir === 'row' ? size.width : size.height);

export const crossOf = (size: Size, dir: Direction): number => (dir === 'row' ? size.height : size.width);

export const sizeFrom = (main: number, cross: number, dir: Direction): Size => (dir === 'row' ? { width: main, height: cross } : { width: cross, height: main });

export const findSurface = (m: Mapping, id: string): Surface | undefined => m.surfaces.find((s) => s.id === id);

export const findGroup = (m: Mapping, id: string): Group | undefined => m.groups.find((g) => g.id === id);

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

const contentSize = (m: Mapping, group: Group, children: readonly LayerNode[]): Size => {
  const { direction, gap, padding } = group.layout;
  const sizes = children.flatMap((c) => nodeSize(m, c) ?? []);
  const gaps = Math.max(0, sizes.length - 1) * gap;
  const main = sum(sizes.map((s) => mainOf(s, direction))) + gaps;
  const cross = Math.max(0, ...sizes.map((s) => crossOf(s, direction)));
  const inner = sizeFrom(main, cross, direction);
  return { width: inner.width + padding * 2, height: inner.height + padding * 2 };
};

export const nodeSize = (m: Mapping, node: LayerNode): Size | null => {
  if (!isGroupNode(node)) {
    const s = findSurface(m, node.surface);
    if (!s || !s.visible) return null;
    const { width, height } = boundsOf(s);
    return { width, height };
  }
  const g = findGroup(m, node.group);
  return g?.visible === true ? contentSize(m, g, node.children) : null;
};

const findNode = (layers: readonly LayerNode[], id: string): LayerNode | undefined => {
  for (const n of layers) {
    if (isGroupNode(n)) {
      if (n.group === id) return n;
      const inner = findNode(n.children, id);
      if (inner) return inner;
    }
  }
  return undefined;
};

export const groupFrame = (m: Mapping, groupId: string): Bounds => {
  const g = findGroup(m, groupId);
  const node = findNode(m.layers, groupId);
  if (!g || !node) throw new Error(`unknown group: ${groupId}`);
  const size = contentSize(m, g, isGroupNode(node) ? node.children : []);
  return { x: g.origin[0], y: g.origin[1], ...size };
};
