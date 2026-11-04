import type * as THREE from 'three';

import { createSampleSource } from '../source/sample-source';
import type { CameraSource } from '../source/webcam-source';

export type Projected = { kind: 'sample' | 'camera'; texture: THREE.Texture };
export type FrameSize = { width: number; height: number };

export type Sources = {
  current: (timeMs: number) => Projected;
  setPlaying: (playing: boolean) => void;
  /** `onSize` runs on the first frame the camera actually projects, then whenever its frame size changes. */
  useCamera: (source: CameraSource, onSize: (size: FrameSize) => void) => void;
  dropCamera: () => void;
  /** True while something on screen changes by itself: a playing sample or a camera. */
  live: () => boolean;
  stop: () => void;
};

type Playback = { setPlaying: (playing: boolean) => void; playing: () => boolean; sampleTime: (timeMs: number) => number | null };

// Sample time only advances while playing; null means the frame already drawn stays.
const createPlayback = (): Playback => {
  let playing = false;
  let drawn = false;
  let clock = 0;
  let previous: number | null = null;
  return {
    setPlaying: (next) => void (playing = next),
    playing: () => playing,
    sampleTime(timeMs) {
      const delta = previous === null ? 0 : timeMs - previous;
      previous = timeMs;
      if (drawn && !playing) return null;
      if (playing) clock = clock + delta;
      drawn = true;
      return clock;
    },
  };
};

type Attached = { source: CameraSource; onSize: (size: FrameSize) => void; reported: FrameSize | null };

const sameSize = (a: FrameSize | null, b: FrameSize): boolean => a !== null && a.width === b.width && a.height === b.height;

// The sample stays on screen until the camera has drawn its first frame.
export const createSources = (root: HTMLElement): Sources => {
  const sample = createSampleSource();
  const playback = createPlayback();
  let camera: Attached | null = null;
  const show = (kind: Projected['kind']): void => root.setAttribute('data-source', kind);
  const cameraFrame = (timeMs: number): Projected | null => {
    if (camera === null) return null;
    camera.source.update(timeMs);
    if (!camera.source.ready()) return null;
    const size = camera.source.size();
    if (camera.reported === null) show('camera');
    if (!sameSize(camera.reported, size)) {
      camera.reported = size;
      camera.onSize(size);
    }
    return { kind: 'camera', texture: camera.source.texture };
  };
  const dropCamera = (): void => {
    camera?.source.stop();
    camera = null;
    show('sample');
  };
  show('sample');
  return {
    current(timeMs) {
      const live = cameraFrame(timeMs);
      if (live !== null) return live;
      const at = playback.sampleTime(timeMs);
      if (at !== null) sample.update(at);
      return { kind: 'sample', texture: sample.texture };
    },
    setPlaying: playback.setPlaying,
    useCamera(source, onSize) {
      dropCamera();
      camera = { source, onSize, reported: null };
    },
    dropCamera,
    live: () => playback.playing() || camera !== null,
    stop() {
      dropCamera();
      sample.stop();
    },
  };
};
