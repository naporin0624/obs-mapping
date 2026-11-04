import { SOURCE_HEIGHT, SOURCE_WIDTH } from '../source/video-source';
import type { CropRect, Face, Vec3 } from './spec';

const distance = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Width over height of a face in the world, from its TL, TR and BL corners. */
export const faceAspect = ({ corners: [tl, tr, , bl] }: Pick<Face, 'corners'>): number => distance(tl, tr) / distance(tl, bl);

/** Width over height of a crop in source pixels. */
export const cropAspect = ({ width, height }: CropRect): number => (width * SOURCE_WIDTH) / (height * SOURCE_HEIGHT);
