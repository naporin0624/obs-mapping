import type { ObsClient, OverlayState } from '../../obs/client';
import { selectedSurfaceIdsDeep } from '../../model/layers';
import type { SessionState } from './session-state';

export type OverlayDeps = {
  client: ObsClient;
  source: string;
  state: SessionState;
  initial: boolean;
  emit: (enabled: boolean) => void;
  fail: (message: string) => void;
};

const overlayOff = (): OverlayState => ({ enabled: false, selectedSurfaceIds: [], selectedCorner: null });

/** The plugin's overlay flag for one source; `owned` marks a flag this dock turned on itself. */
export const createOverlayControl = (d: OverlayDeps) => {
  let enabled = d.initial;
  let owned = false;

  const live = (): boolean => d.state.online() && !d.state.closed();

  const setFlag = (value: boolean): void => {
    if (value === enabled) return;
    enabled = value;
    d.emit(value);
  };

  const selectionState = (): Pick<OverlayState, 'selectedSurfaceIds' | 'selectedCorner'> => {
    const { mapping, selection } = d.state.editor();
    return { selectedSurfaceIds: selectedSurfaceIdsDeep(mapping, selection), selectedCorner: selection.corner };
  };

  const sendSelection = (): void => {
    if (!live()) return;
    void d.client.setOverlay(d.source, selectionState());
  };

  const sendToggle = async (value: boolean): Promise<void> => {
    const r = await d.client.setOverlay(d.source, { enabled: value, ...selectionState() });
    if (r.ok) return;
    owned = false;
    setFlag(!value);
    d.fail(r.error);
  };

  const toggle = (value: boolean): void => {
    if (!live()) return;
    owned = value;
    setFlag(value);
    void sendToggle(value);
  };

  const adopt = (value: boolean): void => {
    owned = owned && value;
    setFlag(value);
  };

  const release = (): void => {
    if (owned) void d.client.setOverlay(d.source, overlayOff());
  };

  return { enabled: (): boolean => enabled, announce: (): void => d.emit(enabled), sendSelection, toggle, adopt, follow: setFlag, release };
};
