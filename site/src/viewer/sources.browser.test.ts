import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CameraSource } from '../source/webcam-source';
import { createSources } from './sources';

type FakeCamera = CameraSource & { resize(width: number, height: number): void; draw(): void };

const fakeCamera = (width: number, height: number): FakeCamera => {
  let size = { width, height };
  let drawn = false;
  return {
    texture: new THREE.Texture(),
    ready: () => drawn,
    update: () => undefined,
    stop: () => undefined,
    size: () => size,
    deviceId: () => 'cam',
    resize: (w, h) => void (size = { width: w, height: h }),
    draw: () => void (drawn = true),
  };
};

const root = document.createElement('div');
let stop = (): void => undefined;
afterEach(() => stop());

describe('createSources camera size', () => {
  it('reports the frame size on the first projected frame and again whenever it changes', () => {
    const sources = createSources(root);
    stop = sources.stop;
    const camera = fakeCamera(640, 480);
    const onSize = vi.fn();
    sources.useCamera(camera, onSize);
    sources.current(0);
    expect(onSize).not.toHaveBeenCalled();

    camera.draw();
    sources.current(16);
    sources.current(32);
    expect(onSize).toHaveBeenCalledTimes(1);
    expect(onSize).toHaveBeenLastCalledWith({ width: 640, height: 480 });

    camera.resize(1920, 1080);
    sources.current(48);
    expect(onSize).toHaveBeenCalledTimes(2);
    expect(onSize).toHaveBeenLastCalledWith({ width: 1920, height: 1080 });
  });
});
