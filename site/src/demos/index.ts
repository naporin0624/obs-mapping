import type { Mapping } from '../../../ui/src/model/mapping';
import { readMapping } from '../../../ui/src/model/read';
import type { DemoSlug, SceneSpec } from '../scene/spec';
import cubesJson from './cubes/mapping.json';
import { cubesScene } from './cubes/scene';
import drumsJson from './drums/mapping.json';
import { drumsScene } from './drums/scene';
import hexagonJson from './hexagon/mapping.json';
import { hexagonScene } from './hexagon/scene';
import stairsJson from './stairs/mapping.json';
import { stairsScene } from './stairs/scene';

export const DEMO_SLUGS: readonly DemoSlug[] = ['stairs', 'hexagon', 'drums', 'cubes'];

export const scenes: Record<DemoSlug, SceneSpec> = { stairs: stairsScene, hexagon: hexagonScene, drums: drumsScene, cubes: cubesScene };

// The committed JSON is the single source for both the 3D view and the download.
const committed = (slug: DemoSlug, json: unknown): Mapping => {
  const read = readMapping(json);
  if (read.kind === 'error') throw new Error(`${slug}/mapping.json: ${read.message}`);
  return read.mapping;
};

export const mappings: Record<DemoSlug, Mapping> = {
  stairs: committed('stairs', stairsJson),
  hexagon: committed('hexagon', hexagonJson),
  drums: committed('drums', drumsJson),
  cubes: committed('cubes', cubesJson),
};

export const isDemoSlug = (value: string | undefined): value is DemoSlug => DEMO_SLUGS.some((slug) => slug === value);
