import type * as THREE from 'three';

export type VideoSource = {
  texture: THREE.Texture;
  ready(): boolean;
  update(timeMs: number): void;
  stop(): void;
};

export const SOURCE_WIDTH = 1920;
export const SOURCE_HEIGHT = 1080;
