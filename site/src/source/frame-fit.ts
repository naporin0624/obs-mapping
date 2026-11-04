import { SOURCE_HEIGHT, SOURCE_WIDTH } from './video-source';

export type NormalizedRect = { x: number; y: number; width: number; height: number };

const WHOLE: NormalizedRect = { x: 0, y: 0, width: 1, height: 1 };
const FRAME_ASPECT = SOURCE_WIDTH / SOURCE_HEIGHT;
const ASPECT_TOLERANCE = 0.01;

/** The centred region of `targetAspect` inside a source of `sourceAspect`, as fractions of the source. */
export const centeredRegion = (sourceAspect: number, targetAspect: number): NormalizedRect => {
  if (sourceAspect > targetAspect) {
    const width = targetAspect / sourceAspect;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = sourceAspect / targetAspect;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
};

const hasSize = (width: number, height: number): boolean => width > 0 && height > 0;

/** Where a video sits inside the 16:9 frame without stretching, as fractions of the frame. */
export const letterbox = (videoWidth: number, videoHeight: number): NormalizedRect => (hasSize(videoWidth, videoHeight) ? centeredRegion(FRAME_ASPECT, videoWidth / videoHeight) : WHOLE);

export const isLetterboxed = (videoWidth: number, videoHeight: number): boolean => hasSize(videoWidth, videoHeight) && Math.abs(videoWidth / videoHeight - FRAME_ASPECT) > ASPECT_TOLERANCE;
