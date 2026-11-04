export const HEX_VIEWBOX = { width: 160, height: 100 } as const;
export const HEX_STROKE = 2;

const PITCH_RADIUS = 18 * 1.08;
// Drawn smaller than the pitch so a stroke-wide gap stays between neighbours.
const DRAW_RADIUS = 16.5;
const ROW_PITCH = Math.sqrt(3) * PITCH_RADIUS;

export type HexCenter = { cx: number; cy: number };

/** Flat-top honeycomb: columns 1.5 pitch radii apart, odd columns shifted down by half a row. */
export const hexCenters = (): HexCenter[] => [0, 1, 2].flatMap((col) => [0, 1].map((row) => ({ cx: 51 + col * 1.5 * PITCH_RADIUS, cy: 25 + row * ROW_PITCH + (col % 2) * (ROW_PITCH / 2) })));

export const hexOutline = ({ cx, cy }: HexCenter): [number, number][] =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return [cx + DRAW_RADIUS * Math.cos(a), cy + DRAW_RADIUS * Math.sin(a)];
  });
