import { flatLayers } from '../model/layers';
import type { Group, GroupNode, LayerNode, Mapping, Mask, Surface, SurfaceNode } from '../model/mapping';
import { rectCorners } from './rect';

export const surf = (id: string, x: number, y: number, w = 10, h = 10): Surface => ({
  id,
  name: id,
  type: 'quad',
  source: 'src',
  crop: { x: 0, y: 0, width: 1, height: 1 },
  corners: rectCorners({ x, y, width: w, height: h }),
  visible: true,
});

export const withMask = (s: Surface, mask: Mask): Surface => ({ ...s, mask });

export const sn = (id: string): SurfaceNode => ({ surface: id });

export const gn = (id: string, ...children: LayerNode[]): GroupNode => ({ group: id, children });

export const groupOf = (id: string, patch: Partial<Group> = {}): Group => ({
  id,
  name: id,
  visible: true,
  origin: [0, 0],
  layout: { direction: 'row', gap: 0, align: 'start', padding: 0 },
  ...patch,
});

/** A v2 mapping whose surfaces all sit at the top level. */
export const mapOf = (...surfaces: Surface[]): Mapping => ({
  version: 2,
  canvas: { width: 1920, height: 1080 },
  grid: { size: 10 },
  surfaces,
  groups: [],
  layers: flatLayers(surfaces),
});
