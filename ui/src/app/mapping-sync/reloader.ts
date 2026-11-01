import type { Mapping } from '../../model/mapping';
import type { ObsClient } from '../../obs/client';
import type { SessionState } from './session-state';

export type ReloaderDeps = {
  client: ObsClient;
  source: string;
  state: SessionState;
  applyLoad: (mapping: Mapping) => void;
  adoptOverlay: (enabled: boolean) => void;
  fail: (message: string) => void;
};

/** GetMapping refreshes; any later invalidate() (edit, offline, close) makes an unanswered one stale. */
export const createReloader = (d: ReloaderDeps) => {
  let token = 0;

  const invalidate = (): void => {
    token = token + 1;
  };

  const fetchPlugin = async () => {
    invalidate();
    const mine = token;
    const r = await d.client.getMapping(d.source);
    return d.state.closed() || mine !== token ? null : r;
  };

  const reload = async (): Promise<void> => {
    const r = await fetchPlugin();
    if (r === null) return;
    if (!r.ok) {
      d.fail(r.error);
      return;
    }
    d.applyLoad(r.mapping);
    d.adoptOverlay(r.overlayEnabled);
  };

  const refreshOverlay = async (): Promise<void> => {
    const r = await fetchPlugin();
    if (r?.ok === true) d.adoptOverlay(r.overlayEnabled);
  };

  return { reload, refreshOverlay, invalidate };
};
