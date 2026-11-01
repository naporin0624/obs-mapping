import { useEffect, useState } from 'react';
import type { ObsClient } from '../obs/client';

const SHOT_WIDTH = 480;
const TICK_MS = 100; // 10 fps

/**
 * Polls one screenshot per distinct source name at 10 fps. A source is skipped for a tick while its
 * previous request is still running; failures keep the last image (and are only logged).
 */
export const useScreenshots = (client: ObsClient, sources: readonly string[], enabled: boolean): Readonly<Record<string, string>> => {
  const [images, setImages] = useState<Readonly<Record<string, string>>>({});
  const key = [...new Set(sources.filter((s) => s !== ''))].toSorted().join('\n');

  useEffect(() => {
    if (!enabled || key === '') return undefined;
    const busy = new Set<string>();
    const names = key.split('\n');
    const grab = async (name: string): Promise<void> => {
      busy.add(name);
      try {
        const data = await client.screenshot(name, SHOT_WIDTH);
        setImages((prev) => ({ ...prev, [name]: data }));
      } catch (e) {
        console.warn(`screenshot failed: ${name}`, e);
      } finally {
        busy.delete(name);
      }
    };
    const timer = setInterval(() => {
      names.filter((n) => !busy.has(n)).forEach((n) => void grab(n));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [client, key, enabled]);

  return images;
};
