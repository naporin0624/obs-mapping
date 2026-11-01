import type { Surface } from '../model/mapping';

export type CropKey = keyof Surface['crop'];

const MIN_SIZE = 0.001;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Sets one crop field, keeping the rectangle inside the unit square (0..1) with a positive size. */
export const withCrop = (crop: Surface['crop'], key: CropKey, value: number): Surface['crop'] => {
  if (!Number.isFinite(value)) return crop;
  switch (key) {
    case 'x': {
      const x = clamp(value, 0, 1 - MIN_SIZE);
      return { ...crop, x, width: Math.min(crop.width, 1 - x) };
    }
    case 'y': {
      const y = clamp(value, 0, 1 - MIN_SIZE);
      return { ...crop, y, height: Math.min(crop.height, 1 - y) };
    }
    case 'width':
      return { ...crop, width: clamp(value, MIN_SIZE, 1 - crop.x) };
    case 'height':
      return { ...crop, height: clamp(value, MIN_SIZE, 1 - crop.y) };
  }
};
