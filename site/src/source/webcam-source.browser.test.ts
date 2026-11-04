import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { startWebcam } from './webcam-source';

type Media = NonNullable<Parameters<typeof startWebcam>[0]>;

const rejecting = (name: string): Media => ({
  getUserMedia: () => Promise.reject(new DOMException('nope', name)),
});

const liveStream = (): MediaStream => {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  canvas.getContext('2d')?.fillRect(0, 0, 10, 10);
  return canvas.captureStream(30);
};

// captureStream only emits when the canvas changes, so a static canvas can leave the video without a frame under load.
const repaintingStream = (colors: readonly string[] = ['#000', '#fff']): { stream: MediaStream; stopRepainting(): void } => {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  let tick = 0;
  const timer = setInterval(() => {
    tick++;
    if (ctx !== null) ctx.fillStyle = colors[tick % colors.length] ?? '#fff';
    ctx?.fillRect(0, 0, 640, 480);
  }, 16);
  return { stream: canvas.captureStream(30), stopRepainting: () => clearInterval(timer) };
};

const waitReady = async (source: { update(t: number): void; ready(): boolean }): Promise<void> =>
  vi.waitFor(
    () => {
      source.update(0);
      expect(source.ready()).toBe(true);
    },
    { timeout: 10_000, interval: 20 },
  );

const pixel = (canvas: HTMLCanvasElement, x: number, y: number): number[] => Array.from(canvas.getContext('2d')?.getImageData(x, y, 1, 1).data ?? []);

describe('startWebcam errors', () => {
  it.each(['NotAllowedError', 'SecurityError'])('maps %s to denied', async (name) => {
    expect(await startWebcam(rejecting(name))).toEqual({ kind: 'denied' });
  });

  it.each(['NotReadableError', 'TrackStartError'])('maps %s (camera held by another app such as OBS) to busy', async (name) => {
    expect(await startWebcam(rejecting(name))).toEqual({ kind: 'busy' });
  });

  it.each(['NotFoundError', 'OverconstrainedError', 'AbortError'])('maps %s to unavailable', async (name) => {
    expect(await startWebcam(rejecting(name))).toEqual({ kind: 'unavailable' });
  });

  it('treats an unknown rejection as unavailable', async () => {
    const media: Media = { getUserMedia: () => Promise.reject(new Error('boom')) };
    expect(await startWebcam(media)).toEqual({ kind: 'unavailable' });
  });

  it('is unavailable without mediaDevices', async () => {
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'mediaDevices');
    Object.defineProperty(Navigator.prototype, 'mediaDevices', { configurable: true, get: () => undefined });
    try {
      expect(await startWebcam()).toEqual({ kind: 'unavailable' });
    } finally {
      if (original !== undefined) Object.defineProperty(Navigator.prototype, 'mediaDevices', original);
    }
  });
});

