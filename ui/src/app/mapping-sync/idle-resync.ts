import type { Mapping } from '../../model/mapping';
import type { EditorState } from '../../editor/state';
import type { ResyncSnapshot } from './session-state';

export type IdleResyncDeps = {
  idleMs: number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  read: () => ResyncSnapshot;
  fetchMapping: () => Promise<Mapping | null>;
  applyRemote: (mapping: Mapping) => void;
};

type InFlight = EditorState['inFlight'];

type IdleDeps = { online: boolean; inFlight: InFlight; mapping: Mapping; dragging: boolean };

const idleDepsOf = ({ editor, online }: ResyncSnapshot): IdleDeps => ({ online, inFlight: editor.inFlight, mapping: editor.mapping, dragging: editor.dragging });

const sameIdleDeps = (a: IdleDeps | null, b: IdleDeps): boolean => a !== null && a.online === b.online && a.inFlight === b.inFlight && a.mapping === b.mapping && a.dragging === b.dragging;

/** Own sends whose echo never came back: after idleMs of quiet, fetch the plugin copy once per stale list. */
export const createIdleResync = (d: IdleResyncDeps) => {
  let timer: unknown = null;
  let token = 0;
  let resynced: InFlight | null = null;
  let last: IdleDeps | null = null;
  let disposed = false;

  const idleDue = (snap: ResyncSnapshot): boolean => snap.online && snap.editor.inFlight.length > 0 && !snap.editor.dragging && resynced !== snap.editor.inFlight;

  const run = async (mine: number, list: InFlight): Promise<void> => {
    if (d.read().unsent !== null) {
      last = null; // not reconciled yet: let the next update() schedule it again
      return;
    }
    resynced = list;
    const mapping = await d.fetchMapping();
    if (!disposed && mine === token && mapping !== null) d.applyRemote(mapping);
  };

  const cancel = (): void => {
    token = token + 1;
    if (timer !== null) d.clearTimer(timer);
    timer = null;
  };

  const reschedule = (): void => {
    cancel();
    const snap = d.read();
    if (!idleDue(snap)) return;
    const mine = token;
    const list = snap.editor.inFlight;
    timer = d.setTimer(() => void run(mine, list), d.idleMs);
  };

  const update = (): void => {
    if (disposed) return;
    const deps = idleDepsOf(d.read());
    if (sameIdleDeps(last, deps)) return;
    last = deps;
    reschedule();
  };

  const dispose = (): void => {
    disposed = true;
    cancel();
  };

  return { update, dispose };
};
