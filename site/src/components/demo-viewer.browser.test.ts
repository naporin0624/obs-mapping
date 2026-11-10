import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mappings, scenes } from '../demos';
import { sceneBounds, startPose } from '../render/orbit-limits';
import { STEP_DURATION_MS } from '../story/step-timeline';
import type { CameraMedia } from '../source/obs-camera';
import { startDemoViewer, type ViewerDeps } from './demo-viewer.client';

type FrameQueue = { deps: Pick<ViewerDeps, 'requestFrame' | 'cancelFrame'>; pending(): number; flush(timeMs?: number): void; requested(): number };

// Frames run only when the test flushes them, so "is the next frame booked?" is observable.
const frameQueue = (): FrameQueue => {
  let queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  let requested = 0;
  return {
    deps: {
      requestFrame: (cb) => {
        const id = nextId++;
        requested++;
        queue.set(id, cb);
        return id;
      },
      cancelFrame: (id) => void queue.delete(id),
    },
    pending: () => queue.size,
    requested: () => requested,
    flush: (timeMs = performance.now()) => {
      const current = queue;
      queue = new Map();
      for (const cb of current.values()) cb(timeMs);
    },
  };
};

// captureStream only emits when the canvas changes, so the canvas is repainted to keep frames coming.
const repaintingStream = (): MediaStream => {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  let tick = 0;
  const timer = setInterval(() => {
    tick++;
    if (ctx !== null) ctx.fillStyle = tick % 2 === 0 ? '#fff' : '#eee';
    ctx?.fillRect(0, 0, 640, 480);
  }, 16);
  const stream = canvas.captureStream(30);
  for (const track of stream.getTracks()) track.addEventListener('ended', () => clearInterval(timer));
  timers = [...timers, timer];
  return stream;
};

const device = (deviceId: string, label: string): MediaDeviceInfo => ({ deviceId, label, kind: 'videoinput', groupId: '', toJSON: () => ({}) });

const media = (getUserMedia: CameraMedia['getUserMedia'], devices: readonly MediaDeviceInfo[] = []): CameraMedia => ({
  getUserMedia,
  enumerateDevices: () => Promise.resolve([...devices]),
});

const STEP_IDS = scenes.stairs.steps;

// Mirrors the markup of demo-viewer.astro.
const buildDom = (): HTMLElement => {
  const root = document.createElement('div');
  root.dataset['demoViewer'] = 'stairs';
  root.innerHTML = `
    <div data-stage tabindex="0" style="width: 320px; height: 180px">
      <canvas data-stage-canvas aria-label="scene" style="width: 320px; height: 180px"></canvas>
      <p data-webgl-fallback hidden>no 3d</p>
      <p data-hint>hint</p>
    </div>
    <fieldset data-input>
      <input type="radio" name="source" value="sample" checked data-source-radio>
      <input type="radio" name="source" value="obs" data-source-radio>
      <label data-device-field hidden>camera <select data-device></select></label>
      <p role="status" data-camera-status data-join=" " data-switch-failed="switch failed" data-unnamed="Camera" data-sample="sample" data-requesting="requesting" data-waiting="waiting" data-obs="obs" data-other="other {label}" data-letterbox="letterbox" data-denied="denied" data-unavailable="unavailable" data-busy="busy" data-disconnected="disconnected">sample</p>
      <button type="button" data-sample-toggle data-pause="pause" data-play="play">pause</button>
    </fieldset>
    <fieldset data-steps>
      <p data-steps-locked hidden>locked</p>
      ${STEP_IDS.map((id) => `<label><input type="radio" name="step" value="${id}" data-step-radio ${id === 'done' ? 'checked' : ''}>${id}</label>`).join('')}
    </fieldset>
    <input type="checkbox" checked data-beam>
    <button type="button" data-reset-view>reset</button>
    <a data-download href="/demo/stairs.mapping.json" download="surface-mapper-demo-stairs.json">download</a>
  `;
  document.body.append(root);
  return root;
};

