import type { Mapping } from '../../model/mapping';
import type { ObsClient } from '../../obs/client';
import { createRefCount } from '../ref-count';

export type FeedUpdates = { mapping?: Mapping; overlay?: boolean };

export type PluginFeedDeps = {
  client: ObsClient;
  onMapping: (source: string, mapping: Mapping, overlayEnabled: boolean | undefined) => void;
  onOverlay: (source: string, enabled: boolean) => void;
};

type Stamped<T> = { seq: number; value: T };
type Entry = { seq: number; mapping: Stamped<Mapping> | undefined; overlay: Stamped<boolean> | undefined };

/** Per-source cache of plugin changes (with a sequence) so a late open() can catch up. Idle until watch(). */
export const createPluginFeed = (d: PluginFeedDeps) => {
  const entries = new Map<string, Entry>();

  const record = (source: string, change: FeedUpdates): void => {
    const prev = entries.get(source);
    const seq = (prev?.seq ?? 0) + 1;
    entries.set(source, {
      seq,
      mapping: change.mapping === undefined ? prev?.mapping : { seq, value: change.mapping },
      overlay: change.overlay === undefined ? prev?.overlay : { seq, value: change.overlay },
    });
  };

  const subscribe = (): (() => void) => {
    const offMapping = d.client.onMappingChanged((source, mapping, overlayEnabled) => {
      record(source, overlayEnabled === undefined ? { mapping } : { mapping, overlay: overlayEnabled });
      d.onMapping(source, mapping, overlayEnabled);
    });
    const offOverlay = d.client.onOverlayChanged((source, enabled) => {
      record(source, { overlay: enabled });
      d.onOverlay(source, enabled);
    });
    return () => {
      offMapping();
      offOverlay();
    };
  };

  const watching = createRefCount(subscribe);

  const sequence = (source: string): number => entries.get(source)?.seq ?? 0;

  const since = (source: string, seq: number): FeedUpdates => {
    const entry = entries.get(source);
    return {
      ...(entry?.mapping !== undefined && entry.mapping.seq > seq ? { mapping: entry.mapping.value } : {}),
      ...(entry?.overlay !== undefined && entry.overlay.seq > seq ? { overlay: entry.overlay.value } : {}),
    };
  };

  return { watch: watching.acquire, sequence, since, stop: watching.releaseAll };
};
