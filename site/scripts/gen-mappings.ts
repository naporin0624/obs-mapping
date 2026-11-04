import { writeFileSync } from 'node:fs';
import { cubesScene } from '../src/demos/cubes/scene';
import { drumsScene } from '../src/demos/drums/scene';
import { hexagonScene } from '../src/demos/hexagon/scene';
import { stairsScene } from '../src/demos/stairs/scene';
import { buildMapping } from '../src/scene/build-mapping';
import { serializeMapping } from '../src/scene/serialize';
import type { SceneSpec } from '../src/scene/spec';

const scenes: readonly SceneSpec[] = [stairsScene, hexagonScene, drumsScene, cubesScene];

const mappingPath = (scene: SceneSpec): URL => new URL(`../src/demos/${scene.slug}/mapping.json`, import.meta.url);

for (const scene of scenes) {
  writeFileSync(mappingPath(scene), serializeMapping(buildMapping(scene)));
}
