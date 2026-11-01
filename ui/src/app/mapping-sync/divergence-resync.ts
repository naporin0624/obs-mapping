import type { Mapping } from '../../model/mapping';
import type { ResyncSnapshot } from './session-state';

export type DivergenceResyncDeps = {
  read: () => ResyncSnapshot;
  fetchMapping: () => Promise<Mapping | null>;
  applyRemote: (mapping: Mapping) => void;
};

const settled = ({ editor, online, unsent }: ResyncSnapshot): boolean => online && editor.needsResync && editor.inFlight.length === 0 && !editor.dragging && unsent === null;

/** #2: a foreign change replaced local while own sends were pending; once everything drained, fetch the plugin copy once. */
export const createDivergenceResync = (d: DivergenceResyncDeps) => {
  let resyncing = false;
  let disposed = false;

  const run = async (): Promise<void> => {
    const mapping = await d.fetchMapping();
    resyncing = false;
    if (!disposed && mapping !== null && settled(d.read())) d.applyRemote(mapping);
  };

  const update = (): void => {
    if (disposed || resyncing || !settled(d.read())) return;
    resyncing = true;
    void run();
  };

  return {
    update,
    dispose: (): void => {
      disposed = true;
    },
  };
};
