import { pickCameraDevice, videoInputs } from './pick-camera';
import { startWebcam, type WebcamFailure, type WebcamResult } from './webcam-source';

export type CameraMedia = Pick<MediaDevices, 'getUserMedia' | 'enumerateDevices'>;

type Opened = Extract<WebcamResult, { kind: 'ok' }>;
export type ObsCameraResult = (Opened & { cameras: MediaDeviceInfo[]; activeId: string | undefined }) | WebcamFailure;

// Labels are empty until permission is granted, so this only runs after a camera opened.
const listCameras = async (media: CameraMedia): Promise<MediaDeviceInfo[]> => {
  try {
    return videoInputs(await media.enumerateDevices());
  } catch {
    return [];
  }
};

/** Opens any camera to get permission, then switches to the OBS virtual camera when it is another one. */
export const openObsCamera = async (media: CameraMedia | undefined): Promise<ObsCameraResult> => {
  if (media === undefined) return { kind: 'unavailable' };
  const first = await startWebcam(media);
  if (first.kind !== 'ok') return first;
  const cameras = await listCameras(media);
  const obsId = pickCameraDevice(cameras, first.source.deviceId());
  if (obsId === null) return { ...first, cameras, activeId: first.source.deviceId() };
  first.source.stop();
  const second = await startWebcam(media, { deviceId: obsId });
  return second.kind === 'ok' ? { ...second, cameras, activeId: obsId } : second;
};
