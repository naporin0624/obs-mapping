import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import type { Mapping } from '../../../ui/src/model/mapping';
import { isDemoSlug, mappings, scenes } from '../demos';
import { createOutputRenderer } from '../render/output-renderer';
import { BACKDROP } from '../render/stage-palette';
import { createStageScene, type StageScene } from '../render/stage-scene';
import type { SceneSpec } from '../scene/spec';
import type { CameraMedia } from '../source/obs-camera';
import { stageFrame, type Frame } from '../story/stage-frame';
import { createStepTimeline, type StepTimeline } from '../story/step-timeline';
import { createCameraInput, type CameraInput, type InputMode } from '../viewer/camera-input';
import { createLoop, type FrameScheduler, type Loop } from '../viewer/loop';
import { createOrbit } from '../viewer/orbit';
import { createSources, type Projected, type Sources } from '../viewer/sources';

type MotionQuery = EventTarget & { readonly matches: boolean };

export type ViewerDeps = FrameScheduler & {
  createRenderer: (canvas: HTMLCanvasElement) => THREE.WebGLRenderer;
  createControls: (camera: THREE.PerspectiveCamera, element: HTMLElement) => OrbitControls;
  media: CameraMedia | undefined;
  /** The prefers-reduced-motion query; it snaps the steps, stops damping and holds the sample still. */
  motion: MotionQuery;
};

type Parts = {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  fallback: HTMLElement;
  hint: HTMLElement;
  input: HTMLFieldSetElement;
  sourceRadios: readonly HTMLInputElement[];
  deviceField: HTMLElement;
  device: HTMLSelectElement;
  status: HTMLElement;
  sampleToggle: HTMLButtonElement;
  steps: HTMLFieldSetElement;
  stepsLocked: HTMLElement;
  stepRadios: readonly HTMLInputElement[];
  beam: HTMLInputElement;
  reset: HTMLButtonElement;
};

type Cleanup = () => void;

const MAX_PIXEL_RATIO = 2;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
// The clear colour is colour-managed, unlike the raw room materials.
const CLEAR = new THREE.Color().setHex(BACKDROP, THREE.SRGBColorSpace);

const defaultDeps = (): ViewerDeps => ({
  createRenderer: (canvas) => new THREE.WebGLRenderer({ canvas, antialias: true }),
  createControls: (camera, element) => new OrbitControls(camera, element),
  media: navigator.mediaDevices,
  requestFrame: (cb) => requestAnimationFrame(cb),
  cancelFrame: (id) => cancelAnimationFrame(id),
  motion: window.matchMedia(REDUCED_MOTION),
});

const pick = <T extends Element>(root: HTMLElement, selector: string, type: new () => T): T => {
  const el = root.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`demo viewer: missing ${selector}`);
  return el;
};

const pickAll = (root: HTMLElement, selector: string): HTMLInputElement[] => Array.from(root.querySelectorAll(selector)).filter((el) => el instanceof HTMLInputElement);

const queryParts = (root: HTMLElement): Parts => ({
  stage: pick(root, '[data-stage]', HTMLElement),
  canvas: pick(root, '[data-stage-canvas]', HTMLCanvasElement),
  fallback: pick(root, '[data-webgl-fallback]', HTMLElement),
  hint: pick(root, '[data-hint]', HTMLElement),
  input: pick(root, '[data-input]', HTMLFieldSetElement),
  sourceRadios: pickAll(root, '[data-source-radio]'),
  deviceField: pick(root, '[data-device-field]', HTMLElement),
  device: pick(root, '[data-device]', HTMLSelectElement),
  status: pick(root, '[data-camera-status]', HTMLElement),
  sampleToggle: pick(root, '[data-sample-toggle]', HTMLButtonElement),
  steps: pick(root, '[data-steps]', HTMLFieldSetElement),
  stepsLocked: pick(root, '[data-steps-locked]', HTMLElement),
  stepRadios: pickAll(root, '[data-step-radio]'),
  beam: pick(root, '[data-beam]', HTMLInputElement),
  reset: pick(root, '[data-reset-view]', HTMLButtonElement),
});

const listen = (target: EventTarget, type: string, handler: (event: Event) => void, options?: AddEventListenerOptions): Cleanup => {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
};

const runAll = (cleanups: readonly Cleanup[]): void => {
  for (const cleanup of cleanups) cleanup();
};