const el = <T extends Element>(selector: string, type: new () => T): T => {
  const found = root.querySelector(selector);
  if (!(found instanceof type)) throw new Error(`no ${selector}`);
  return found;
};
const sampleToggle = (): HTMLButtonElement => el('[data-sample-toggle]', HTMLButtonElement);
const radio = (selector: string): HTMLInputElement => el(selector, HTMLInputElement);
const obsRadio = (): HTMLInputElement => radio('[data-source-radio][value="obs"]');
const sampleRadio = (): HTMLInputElement => radio('[data-source-radio][value="sample"]');
const stepRadio = (id: string): HTMLInputElement => radio(`[data-step-radio][value="${id}"]`);
const steps = (): HTMLFieldSetElement => el('[data-steps]', HTMLFieldSetElement);

type Motion = ViewerDeps['motion'];
const motionQuery = (matches: boolean): Motion => Object.assign(new EventTarget(), { matches });
const status = (): string => root.querySelector('[data-camera-status]')?.textContent ?? '';

const setVisibility = (state: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
};

let root: HTMLElement;
let frames: FrameQueue;
let cleanups: (() => void)[] = [];
let timers: ReturnType<typeof setInterval>[] = [];

const start = (deps: Partial<ViewerDeps> = {}): (() => void) => {
  const stop = startDemoViewer(root, scenes.stairs, mappings.stairs, { ...frames.deps, ...deps });
  cleanups = [...cleanups, stop];
  return stop;
};

// Keeps flushing frames so the camera source gets polled until it has drawn.
const flushUntil = async (check: () => void): Promise<void> =>
  vi.waitFor(
    () => {
      frames.flush();
      check();
    },
    { timeout: 10_000, interval: 20 },
  );

// Dozens of real draws on software GL queue seconds of GPU work that the next test's getContext waits for.
// The tests that run many frames only check the loop, the camera or the status, so they skip drawing.
const skipDraws: Pick<ViewerDeps, 'createRenderer'> = {
  createRenderer: (canvas) => Object.assign(new THREE.WebGLRenderer({ canvas }), { render: () => undefined }),
};

type Spied = { deps: Partial<ViewerDeps>; stage: () => THREE.Scene; renderer: () => THREE.WebGLRenderer };

// Records the scene drawn to the screen (not a render target), which holds the projector body.
const spyStage = ({ draw = true, ...options }: THREE.WebGLRendererParameters & { draw?: boolean } = {}): Spied => {
  let stage: THREE.Scene | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  return {
    deps: {
      createRenderer: (canvas) => {
        const created = new THREE.WebGLRenderer({ canvas, ...options });
        const original = created.render.bind(created);
        created.render = (scene, camera) => {
          if (scene instanceof THREE.Scene && scene.getObjectByName('projector-body') !== undefined) stage = scene;
          if (draw) original(scene, camera);
        };
        renderer = created;
        return created;
      },
    },
    stage: () => {
      if (stage === null) throw new Error('stage not drawn yet');
      return stage;
    },
    renderer: () => {
      if (renderer === null) throw new Error('no renderer');
      return renderer;
    },
  };
};

const projectedMap = (scene: THREE.Scene): unknown => {
  const mesh = scene.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.material instanceof THREE.ShaderMaterial);
  const material = mesh?.material;
  return material instanceof THREE.ShaderMaterial ? material.uniforms['map']?.value : undefined;
};

beforeEach(() => {
  root = buildDom();
  frames = frameQueue();
});

