// Same shape as the plugin's JSON v1 (see plan-globals).
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

export type Mapping = {
  version: 1;
  canvas: { width: number; height: number };
  grid: { size: number };
  surfaces: readonly Surface[];
};