// Steps and the download keep working; only what needs the 3D view goes away.
const showFallback = (root: HTMLElement, parts: Parts): void => {
  root.setAttribute('data-webgl', 'unavailable');
  for (const el of [parts.canvas, parts.hint, parts.sampleToggle]) el.toggleAttribute('hidden', true);
  parts.fallback.toggleAttribute('hidden', false);
  parts.stage.removeAttribute('tabindex');
  for (const el of [parts.input, parts.beam, parts.reset]) el.toggleAttribute('disabled', true);
};

type View = { stage: StageScene; draw: (frame: Frame, projected: Projected) => void; resize: () => void; dispose: () => void };

// Resizing reallocates the drawing buffer, so it only happens when the size or DPR really changed.
const createFit = (renderer: THREE.WebGLRenderer, canvas: HTMLCanvasElement, resize: (w: number, h: number) => void): (() => void) => {
  let fitted = '';
  return () => {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    const ratio = Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio);
    const key = `${String(clientWidth)}x${String(clientHeight)}@${String(ratio)}`;
    if (key === fitted) return;
    fitted = key;
    renderer.setPixelRatio(ratio);
    resize(clientWidth, clientHeight);
  };
};

// The sample goes through the in-page output renderer; the OBS camera already is the output.
const createView = (renderer: THREE.WebGLRenderer, canvas: HTMLCanvasElement, spec: SceneSpec): View => {
  renderer.setClearColor(CLEAR, 1);
  const output = createOutputRenderer(renderer);
  const stage = createStageScene(renderer, spec, output.texture);
  return {
    stage,
    draw(frame, projected) {
      if (projected.kind === 'sample') output.render(frame, projected.texture);
      stage.setProjected(projected.kind === 'sample' ? output.texture : projected.texture);
      stage.render();
    },
    resize: createFit(renderer, canvas, (w, h) => stage.resize(w, h)),
    dispose() {
      stage.dispose();
      output.dispose();
      renderer.dispose();
    },
  };
};

const openRenderer = (deps: ViewerDeps, canvas: HTMLCanvasElement): THREE.WebGLRenderer | null => {
  try {
    return deps.createRenderer(canvas);
  } catch {
    return null;
  }
};

const openView = (deps: ViewerDeps, canvas: HTMLCanvasElement, spec: SceneSpec): View | null => {
  const renderer = openRenderer(deps, canvas);
  if (renderer === null) return null;
  try {
    return createView(renderer, canvas, spec);
  } catch {
    renderer.dispose();
    return null;
  }
};

const observeOnScreen = (target: Element, onChange: (onScreen: boolean) => void): Cleanup => {
  const observer = new IntersectionObserver((entries) => {
    const last = entries.at(-1);
    if (last !== undefined) onChange(last.isIntersecting);
  });
  observer.observe(target);
  return () => observer.disconnect();
};

const observeSize = (target: Element, onChange: () => void): Cleanup => {
  const observer = new ResizeObserver(onChange);
  observer.observe(target);
  return () => observer.disconnect();
};

// Reduced motion starts the sample paused; the button lets anyone pause or play it (WCAG 2.2.2).
const controlSample = (button: HTMLButtonElement, sources: Sources, motion: MotionQuery, loop: Loop): Cleanup => {
  let playing = !motion.matches;
  const set = (next: boolean): void => {
    playing = next;
    sources.setPlaying(playing);
    button.replaceChildren((playing ? button.dataset['pause'] : button.dataset['play']) ?? '');
    loop.invalidate();
  };
  set(playing);
  const cleanups = [listen(button, 'click', () => set(!playing)), listen(motion, 'change', () => set(!motion.matches))];
  return () => runAll(cleanups);
};

const checkedStep = (parts: Parts, spec: SceneSpec): number => {
  const value = parts.stepRadios.find((r) => r.checked)?.value;
  const index = spec.steps.findIndex((id) => id === value);
  return index < 0 ? spec.steps.length - 1 : index;
};

// The OBS camera already carries the finished output, so the steps and the sample control step aside.
const applyMode = (parts: Parts, mode: InputMode): void => {
  parts.steps.toggleAttribute('disabled', mode === 'obs');
  parts.stepsLocked.toggleAttribute('hidden', mode !== 'obs');
  parts.sampleToggle.toggleAttribute('hidden', mode === 'obs');
};

