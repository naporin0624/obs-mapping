import { hexPanelFace, type HexPanel } from '../../scene/hex-panel-face';
import { insideRegion, sourceRegion } from '../../scene/source-region';
import type { Face, SceneSpec, Vec3 } from '../../scene/spec';

const RADIUS = 0.5;
const SPACING = 1.06;
const WALL_Y = 1.4;
const SQRT3 = Math.sqrt(3);
const COLUMN_ROWS = [3, 2, 3, 2, 3] as const;
const LAYOUT_WIDTH = 1.5 * (COLUMN_ROWS.length - 1) + 2;
const LAYOUT_HEIGHT = 3 * SQRT3;
const REGION = sourceRegion(LAYOUT_WIDTH / LAYOUT_HEIGHT);

type Mount = readonly [yaw: number, pitch: number, depth: number];

/** Fixed mounting table, column by column: yaw and pitch from the wall (deg), slab depth (m). */
const MOUNTS: readonly Mount[] = [
  [0, 0, 0.06],
  [10, -4, 0.12],
  [-6, 8, 0.2],
  [-12, 0, 0.1],
  [9, 5, 0.16],
  [5, -9, 0.22],
  [0, 0, 0.08],
  [-9, 6, 0.14],
  [13, 3, 0.18],
  [-4, -10, 0.1],
  [8, 9, 0.2],
  [-11, -5, 0.12],
  [3, 0, 0.06],
];

type Cell = { u: number; v: number };

/** Hex centers in units of the circumradius, origin at the top-left of the layout. */
const cells: readonly Cell[] = COLUMN_ROWS.flatMap((rows, col) => Array.from({ length: rows }, (_, row) => ({ u: 1 + 1.5 * col, v: (SQRT3 / 2) * (1 + (col % 2 === 0 ? 2 * row : 2 * row + 1)) })));

const radians = (deg: number): number => (deg * Math.PI) / 180;

const normalOf = (yaw: number, pitch: number): Vec3 => [Math.sin(radians(yaw)) * Math.cos(radians(pitch)), Math.sin(radians(pitch)), Math.cos(radians(yaw)) * Math.cos(radians(pitch))];

const panelAt = ({ u, v }: Cell, [yaw, pitch, depth]: Mount): HexPanel => ({
  kind: 'hexPanel',
  center: [(u - LAYOUT_WIDTH / 2) * RADIUS * SPACING, WALL_Y + (LAYOUT_HEIGHT / 2 - v) * RADIUS * SPACING, depth / 2],
  radius: RADIUS,
  depth,
  normal: normalOf(yaw, pitch),
});

const tileFace = ({ u, v }: Cell, panel: HexPanel, index: number): Face => ({
  id: `tile-${String(index + 1)}`,
  name: `Tile ${String(index + 1)}`,
  corners: hexPanelFace(panel),
  crop: insideRegion(REGION, { x: (u - 1) / LAYOUT_WIDTH, y: (v - SQRT3 / 2) / LAYOUT_HEIGHT, width: 2 / LAYOUT_WIDTH, height: SQRT3 / LAYOUT_HEIGHT }),
  mask: {
    type: 'polygon',
    points: [
      [0, 0.5],
      [0.25, 0],
      [0.75, 0],
      [1, 0.5],
      [0.75, 1],
      [0.25, 1],
    ],
  },
});

type Tile = { panel: HexPanel; face: Face };

const tileAt = (cell: Cell, index: number): Tile => {
  const mount = MOUNTS[index];
  if (mount === undefined) throw new Error(`hexagon: no mount for cell ${String(index)}`);
  const panel = panelAt(cell, mount);
  return { panel, face: tileFace(cell, panel, index) };
};

const tiles = cells.map(tileAt);

export const hexagonScene: SceneSpec = {
  slug: 'hexagon',
  projector: { position: [0, WALL_Y, 4.3], target: [0, WALL_Y, 0], up: [0, 1, 0], fovY: 40 },
  props: tiles.map((t) => t.panel),
  faces: tiles.map((t) => t.face),
  steps: ['place', 'fit', 'shape', 'done'],
};
