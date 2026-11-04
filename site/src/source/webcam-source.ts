import * as THREE from 'three';

import { letterbox } from './frame-fit';
import { SOURCE_HEIGHT as H, SOURCE_WIDTH as W, type VideoSource } from './video-source';

export type WebcamFailure = { kind: 'denied' } | { kind: 'busy' } | { kind: 'unavailable' };

export type CameraSource = VideoSource & {
  /** The camera's own frame size; 0 x 0 until its metadata arrives. */
  size(): { width: number; height: number };
  deviceId(): string | undefined;
};

export type WebcamResult = { kind: 'ok'; source: CameraSource; onEnded(listener: () => void): () => void } | WebcamFailure;

type Media = Pick<MediaDevices, 'getUserMedia'>;
export type WebcamOptions = { deviceId?: string; createCanvas?: () => HTMLCanvasElement };

const constraints = (deviceId: string | undefined): MediaStreamConstraints => ({
  video: { ...(deviceId === undefined ? {} : { deviceId: { exact: deviceId } }), width: { ideal: W }, height: { ideal: H } },
  audio: false,
});
const DENIED_ERRORS: ReadonlySet<string> = new Set(['NotAllowedError', 'SecurityError']);
// Another app (typically OBS on Windows) already holds the device.
const BUSY_ERRORS: ReadonlySet<string> = new Set(['NotReadableError', 'TrackStartError']);

const errorName = (error: unknown): string => (error instanceof Error ? error.name : '');

const toFailure = (error: unknown): WebcamFailure => {
  const name = errorName(error);
  if (DENIED_ERRORS.has(name)) return { kind: 'denied' };
  if (BUSY_ERRORS.has(name)) return { kind: 'busy' };
  return { kind: 'unavailable' };
};

const playWhenReady = async (video: HTMLVideoElement): Promise<void> => {
  try {
    await video.play();
  } catch {
    return;
  }
};

const openVideo = (stream: MediaStream): HTMLVideoElement => {
  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;
  video.srcObject = stream;
  Object.assign(video.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' });
  video.setAttribute('aria-hidden', 'true');
  document.body.append(video);
  // Playback starts when the first frame arrives; update() skips drawing until then.
  void playWhenReady(video);
  return video;
};

const endedNotifier = (stream: MediaStream): ((listener: () => void) => () => void) => {
  const listeners = new Set<() => void>();
  let fired = false;
  const fire = (): void => {
    if (fired) return;
    fired = true;
    for (const listener of listeners) listener();
  };
  for (const track of stream.getTracks()) track.addEventListener('ended', fire, { once: true });
  return (listener) => {
    if (fired) {
      queueMicrotask(listener);
      return () => undefined;
    }
    listeners.add(listener);
    return () => void listeners.delete(listener);
  };
};

// Black bars around a frame that is not 16:9, so the projector never stretches or crops it.
const drawLetterboxed = (ctx: CanvasRenderingContext2D, video: HTMLVideoElement): void => {
  const rect = letterbox(video.videoWidth, video.videoHeight);
  Object.assign(ctx, { fillStyle: '#000' });
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(video, rect.x * W, rect.y * H, rect.width * W, rect.height * H);
};

const createSource = (stream: MediaStream, video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): CameraSource => {
  let drawn = false;
  // Re-uploaded every frame and projected texel for texel, so mipmaps would only cost time and blur edges.
  const texture = new THREE.CanvasTexture(canvas);
  Object.assign(texture, { colorSpace: THREE.NoColorSpace, generateMipmaps: false, minFilter: THREE.LinearFilter });

  return {
    texture,
    ready: () => drawn,
    size: () => ({ width: video.videoWidth, height: video.videoHeight }),
    deviceId: () => stream.getVideoTracks()[0]?.getSettings().deviceId,
    update() {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      drawLetterboxed(ctx, video);
      drawn = true;
      texture.needsUpdate = true;
    },
    stop() {
      stopTracks(stream);
      Object.assign(video, { srcObject: null });
      video.remove();
      texture.dispose();
    },
  };
};

const stopTracks = (stream: MediaStream): void => {
  for (const track of stream.getTracks()) track.stop();
};

type Acquired = { kind: 'stream'; stream: MediaStream } | WebcamFailure;

const acquire = async (media: Media, deviceId: string | undefined): Promise<Acquired> => {
  try {
    return { kind: 'stream', stream: await media.getUserMedia(constraints(deviceId)) };
  } catch (error) {
    return toFailure(error);
  }
};

const defaultCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  return canvas;
};

class SetupUnavailableError extends Error {}

const openContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new SetupUnavailableError();
  return ctx;
};

// Never touches the camera until called, so the page does not prompt on load.
export const startWebcam = async (media: Media | undefined = navigator.mediaDevices, { deviceId, createCanvas = defaultCanvas }: WebcamOptions = {}): Promise<WebcamResult> => {
  if (media === undefined) return { kind: 'unavailable' };
  const acquired = await acquire(media, deviceId);
  if (acquired.kind !== 'stream') return acquired;

  const { stream } = acquired;
  let video: HTMLVideoElement | null = null;
  try {
    const canvas = createCanvas();
    const ctx = openContext(canvas);
    video = openVideo(stream);
    return { kind: 'ok', source: createSource(stream, video, canvas, ctx), onEnded: endedNotifier(stream) };
  } catch (error) {
    stopTracks(stream);
    video?.remove();
    if (error instanceof SetupUnavailableError) return { kind: 'unavailable' };
    throw error;
  }
};