afterEach(() => {
  cleanups.forEach((stop) => stop());
  cleanups = [];
  timers.forEach((t) => clearInterval(t));
  timers = [];
  root.remove();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('startDemoViewer', () => {
  it('does not ask for the camera on start', () => {
    const getUserMedia = vi.fn(() => Promise.resolve(repaintingStream()));
    start({ media: media(getUserMedia) });
    frames.flush();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('shows the fallback in place of the 3D view when WebGL cannot start, keeping steps and download', () => {
    start({
      createRenderer: () => {
        throw new Error('Error creating WebGL context.');
      },
    });
    expect(root.querySelector('[data-webgl-fallback]')?.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('[data-stage-canvas]')?.hasAttribute('hidden')).toBe(true);
    expect(sampleToggle().hasAttribute('hidden')).toBe(true);
    expect(el('[data-input]', HTMLFieldSetElement).disabled).toBe(true);
    expect(steps().disabled).toBe(false);
    expect(root.querySelector('a[download]')?.getAttribute('href')).toBe('/demo/stairs.mapping.json');
    expect(frames.pending()).toBe(0);
  });

  it('stops booking frames while the tab is hidden and resumes when visible', () => {
    start({ motion: motionQuery(false) });
    frames.flush();
    expect(frames.pending()).toBe(1);

    setVisibility('hidden');
    frames.flush();
    expect(frames.pending()).toBe(0);

    setVisibility('visible');
    expect(frames.pending()).toBe(1);
  });

  it('draws the scene into the canvas', () => {
    start();
    frames.flush();
    expect(root.dataset['webgl']).toBe('ok');
  });

  it('renders on demand once nothing moves, and again when a control changes', () => {
    start({ motion: motionQuery(true) });
    frames.flush();
    frames.flush();
    expect(frames.pending()).toBe(0);
    radio('[data-beam]').click();
    expect(frames.pending()).toBe(1);
  });
});

describe('startDemoViewer OBS camera input', () => {
  it('opens the camera only when OBS is chosen, and prefers the camera named OBS', async () => {
    const getUserMedia = vi.fn(() => Promise.resolve(repaintingStream()));
    start({ media: media(getUserMedia, [device('cam-1', 'FaceTime HD Camera'), device('cam-obs', 'OBS Virtual Camera')]) });
    frames.flush();
    expect(getUserMedia).not.toHaveBeenCalled();

    obsRadio().click();
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(getUserMedia.mock.calls[1]).toMatchObject([{ video: { deviceId: { exact: 'cam-obs' } } }]);
    await vi.waitFor(() => expect(el('[data-device-field]', HTMLLabelElement).hidden).toBe(false));
    const select = el('[data-device]', HTMLSelectElement);
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['FaceTime HD Camera', 'OBS Virtual Camera']);
    expect(select.value).toBe('cam-obs');
  });

  it('projects the camera texture itself, not the in-page output, and says a 4:3 frame is letterboxed', async () => {
    const spied = spyStage({ draw: false });
    start({ ...spied.deps, media: media(() => Promise.resolve(repaintingStream()), [device('cam-obs', 'OBS Virtual Camera')]) });
    frames.flush();
    const output = projectedMap(spied.stage());
    expect(output).toHaveProperty('isRenderTargetTexture', true);

    obsRadio().click();
    await flushUntil(() => expect(root.dataset['source']).toBe('camera'));
    const map = projectedMap(spied.stage());
    expect(map).not.toBe(output);
    expect(map).toBeInstanceOf(THREE.CanvasTexture);
    expect(status()).toBe('obs letterbox');
  });

  it('names the other camera when there is no OBS camera', async () => {
    const stream = repaintingStream();
    for (const track of stream.getVideoTracks()) track.getSettings = () => ({ deviceId: 'cam-1' });
    start({ ...skipDraws, media: media(() => Promise.resolve(stream), [device('cam-1', 'FaceTime HD Camera')]) });
    obsRadio().click();
    await flushUntil(() => expect(status()).toContain('other FaceTime HD Camera'));
  });

  it('keeps the sample until the camera has drawn', async () => {
    start({ media: media(() => new Promise<MediaStream>(() => undefined)) });
    obsRadio().click();
    frames.flush();
    expect(root.dataset['source']).toBe('sample');
    expect(status()).toBe('requesting');
  });

  it('locks the steps while the OBS camera is the input and unlocks them on the way back', async () => {
    start({ media: media(() => Promise.resolve(repaintingStream())) });
    obsRadio().click();
    expect(steps().disabled).toBe(true);
    expect(root.querySelector('[data-steps-locked]')?.hasAttribute('hidden')).toBe(false);
    await vi.waitFor(() => expect(status()).not.toBe('requesting'));
    sampleRadio().click();
    expect(steps().disabled).toBe(false);
    expect(root.querySelector('[data-steps-locked]')?.hasAttribute('hidden')).toBe(true);
    expect(status()).toBe('sample');
  });

  it('goes back to the sample and says so when the camera is denied', async () => {
    start({ media: media(() => Promise.reject(new DOMException('no', 'NotAllowedError'))) });
    obsRadio().click();
    await vi.waitFor(() => expect(status()).toBe('denied'));
    expect(root.querySelector('[data-camera-status]')?.getAttribute('role')).toBe('status');
    expect(sampleRadio().checked).toBe(true);
    expect(steps().disabled).toBe(false);
    expect(root.dataset['source']).toBe('sample');
  });

  it('says the camera is in use by another app when it cannot be read', async () => {
    start({ media: media(() => Promise.reject(new DOMException('busy', 'NotReadableError'))) });
    obsRadio().click();
    await vi.waitFor(() => expect(status()).toBe('busy'));
    expect(sampleRadio().checked).toBe(true);
  });

  it('says no camera was found', async () => {
    start({ media: media(() => Promise.reject(new DOMException('none', 'NotFoundError'))) });
    obsRadio().click();
    await vi.waitFor(() => expect(status()).toBe('unavailable'));
  });

  it('goes back to the sample and says so when the camera is unplugged', async () => {
    const stream = repaintingStream();
    start({ media: media(() => Promise.resolve(stream)) });
    obsRadio().click();
    await vi.waitFor(() => expect(status()).not.toBe('requesting'));
    for (const track of stream.getTracks()) track.dispatchEvent(new Event('ended'));
    await vi.waitFor(() => expect(status()).toBe('disconnected'));
    expect(root.dataset['source']).toBe('sample');
    expect(sampleRadio().checked).toBe(true);
  });

  it('switches to the camera picked in the list', async () => {
    const getUserMedia = vi.fn(() => Promise.resolve(repaintingStream()));
    start({ media: media(getUserMedia, [device('cam-obs', 'OBS Virtual Camera'), device('cam-1', 'FaceTime HD Camera')]) });
    obsRadio().click();
    await vi.waitFor(() => expect(el('[data-device-field]', HTMLLabelElement).hidden).toBe(false));
    const select = el('[data-device]', HTMLSelectElement);
    select.value = 'cam-1';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(getUserMedia.mock.calls.at(-1)).toMatchObject([{ video: { deviceId: { exact: 'cam-1' } } }]));
  });

  it('keeps the working camera and only reports it when switching to another camera fails', async () => {
    const working = repaintingStream();
    const getUserMedia = vi.fn((constraints?: MediaStreamConstraints) => {
      const video = constraints?.video;
      const wanted = typeof video === 'object' ? video.deviceId : undefined;
      return wanted !== undefined && JSON.stringify(wanted).includes('cam-1') ? Promise.reject(new DOMException('busy', 'NotReadableError')) : Promise.resolve(working);
    });
    for (const track of working.getVideoTracks()) track.getSettings = () => ({ deviceId: 'cam-obs' });
    start({ ...skipDraws, media: media(getUserMedia, [device('cam-obs', 'OBS Virtual Camera'), device('cam-1', 'FaceTime HD Camera')]) });
    obsRadio().click();
    await flushUntil(() => expect(root.dataset['source']).toBe('camera'));
    const select = el('[data-device]', HTMLSelectElement);
    select.value = 'cam-1';
    select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(status()).toBe('switch failed'));
    expect(obsRadio().checked).toBe(true);
    expect(select.value).toBe('cam-obs');
    for (const track of working.getTracks()) expect(track.readyState).toBe('live');
    frames.flush();
    expect(root.dataset['source']).toBe('camera');
  });

  it('hides the sample pause button while OBS is the input', async () => {
    start({ media: media(() => Promise.resolve(repaintingStream())) });
    obsRadio().click();
    expect(sampleToggle().hidden).toBe(true);
    await vi.waitFor(() => expect(status()).not.toBe('requesting'));
    sampleRadio().click();
    expect(sampleToggle().hidden).toBe(false);
  });

  it('joins status sentences with the separator the page language asks for', async () => {
    root.querySelector('[data-camera-status]')?.setAttribute('data-join', '');
    start({ ...skipDraws, media: media(() => Promise.resolve(repaintingStream()), [device('cam-obs', 'OBS Virtual Camera')]) });
    obsRadio().click();
    await flushUntil(() => expect(status()).toBe('obsletterbox'));
  });

  it('stops the camera tracks on pagehide', async () => {
    const stream = repaintingStream();
    const stops = stream.getTracks().map((t) => vi.spyOn(t, 'stop'));
    start({ media: media(() => Promise.resolve(stream)) });
    obsRadio().click();
    await vi.waitFor(() => expect(status()).not.toBe('requesting'));

    window.dispatchEvent(new PageTransitionEvent('pagehide'));

    for (const stop of stops) expect(stop).toHaveBeenCalled();
    expect(root.dataset['source']).toBe('sample');
    expect(sampleRadio().checked).toBe(true);
  });

  it('stops a camera that arrives after cleanup', async () => {
    const stream = repaintingStream();
    const stops = stream.getTracks().map((t) => vi.spyOn(t, 'stop'));
    const stop = start({ media: media(() => Promise.resolve(stream)) });
    obsRadio().click();
    stop();
    await vi.waitFor(() => {
      for (const s of stops) expect(s).toHaveBeenCalled();
    });
  });
});

describe('startDemoViewer steps and view', () => {
  const snapshot = (renderer: THREE.WebGLRenderer): Uint8Array => {
    const gl = renderer.getContext();
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  };

  it('starts on the finished step and renders a different mapping when another step is chosen', () => {
    const spied = spyStage({ preserveDrawingBuffer: true });
    start({ ...spied.deps, motion: motionQuery(true) });
    expect(stepRadio('done').checked).toBe(true);
    frames.flush();
    const done = snapshot(spied.renderer());

    stepRadio('place').click();
    frames.flush();
    const place = snapshot(spied.renderer());
    expect(place).not.toEqual(done);

    stepRadio('done').click();
    frames.flush();
    expect(snapshot(spied.renderer())).toEqual(done);
  });

  // The room materials pass colours through raw, so the backdrop must reach the screen as the same BACKDROP.
  it('paints the empty backdrop in the same grey as the room', () => {
    const spied = spyStage({ preserveDrawingBuffer: true });
    let controls: OrbitControls | null = null;
    start({
      ...spied.deps,
      motion: motionQuery(true),
      createControls: (camera, element) => {
        controls = new OrbitControls(camera, element);
        return controls;
      },
    });
    frames.flush();
    const orbit = controls as OrbitControls | null;
    if (orbit === null) throw new Error('no controls');
    orbit.minDistance = 0;
    orbit.maxDistance = Infinity;
    orbit.minPolarAngle = 0;
    orbit.object.position.set(0, 40, 0.01);
    orbit.target.set(0, 80, 0);
    orbit.update();
    frames.flush();
    const gl = spied.renderer().getContext();
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    expect(Array.from(pixel)).toEqual([0x2e, 0x2e, 0x2e, 255]);
  });

  it('keeps rendering while a step animates, then settles', () => {
    start({ motion: motionQuery(false) });
    sampleToggle().click();
    frames.flush();
    stepRadio('fit').click();
    frames.flush();
    expect(frames.pending()).toBe(1);
  });

  it('starts from the orbit-1 view and the reset button brings it back after moving', () => {
    let controls: OrbitControls | null = null;
    start({
      motion: motionQuery(true),
      createControls: (camera, element) => {
        controls = new OrbitControls(camera, element);
        return controls;
      },
    });
    frames.flush();
    const camera = (controls as OrbitControls | null)?.object;
    if (camera === undefined) throw new Error('no controls');
    const initial = startPose(scenes.stairs.projector, sceneBounds(scenes.stairs)).position;
    camera.position.toArray().forEach((c, i) => expect(c).toBeCloseTo(initial[i] ?? Number.NaN, 6));

    el('[data-stage]', HTMLDivElement).dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }));
    frames.flush();
    expect(camera.position.distanceTo(new THREE.Vector3(...initial))).toBeGreaterThan(0.01);

    el('[data-reset-view]', HTMLButtonElement).click();
    frames.flush();
    camera.position.toArray().forEach((c, i) => expect(c).toBeCloseTo(initial[i] ?? Number.NaN, 6));
  });

  const recordControls = (): { deps: Partial<ViewerDeps>; controls: () => OrbitControls } => {
    let created: OrbitControls | null = null;
    return {
      deps: {
        createControls: (camera, element) => {
          created = new OrbitControls(camera, element);
          return created;
        },
      },
      controls: () => {
        if (created === null) throw new Error('no controls');
        return created;
      },
    };
  };

  // Simulated frame clock, so damping and the step tween can run to completion.
  const runFrames = (count: number, stepMs = 16): void => {
    const t0 = performance.now();
    Array.from({ length: count }, (_, i) => frames.flush(t0 + i * stepMs));
  };

  it('stops booking frames once a step tween and a damped glide have settled, with the sample paused', () => {
    start({ ...skipDraws, motion: motionQuery(false) });
    sampleToggle().click();
    frames.flush();
    stepRadio('fit').click();
    el('[data-stage]', HTMLDivElement).dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
    runFrames(Math.ceil(STEP_DURATION_MS / 16) + 400);
    expect(frames.pending()).toBe(0);
  });

  it('lands exactly on the start pose when reset during a damped glide', () => {
    const recorded = recordControls();
    start({ ...recorded.deps, ...skipDraws, motion: motionQuery(false) });
    frames.flush();
    const camera = recorded.controls().object;
    const initial = startPose(scenes.stairs.projector, sceneBounds(scenes.stairs)).position;
    el('[data-stage]', HTMLDivElement).dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', shiftKey: true, bubbles: true }));
    runFrames(2);
    el('[data-reset-view]', HTMLButtonElement).click();
    runFrames(60);
    camera.position.toArray().forEach((c, i) => expect(c).toBeCloseTo(initial[i] ?? Number.NaN, 6));
  });

  it('hides and shows the beam from its checkbox', () => {
    const spied = spyStage();
    start({ ...spied.deps, motion: motionQuery(true) });
    frames.flush();
    const beam = (): boolean | undefined => spied.stage().getObjectByName('projector-beam')?.visible;
    expect(beam()).toBe(true);
    radio('[data-beam]').click();
    frames.flush();
    expect(beam()).toBe(false);
    radio('[data-beam]').click();
    frames.flush();
    expect(beam()).toBe(true);
  });

  it('cleanup disposes the controls and stops the frame loop and the camera', async () => {
    let controls: OrbitControls | null = null;
    const stream = repaintingStream();
    const stops = stream.getTracks().map((t) => vi.spyOn(t, 'stop'));
    const stop = start({
      media: media(() => Promise.resolve(stream)),
      createControls: (camera, element) => {
        controls = new OrbitControls(camera, element);
        return controls;
      },
    });
    const dispose = vi.spyOn(controls as unknown as OrbitControls, 'dispose');
    obsRadio().click();
    await vi.waitFor(() => expect(status()).not.toBe('requesting'));
    frames.flush();

    stop();
    expect(dispose).toHaveBeenCalled();
    expect(frames.pending()).toBe(0);
    const before = frames.requested();
    radio('[data-beam]').click();
    setVisibility('visible');
    expect(frames.requested()).toBe(before);
    for (const s of stops) expect(s).toHaveBeenCalled();
  });
});

