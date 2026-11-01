import { atom } from 'jotai';
import type { ConnSettings } from '../../app/obs-session';
import { commandAtom } from '../command';
import { instancesAtom } from '../instances';
import { streamAtom } from '../stream';

const sessionStream = streamAtom(
  (i) => i.session.getState(),
  (i, notify) => i.session.subscribe(notify),
);

/** Stream-only with a default: getState() until the first push. */
export const sessionStateAtom = atom((get) => get(sessionStream)?.value ?? get(instancesAtom).session.getState());

export const connAtom = atom((get) => get(sessionStateAtom).conn);
export const onlineAtom = atom((get) => get(connAtom).kind === 'open');
export const sourcesAtom = atom((get) => get(sessionStateAtom).sources);
export const sourcesErrorAtom = atom((get) => get(sessionStateAtom).sourcesError);
export const inputsAtom = atom((get) => get(sessionStateAtom).inputs);
export const selectedSourceAtom = atom((get) => get(sessionStateAtom).selectedSource);
export const settingsAtom = atom((get) => get(sessionStateAtom).settings);
export const clientAtom = atom((get) => get(instancesAtom).session.client);

export const connectAtom = commandAtom((i, settings: ConnSettings) => i.session.connect(settings));
export const disconnectAtom = commandAtom((i) => i.session.disconnect());
export const selectSourceAtom = commandAtom((i, name: string | null) => i.session.selectSource(name));
export const reloadSourcesAtom = commandAtom((i) => i.session.reloadSources());
export const reloadInputsAtom = commandAtom((i) => i.session.reloadInputs());
