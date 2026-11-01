import { atom } from 'jotai';
import { instancesAtom, type Instances } from './instances';

export type Stream<T> = { readonly value: T } | undefined;

/**
 * Hybrid step 2: `undefined` until mounted, then a fresh `{ value }` per headless event.
 * onMount seeds the current snapshot, subscribes, and resets on unmount; payloads are set directly, never re-fetched.
 */
export const streamAtom = <T>(snapshot: (instances: Instances) => T, subscribe: (instances: Instances, notify: () => void) => () => void) => {
  const latest = atom<Stream<T>>(undefined);
  const stream = atom(
    (get) => get(latest),
    (get, set, _command: 'subscribe') => {
      const instances = get(instancesAtom);
      const push = (): void => set(latest, { value: snapshot(instances) });
      push();
      const off = subscribe(instances, push);
      return (): void => {
        off();
        set(latest, undefined);
      };
    },
  );
  stream.onMount = (setAtom) => setAtom('subscribe');
  return stream;
};