describe('startDemoViewer sample playback', () => {
  const sampleDraws = (): (() => number) => {
    const spy = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect');
    return () => spy.mock.calls.length;
  };

  it('draws one still frame and no animation when reduced motion is set', () => {
    const draws = sampleDraws();
    start({ motion: motionQuery(true) });
    frames.flush();
    const first = draws();
    expect(first).toBeGreaterThan(0);
    radio('[data-beam]').click();
    frames.flush();
    expect(draws()).toBe(first);
    expect(sampleToggle().textContent).toBe('play');
  });

  it('animates the sample by default and offers a pause button', () => {
    const draws = sampleDraws();
    start({ motion: motionQuery(false) });
    frames.flush();
    const first = draws();
    frames.flush();
    expect(draws()).toBeGreaterThan(first);
    expect(sampleToggle().textContent).toBe('pause');
    expect(sampleToggle().hasAttribute('aria-pressed')).toBe(false);
  });

  it('pauses and resumes the sample from its button', () => {
    const draws = sampleDraws();
    start({ motion: motionQuery(false) });
    frames.flush();
    sampleToggle().click();
    expect(sampleToggle().textContent).toBe('play');
    frames.flush();
    const paused = draws();
    frames.flush();
    expect(draws()).toBe(paused);

    sampleToggle().click();
    expect(sampleToggle().textContent).toBe('pause');
    frames.flush();
    frames.flush();
    expect(draws()).toBeGreaterThan(paused);
  });

  it('stops the animation when reduced motion is switched on later', () => {
    const draws = sampleDraws();
    const motion = motionQuery(false);
    start({ motion });
    frames.flush();
    Object.assign(motion, { matches: true });
    motion.dispatchEvent(new Event('change'));
    frames.flush();
    const still = draws();
    frames.flush();
    expect(draws()).toBe(still);
    expect(sampleToggle().textContent).toBe('play');
  });
});

