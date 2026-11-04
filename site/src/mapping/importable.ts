import { readMapping } from '../../../ui/src/model/read';
import type { Mapping, Surface } from '../../../ui/src/model/mapping';

const MAX_CANVAS = 16384;
const MAX_GRID = 1024;
const CORNER_COUNT = 4;

const checkDimension = (path: string, value: number): string | null => {
  if (!Number.isInteger(value)) return `${path}: expected integer`;
  return value >= 1 && value <= MAX_CANVAS ? null : `${path}: must be between 1 and ${String(MAX_CANVAS)}`;
};

const checkCanvas = (canvas: Mapping['canvas']): string | null => checkDimension('canvas.width', canvas.width) ?? checkDimension('canvas.height', canvas.height);

const checkGrid = (grid: Mapping['grid']): string | null => (grid.size > 0 && grid.size <= MAX_GRID ? null : `grid.size: must be greater than 0 and at most ${String(MAX_GRID)}`);

const checkCrop = (path: string, crop: Surface['crop']): string | null => {
  const { x, y, width, height } = crop;
  if (x < 0 || y < 0) return `${path}.crop: x,y must be >= 0`;
  if (!(width > 0) || !(height > 0)) return `${path}.crop: width,height must be > 0`;
  if (x + width > 1) return `${path}.crop: x+width must be <= 1`;
  return y + height > 1 ? `${path}.crop: y+height must be <= 1` : null;
};

const checkCorners = (path: string, corners: Surface['corners']): string | null => (corners.length === CORNER_COUNT ? null : `${path}.corners: expected ${String(CORNER_COUNT)} points`);

const checkSurface = (surface: Surface, index: number): string | null => {
  const path = `surfaces[${String(index)}]`;
  return checkCrop(path, surface.crop) ?? checkCorners(path, surface.corners);
};

const firstProblem = (surfaces: readonly Surface[]): string | null => surfaces.reduce<string | null>((found, surface, i) => found ?? checkSurface(surface, i), null);

/** The plugin's import rules (core/src/mapping_json.cpp) on top of readMapping. */
export const checkImportable = (json: unknown): string | null => {
  const read = readMapping(json);
  if (read.kind === 'error') return read.message;
  const { canvas, grid, surfaces } = read.mapping;
  return checkCanvas(canvas) ?? checkGrid(grid) ?? firstProblem(surfaces);
};
