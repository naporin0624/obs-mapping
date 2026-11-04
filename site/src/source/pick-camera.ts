const OBS_LABEL = /obs/i;

export const videoInputs = (devices: readonly MediaDeviceInfo[]): MediaDeviceInfo[] => devices.filter((d) => d.kind === 'videoinput');

export const isObsCamera = (device: Pick<MediaDeviceInfo, 'label'>): boolean => OBS_LABEL.test(device.label);

/** The OBS camera to reopen with, or null to keep the camera that opened first. */
export const pickCameraDevice = (devices: readonly MediaDeviceInfo[], activeId: string | undefined): string | null => {
  const obs = videoInputs(devices).find(isObsCamera);
  return obs === undefined || obs.deviceId === activeId ? null : obs.deviceId;
};