describe('startDemoViewer renderer', () => {
  const trackRenderer = (): { deps: Partial<ViewerDeps>; ratioCalls: () => number } => {
    let calls = 0;
    return {
      deps: {
        createRenderer: (canvas) => {
          const renderer = new THREE.WebGLRenderer({ canvas });
          const original = renderer.setPixelRatio.bind(renderer);
          renderer.setPixelRatio = (value) => {
            calls++;
            original(value);
          };
          return renderer;
        },
      },
      ratioCalls: () => calls,
    };
  };

  it('does not resize the canvas again when its size is unchanged', () => {
    const tracked = trackRenderer();
    start({ ...tracked.deps, motion: motionQuery(false) });
    frames.flush();
    expect(tracked.ratioCalls()).toBe(1);
    frames.flush();
    expect(tracked.ratioCalls()).toBe(1);
  });

  it('resizes the canvas when its size changes', async () => {
    const tracked = trackRenderer();
    start(tracked.deps);
    frames.flush();
    root.querySelector<HTMLCanvasElement>('[data-stage-canvas]')?.style.setProperty('width', '400px');
    await vi.waitFor(() => {
      frames.flush();
      expect(tracked.ratioCalls()).toBe(2);
    });
  });

  // devicePixelRatio is an own property of window, so the original is put back rather than deleted.
  it('caps the pixel ratio at 2', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => 3 });
    try {
      const spied = spyStage();
      start(spied.deps);
      frames.flush();
      expect(spied.renderer().getPixelRatio()).toBe(2);
    } finally {
      if (original !== undefined) Object.defineProperty(window, 'devicePixelRatio', original);
    }
  });
});

describe('startDemoViewer failure fallback', () => {
  const expectFallback = (): void => {
    expect(root.getAttribute('data-webgl')).toBe('unavailable');
    expect(root.querySelector('[data-webgl-fallback]')?.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('[data-stage-canvas]')?.hasAttribute('hidden')).toBe(true);
  };

  it('shows the fallback and stops booking frames when a draw throws', () => {
    start({
      createRenderer: (canvas) => {
        const renderer = new THREE.WebGLRenderer({ canvas });
        vi.spyOn(renderer, 'render').mockImplementation(() => {
          throw new Error('draw failed');
        });
        return renderer;
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => frames.flush()).not.toThrow();
    expectFallback();
    expect(frames.pending()).toBe(0);
  });

  it('shows the fallback when the canvas loses its WebGL context', () => {
    start();
    frames.flush();
    root.querySelector('[data-stage-canvas]')?.dispatchEvent(new Event('webglcontextlost'));
    expectFallback();
    expect(frames.pending()).toBe(0);
  });
});