const subscribeSteps = (parts: Parts, spec: SceneSpec, timeline: StepTimeline, loop: Loop): Cleanup[] =>
  parts.stepRadios.map((radio) =>
    listen(radio, 'change', () => {
      timeline.select(checkedStep(parts, spec));
      loop.invalidate();
    }),
  );

const subscribeView = (parts: Parts, view: View, reset: () => void, loop: Loop, motion: MotionQuery): Cleanup[] => [
  listen(parts.beam, 'change', () => {
    view.stage.setBeamVisible(parts.beam.checked);
    loop.invalidate();
  }),
  listen(parts.reset, 'click', reset),
  listen(motion, 'change', loop.invalidate),
  observeSize(parts.canvas, loop.invalidate),
];

type Gates = { alive: boolean; onScreen: boolean };

const subscribeLifecycle = (parts: Parts, gates: Gates, refresh: () => void, camera: CameraInput, lose: () => void): Cleanup[] => [
  listen(document, 'visibilitychange', refresh),
  listen(window, 'pagehide', () => camera.release()),
  listen(parts.canvas, 'webglcontextlost', lose),
  observeOnScreen(parts.canvas, (onScreen) => {
    Object.assign(gates, { onScreen });
    refresh();
  }),
];

const runViewer = (root: HTMLElement, parts: Parts, view: View, spec: SceneSpec, mapping: Mapping, deps: ViewerDeps): Cleanup => {
  const sources = createSources(root);
  const timeline = createStepTimeline(checkedStep(parts, spec), () => deps.motion.matches);
  const orbit = createOrbit(deps.createControls(view.stage.camera, parts.canvas), spec, parts.stage, deps.motion, () => loop.invalidate());
  const draw = (timeMs: number): boolean => {
    view.resize();
    const moving = orbit.update();
    const { index, t } = timeline.at(timeMs);
    view.draw(stageFrame(mapping, spec.steps, index, t), sources.current(timeMs));
    return moving || timeline.animating() || sources.live();
  };
  const loop = createLoop(deps, draw, (error) => {
    console.error(error);
    lose();
  });
  const gates: Gates = { alive: true, onScreen: true };
  const refresh = (): void => loop.setOpen(gates.alive && gates.onScreen && document.visibilityState === 'visible');
  const inputParts = { radios: parts.sourceRadios, deviceField: parts.deviceField, device: parts.device, status: parts.status };
  const camera = createCameraInput(inputParts, deps.media, sources, (mode) => {
    applyMode(parts, mode);
    loop.invalidate();
  });
  const stop = (): void => {
    gates.alive = false;
    refresh();
    runAll(subscriptions);
    camera.dispose();
    orbit.dispose();
    sources.stop();
  };
  const lose = (): void => {
    showFallback(root, parts);
    stop();
  };
  const subscriptions = [
    ...subscribeSteps(parts, spec, timeline, loop),
    ...subscribeView(parts, view, orbit.reset, loop, deps.motion),
    controlSample(parts.sampleToggle, sources, deps.motion, loop),
    ...subscribeLifecycle(parts, gates, refresh, camera, lose),
  ];
  root.setAttribute('data-webgl', 'ok');
  refresh();
  return () => {
    if (gates.alive) stop();
    view.dispose();
  };
};

/** Wires the viewer for one demo; the returned function stops the loop, controls, listeners, camera and GL. */
export const startDemoViewer = (root: HTMLElement, spec: SceneSpec, mapping: Mapping, overrides: Partial<ViewerDeps> = {}): Cleanup => {
  const deps = { ...defaultDeps(), ...overrides };
  const parts = queryParts(root);
  const view = openView(deps, parts.canvas, spec);
  if (view === null) {
    showFallback(root, parts);
    return () => undefined;
  }
  return runViewer(root, parts, view, spec, mapping, deps);
};

/** Starts the viewer found in the page; called once by the component's own script. */
export const mountDemoViewer = (doc: Document): Cleanup => {
  const root = doc.querySelector<HTMLElement>('[data-demo-viewer]');
  const slug = root?.dataset['demoViewer'];
  if (root === null || !isDemoSlug(slug)) return () => undefined;
  return startDemoViewer(root, scenes[slug], mappings[slug]);
};
