import { centeredRegion } from '../source/frame-fit';
import { SOURCE_HEIGHT, SOURCE_WIDTH } from '../source/video-source';
import type { CropRect } from './spec';

/** The centred part of the 16:9 source whose pixels have the given aspect, so nothing is stretched. */
export const sourceRegion = (aspect: number): CropRect => centeredRegion(SOURCE_WIDTH / SOURCE_HEIGHT, aspect);

/** Places `rect`, given as fractions of `region`, into source fractions. */
export const insideRegion = (region: CropRect, rect: CropRect): CropRect => ({
  x: region.x + rect.x * region.width,
  y: region.y + rect.y * region.height,
  width: rect.width * region.width,
  height: rect.height * region.height,
});
