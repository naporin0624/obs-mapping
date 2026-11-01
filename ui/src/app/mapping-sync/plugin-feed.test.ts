import { describe, expect, it, vi } from 'vitest';
import type { Mapping } from '../../model/mapping';
import type { MappingChangedHandler, ObsClient } from '../../obs/client';
import { createPluginFeed } from './plugin-feed';

const mapping: Mapping = { version: 1, canvas: { width: 1920, height: 1080 }, grid: { size: 10 }, surfaces: [] };

const feedWith = () => {
  let fire: MappingChangedHandler = () => undefined;
  const client = {
    onMappingChanged: (cb: MappingChangedHandler) => {
      fire = cb;
      return () => undefined;
    },
    onOverlayChanged: () => () => undefined,
  } as unknown as ObsClient;
  const onMapping = vi.fn();
  const feed = createPluginFeed({ client, onMapping, onOverlay: vi.fn() });
  feed.watch();
  return { feed, onMapping, fire: (id: string | null) => fire('Map', mapping, undefined, id) };
};

describe('plugin feed', () => {
  it('forwards the requestId of a MappingChanged to onMapping', () => {
    const f = feedWith();
    f.fire('n1-4');
    f.fire(null);
    expect(f.onMapping.mock.calls).toEqual([
      ['Map', mapping, undefined, 'n1-4'],
      ['Map', mapping, undefined, null],
    ]);
  });

  it('still records the mapping for a late open()', () => {
    const f = feedWith();
    f.fire('n1-4');
    expect(f.feed.since('Map', 0)).toEqual({ mapping });
  });
});