describe('startWebcam success', () => {
  it('requests 1920x1080 video without audio', async () => {
    const getUserMedia = vi.fn(() => Promise.resolve(liveStream()));
    const result = await startWebcam({ getUserMedia });
    expect(getUserMedia).toHaveBeenCalledWith({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    if (result.kind === 'ok') result.source.stop();
  });

  it('asks for the exact device when one is given', async () => {
    const getUserMedia = vi.fn(() => Promise.resolve(liveStream()));
    const result = await startWebcam({ getUserMedia }, { deviceId: 'cam-obs' });
    expect(getUserMedia).toHaveBeenCalledWith({ video: { deviceId: { exact: 'cam-obs' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    if (result.kind === 'ok') result.source.stop();
  });

  it('fits a 4:3 frame into 16:9 with black bars instead of stretching or cropping it', async () => {
    const { stream, stopRepainting } = repaintingStream(['#fff']);
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const result = await startWebcam({ getUserMedia: () => Promise.resolve(stream) }, { createCanvas: () => canvas });
    if (result.kind !== 'ok') throw new Error('expected ok');
    try {
      await waitReady(result.source);
      expect(result.source.size()).toEqual({ width: 640, height: 480 });
      expect(pixel(canvas, 100, 540)).toEqual([0, 0, 0, 255]);
      expect(pixel(canvas, 1820, 540)).toEqual([0, 0, 0, 255]);
      expect(pixel(canvas, 960, 5)).toEqual([255, 255, 255, 255]);
      expect(pixel(canvas, 260, 1075)).toEqual([255, 255, 255, 255]);
    } finally {
      stopRepainting();
      result.source.stop();
    }
  });

  it('exposes a 1920x1080 canvas texture with pass-through colour', async () => {
    const result = await startWebcam({ getUserMedia: () => Promise.resolve(liveStream()) });
    if (result.kind !== 'ok') throw new Error('expected ok');
    const image: unknown = result.source.texture.image;
    if (!(image instanceof HTMLCanvasElement)) throw new Error('expected a canvas image');
    expect([image.width, image.height]).toEqual([1920, 1080]);
    expect(result.source.texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(result.source.texture.generateMipmaps).toBe(false);
    expect(result.source.texture.minFilter).toBe(THREE.LinearFilter);
    result.source.update(0);
    result.source.stop();
  });

  it('fires onEnded once even when several tracks end', async () => {
    const stream = liveStream();
    stream.getVideoTracks().forEach((t) => stream.addTrack(t.clone()));
    const result = await startWebcam({ getUserMedia: () => Promise.resolve(stream) });
    if (result.kind !== 'ok') throw new Error('expected ok');
    const listener = vi.fn();
    result.onEnded(listener);
    for (const track of stream.getTracks()) track.dispatchEvent(new Event('ended'));
    expect(listener).toHaveBeenCalledTimes(1);
    result.source.stop();
  });

  it('does not call a listener after unsubscribe', async () => {
    const stream = liveStream();
    const result = await startWebcam({ getUserMedia: () => Promise.resolve(stream) });
    if (result.kind !== 'ok') throw new Error('expected ok');
    const listener = vi.fn();
    result.onEnded(listener)();
    for (const track of stream.getTracks()) track.dispatchEvent(new Event('ended'));
    expect(listener).not.toHaveBeenCalled();
    result.source.stop();
  });

  it('stop() stops every track', async () => {
    const stream = liveStream();
    const result = await startWebcam({ getUserMedia: () => Promise.resolve(stream) });
    if (result.kind !== 'ok') throw new Error('expected ok');
    const stops = stream.getTracks().map((t) => vi.spyOn(t, 'stop'));
    result.source.stop();
    for (const stop of stops) expect(stop).toHaveBeenCalled();
  });

  it('stop() detaches the hidden video, clears srcObject and disposes the texture', async () => {
    const result = await startWebcam({ getUserMedia: () => Promise.resolve(liveStream()) });
    if (result.kind !== 'ok') throw new Error('expected ok');
    const video = document.body.querySelector('video[aria-hidden="true"]');
    if (!(video instanceof HTMLVideoElement)) throw new Error('expected a hidden video in the body');
    const disposed = vi.fn();
    result.source.texture.addEventListener('dispose', disposed);
    result.source.stop();
    expect(video.isConnected).toBe(false);
    expect(video.srcObject).toBeNull();
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it('becomes ready after the first frame is drawn', async () => {
    const { stream, stopRepainting } = repaintingStream();
    const result = await startWebcam({ getUserMedia: () => Promise.resolve(stream) });
    if (result.kind !== 'ok') throw new Error('expected ok');
    try {
      expect(result.source.ready()).toBe(false);
      await waitReady(result.source);
    } finally {
      stopRepainting();
      result.source.stop();
    }
  });

  it('calls a listener subscribed after the tracks already ended', async () => {
    const stream = liveStream();
    const result = await startWebcam({ getUserMedia: () => Promise.resolve(stream) });
    if (result.kind !== 'ok') throw new Error('expected ok');
    for (const track of stream.getTracks()) track.dispatchEvent(new Event('ended'));
    const listener = vi.fn();
    result.onEnded(listener);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    result.source.stop();
  });

  it('stops the acquired stream and reports unavailable when setup fails', async () => {
    const stream = liveStream();
    const noContext = document.createElement('canvas');
    noContext.getContext = () => null;
    const result = await startWebcam({ getUserMedia: () => Promise.resolve(stream) }, { createCanvas: () => noContext });
    expect(result).toEqual({ kind: 'unavailable' });
    for (const track of stream.getTracks()) expect(track.readyState).toBe('ended');
  });

  it('stops the stream, removes the video and rethrows when setup throws', async () => {
    const stream = liveStream();
    const before = document.body.querySelectorAll('video').length;
    const boom = new Error('canvas factory failed');
    const start = startWebcam(
      { getUserMedia: () => Promise.resolve(stream) },
      {
        createCanvas: () => {
          throw boom;
        },
      },
    );
    await expect(start).rejects.toBe(boom);
    for (const track of stream.getTracks()) expect(track.readyState).toBe('ended');
    expect(document.body.querySelectorAll('video').length).toBe(before);
  });
});
