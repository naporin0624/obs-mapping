import type { Surface } from '../model/mapping';
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
