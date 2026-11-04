import { describe, expect, it } from 'vitest';

import { pickCameraDevice, videoInputs } from './pick-camera';

const device = (deviceId: string, label: string, kind: MediaDeviceKind = 'videoinput'): MediaDeviceInfo => ({ deviceId, label, kind, groupId: '', toJSON: () => ({}) }) as const;

const facetime = device('cam-1', 'FaceTime HD Camera');
const obs = device('cam-obs', 'OBS Virtual Camera');

describe('pickCameraDevice', () => {
  it('switches to the OBS camera when another camera opened first', () => {
    expect(pickCameraDevice([facetime, obs], 'cam-1')).toBe('cam-obs');
  });

  it('switches to the OBS camera when the opened camera is unknown', () => {
    expect(pickCameraDevice([facetime, obs], undefined)).toBe('cam-obs');
  });

  it('keeps the camera when OBS is already open', () => {
    expect(pickCameraDevice([facetime, obs], 'cam-obs')).toBeNull();
  });

  it('keeps the camera when there is no OBS camera', () => {
    expect(pickCameraDevice([facetime], 'cam-1')).toBeNull();
  });

  it('matches OBS in any case', () => {
    expect(pickCameraDevice([facetime, device('x', 'obs-camera')], 'cam-1')).toBe('x');
  });

  it('ignores audio devices named OBS', () => {
    expect(pickCameraDevice([facetime, device('mic', 'OBS Audio', 'audioinput')], 'cam-1')).toBeNull();
  });
});

describe('videoInputs', () => {
  it('keeps only video inputs, in order', () => {
    expect(videoInputs([device('mic', 'Mic', 'audioinput'), facetime, obs]).map((d) => d.deviceId)).toEqual(['cam-1', 'cam-obs']);
  });
});
