import { isGroupNode, sortSurfacesByLayers } from '../model/layers';
import type { Direction, GroupNode, LayerNode, LayoutAlign, Mapping, Point, Surface } from '../model/mapping';
import { boundsOf } from '../geometry/rect';
import { crossOf, findGroup, findSurface, mainOf, nodeSize, type Size } from './frame';

const NO_MOVE_EPS = 1e-9;

type Patch = { surfaces: readonly Surface[]; origins: readonly (readonly [string, Point])[] };

const emptyPatch: Patch = { surfaces: [], origins: [] };

const mergePatch = (a: Patch, b: Patch): Patch => ({ surfaces: [...a.surfaces, ...b.surfaces], origins: [...a.origins, ...b.origins] });

const pointAt = (main: number, cross: number, dir: Direction): Point => (dir === 'row' ? [main, cross] : [cross, main]);

const alignOffset = (align: LayoutAlign, free: number): number => (align === 'center' ? free / 2 : align === 'end' ? free : 0);

const shiftAxis = (value: number, min: number, target: number): number => (Math.abs(min - target) < NO_MOVE_EPS ? value : value - min + target);

const translateTo = (s: Surface, target: Point): Surface => {
  const b = boundsOf(s);
  const [c0, c1, c2, c3] = s.corners.map((p): Point => [shiftAxis(p[0], b.x, target[0]), shiftAxis(p[1], b.y, target[1])]);
  return { ...s, corners: [c0!, c1!, c2!, c3!] };
};

type Placed = { child: LayerNode; size: Size };

const placeNode = (m: Mapping, child: LayerNode, target: Point, isNested: boolean): Patch => {
  if (!isGroupNode(child)) {
    const s = findSurface(m, child.surface);
    return s ? { surfaces: [translateTo(s, target)], origins: [] } : emptyPatch;
  }
  return placeGroup(m, child, target, isNested);
};

const movedBeyondEps = (a: Point, b: Point): boolean => Math.abs(a[0] - b[0]) >= NO_MOVE_EPS || Math.abs(a[1] - b[1]) >= NO_MOVE_EPS;

const placeGroup = (m: Mapping, node: GroupNode, at: Point, overwrite: boolean): Patch => {
  const group = findGroup(m, node.group);
  if (!group) return emptyPatch;
  const { direction, gap, align, padding } = group.layout;
  const placed = node.children.flatMap((child): Placed[] => {
    const size = nodeSize(m, child);
    return size ? [{ child, size }] : [];
  });
  const maxCross = Math.max(0, ...placed.map((p) => crossOf(p.size, direction)));
  const mainStart = (direction === 'row' ? at[0] : at[1]) + padding;
  const crossStart = (direction === 'row' ? at[1] : at[0]) + padding;
  const own: Patch = overwrite && movedBeyondEps(group.origin, at) ? { surfaces: [], origins: [[group.id, at]] } : emptyPatch;
  const { patch } = placed.reduce(
    (acc, { child, size }) => {
      const offset = alignOffset(align, maxCross - crossOf(size, direction));
      const target = pointAt(acc.cursor, crossStart + offset, direction);
      return { cursor: acc.cursor + mainOf(size, direction) + gap, patch: mergePatch(acc.patch, placeNode(m, child, target, true)) };
    },
    { cursor: mainStart, patch: own },
  );
  return patch;
};

const placeTopLevel = (m: Mapping, node: LayerNode): Patch => {
  if (!isGroupNode(node)) return emptyPatch;
  const group = findGroup(m, node.group);
  return group?.visible === true ? placeGroup(m, node, group.origin, false) : emptyPatch;
};

export const layoutTree = (m: Mapping): Mapping => {
  const patch = m.layers.map((n) => placeTopLevel(m, n)).reduce(mergePatch, emptyPatch);
  const moved = new Map(patch.surfaces.map((s) => [s.id, s]));
  const origins = new Map(patch.origins);
  const next: Mapping = {
    ...m,
    surfaces: m.surfaces.map((s) => moved.get(s.id) ?? s),
    groups: m.groups.map((g) => (origins.has(g.id) ? { ...g, origin: origins.get(g.id)! } : g)),
  };
  return sortSurfacesByLayers(next);
};
