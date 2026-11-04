import { isLetterboxed } from '../source/frame-fit';
import { openObsCamera, type CameraMedia } from '../source/obs-camera';
import { isObsCamera } from '../source/pick-camera';
import { startWebcam, type WebcamFailure, type WebcamResult } from '../source/webcam-source';
import type { FrameSize, Sources } from './sources';

export type InputMode = 'sample' | 'obs';
export type InputParts = {
  radios: readonly HTMLInputElement[];
  deviceField: HTMLElement;
  device: HTMLSelectElement;
  status: HTMLElement;
};
export type CameraInput = { release: () => void; dispose: () => void };

type Message = 'sample' | 'requesting' | 'waiting' | 'obs' | 'other' | 'letterbox' | 'denied' | 'unavailable' | 'busy' | 'disconnected' | 'switchFailed';
type Opened = Extract<WebcamResult, { kind: 'ok' }>;
type Cleanup = () => void;

const text = (status: HTMLElement, message: Message, label = ''): string => (status.dataset[message] ?? '').replace('{label}', label);

// Japanese runs sentences together, English separates them; the page sets data-join.
const say = (status: HTMLElement, messages: readonly Message[], label = ''): void => {
  status.replaceChildren(messages.map((m) => text(status, m, label)).join(status.dataset['join'] ?? ' '));
};

const unnamedCamera = (parts: InputParts, index: number): string => `${parts.status.dataset['unnamed'] ?? ''} ${String(index + 1)}`;

const cameraName = (parts: InputParts, camera: MediaDeviceInfo | undefined, index: number): string => (camera === undefined || camera.label === '' ? unnamedCamera(parts, index) : camera.label);

const fillDevices = (parts: InputParts, cameras: readonly MediaDeviceInfo[], activeId: string | undefined): void => {
  parts.device.replaceChildren(...cameras.map((c, i) => new Option(cameraName(parts, c, i), c.deviceId, false, c.deviceId === activeId)));
  parts.deviceField.toggleAttribute('hidden', cameras.length === 0);
};

const checkMode = (parts: InputParts, mode: InputMode): void => {
  for (const radio of parts.radios) Object.assign(radio, { checked: radio.value === mode });
};

const liveMessages = (label: string, size: FrameSize): Message[] => [isObsCamera({ label }) ? 'obs' : 'other', ...(isLetterboxed(size.width, size.height) ? (['letterbox'] as const) : [])];

// The opened camera, or null once a stale one is stopped or a failure is handed to `fail`.
const accept = (current: boolean, result: WebcamResult, fail: (kind: WebcamFailure['kind']) => void): Opened | null => {
  if (!current) {
    if (result.kind === 'ok') result.source.stop();
    return null;
  }
  if (result.kind === 'ok') return result;
  fail(result.kind);
  return null;
};

const labelOf = (parts: InputParts, cameras: readonly MediaDeviceInfo[], id: string | undefined): string => {
  const index = cameras.findIndex((c) => c.deviceId === id);
  return cameraName(parts, cameras[index], Math.max(0, index));
};

// A failed switch leaves the camera that already works on the stage.
const keepCurrent = (parts: InputParts, activeId: string | undefined): void => {
  Object.assign(parts.device, { value: activeId ?? '' });
  say(parts.status, ['switchFailed']);
};

type Session = { begin: () => Promise<void>; switchTo: (deviceId: string) => Promise<void>; release: (message: Message) => void };

// Each request gets a ticket; a camera that arrives after release() or a newer request is stopped at once.
const createSession = (parts: InputParts, media: CameraMedia | undefined, sources: Sources, onMode: (mode: InputMode) => void): Session => {
  let ticket = 0;
  let cameras: readonly MediaDeviceInfo[] = [];
  let activeId: string | undefined;
  let unsubscribe: Cleanup = () => undefined;
  const release = (message: Message): void => {
    ticket = ticket + 1;
    unsubscribe();
    sources.dropCamera();
    parts.deviceField.toggleAttribute('hidden', true);
    checkMode(parts, 'sample');
    onMode('sample');
    say(parts.status, [message]);
  };
  const attach = (opened: Opened, id: string | undefined): void => {
    unsubscribe();
    activeId = id;
    const label = labelOf(parts, cameras, id);
    sources.useCamera(opened.source, (size) => say(parts.status, liveMessages(label, size), label));
    unsubscribe = opened.onEnded(() => release('disconnected'));
    fillDevices(parts, cameras, activeId);
    say(parts.status, ['waiting']);
  };
  const claim = (): number => {
    ticket = ticket + 1;
    say(parts.status, ['requesting']);
    return ticket;
  };
  return {
    async begin() {
      const mine = claim();
      const result = await openObsCamera(media);
      const opened = accept(mine === ticket, result, release);
      if (opened === null || result.kind !== 'ok') return;
      cameras = result.cameras;
      attach(opened, result.activeId);
    },
    async switchTo(deviceId) {
      const mine = claim();
      const result = await startWebcam(media, { deviceId });
      const opened = accept(mine === ticket, result, () => keepCurrent(parts, activeId));
      if (opened !== null) attach(opened, deviceId);
    },
    release,
  };
};

/** Binds the input radios and camera list; choosing OBS is the only thing that ever opens a camera. */
export const createCameraInput = (parts: InputParts, media: CameraMedia | undefined, sources: Sources, onMode: (mode: InputMode) => void): CameraInput => {
  const session = createSession(parts, media, sources, onMode);
  const onRadio = (event: Event): void => {
    const radio = event.target;
    if (!(radio instanceof HTMLInputElement) || !radio.checked) return;
    if (radio.value === 'sample') return session.release('sample');
    onMode('obs');
    void session.begin();
  };
  const onDevice = (): void => void session.switchTo(parts.device.value);
  for (const radio of parts.radios) radio.addEventListener('change', onRadio);
  parts.device.addEventListener('change', onDevice);
  return {
    release: () => session.release('sample'),
    dispose() {
      for (const radio of parts.radios) radio.removeEventListener('change', onRadio);
      parts.device.removeEventListener('change', onDevice);
      session.release('sample');
    },
  };
};
