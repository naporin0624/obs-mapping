// Same shape as the plugin's JSON v2 (see plan-globals).
export type Point = readonly [number, number];

export type Surface = {
  id: string;
  name: string;
  type: 'quad';
  source: string;
  crop: { x: number; y: number; width: number; height: number };
  corners: readonly [Point, Point, Point, Point];
  visible: boolean;
};

export type Direction = 'row' | 'column';
export type LayoutAlign = 'start' | 'center' | 'end';
export type GroupLayout = { direction: Direction; gap: number; align: LayoutAlign; padding: number };
export type Group = { id: string; name: string; visible: boolean; origin: Point; layout: GroupLayout };

export type SurfaceNode = { surface: string };
export type GroupNode = { group: string; children: readonly LayerNode[] };
export type LayerNode = SurfaceNode | GroupNode;

type Base = { canvas: { width: number; height: number }; grid: { size: number }; surfaces: readonly Surface[] };

export type Mapping = Base & { version: 2; groups: readonly Group[]; layers: readonly LayerNode[] };

export type MappingV1 = Base & { version: 1 };
