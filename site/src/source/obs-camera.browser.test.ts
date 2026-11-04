import { describe, expect, it, vi } from 'vitest';

import { openObsCamera, type CameraMedia } from './obs-camera';

const liveStream = (): MediaStream => {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  canvas.getContext('2d')?.fillRect(0, 0, 10, 10);
  return canvas.captureStream(30);
};

const device = (deviceId: string, label: string, kind: MediaDeviceKind = 'videoinput'): MediaDeviceInfo => ({ deviceId, label, kind, groupId: '', toJSON: () => ({}) });

const fakeMedia = (devices: readonly MediaDeviceInfo[]): { media: CameraMedia; streams: MediaStream[]; getUserMedia: ReturnType<typeof vi.fn> } => {
  const streams: MediaStream[] = [];
  const getUserMedia = vi.fn(() => {
    const stream = liveStream();
    streams.push(stream);
    return Promise.resolve(stream);
  });
  return { media: { getUserMedia, enumerateDevices: () => Promise.resolve([...devices]) }, streams, getUserMedia };
};

describe('openObsCamera', () => {
  it('reopens with the OBS camera when another camera answered first, and stops the first one', async () => {
    const fake = fakeMedia([device('cam-1', 'FaceTime HD Camera'), device('mic', 'OBS mic', 'audioinput'), device('cam-obs', 'OBS Virtual Camera')]);
    const result = await openObsCamera(fake.media);
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(fake.getUserMedia).toHaveBeenCalledTimes(2);
    expect(fake.getUserMedia.mock.calls[1]?.[0]).toMatchObject({ video: { deviceId: { exact: 'cam-obs' } } });
    for (const track of fake.streams[0]?.getTracks() ?? []) expect(track.readyState).toBe('ended');
    expect(result.activeId).toBe('cam-obs');
    expect(result.cameras.map((d) => d.deviceId)).toEqual(['cam-1', 'cam-obs']);
    result.source.stop();
  });

  it('keeps the first camera when there is no OBS camera', async () => {
    const fake = fakeMedia([device('cam-1', 'FaceTime HD Camera')]);
    const result = await openObsCamera(fake.media);
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(fake.getUserMedia).toHaveBeenCalledTimes(1);
    expect(result.cameras).toHaveLength(1);
    result.source.stop();
  });

  it('passes a refusal through without enumerating', async () => {
    const enumerateDevices = vi.fn(() => Promise.resolve([]));
    const result = await openObsCamera({ getUserMedia: () => Promise.reject(new DOMException('no', 'NotAllowedError')), enumerateDevices });
    expect(result).toEqual({ kind: 'denied' });
    expect(enumerateDevices).not.toHaveBeenCalled();
  });

  it('keeps the first camera when the device list cannot be read', async () => {
    const result = await openObsCamera({ getUserMedia: () => Promise.resolve(liveStream()), enumerateDevices: () => Promise.reject(new Error('nope')) });
    if (result.kind !== 'ok') throw new Error('expected ok');
    expect(result.cameras).toEqual([]);
    result.source.stop();
  });

  it('is unavailable without mediaDevices', async () => {
    expect(await openObsCamera(undefined)).toEqual({ kind: 'unavailable' });
  });
});
