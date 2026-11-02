import type { Mapping } from '../model/mapping';
import type { Bounds } from './rect';

type Canvas = Mapping['canvas'];

const MARGIN_RATIO = 0.125;

/** Canvas px of editable margin around the canvas, so corners at or past its edge stay grabbable. */
export const pasteboardMargin = (canvas: Canvas): number => Math.round(Math.max(canvas.width, canvas.height) * MARGIN_RATIO);

export const pasteboardBounds = (canvas: Canvas): Bounds => {
  const m = pasteboardMargin(canvas);
  return { x: -m, y: -m, width: canvas.width + 2 * m, height: canvas.height + 2 * m };
};
