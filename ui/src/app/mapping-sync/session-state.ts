import type { Mapping } from '../../model/mapping';
import type { EditorState } from '../../editor/state';

export type ResyncSnapshot = { editor: EditorState; online: boolean; unsent: Mapping | null };

/** The few mutable facts every part of one source session reads and writes. */
export type SessionState = {
  editor: () => EditorState;
  setEditor: (editor: EditorState) => void;
  online: () => boolean;
  setOnline: (online: boolean) => void;
  closed: () => boolean;
  markClosed: () => void;
  unsent: () => Mapping | null;
  setUnsent: (mapping: Mapping | null) => void;
};

export const createSessionState = (initial: EditorState, online: boolean): SessionState => {
  let editor = initial;
  let isOnline = online;
  let closed = false;
  let unsent: Mapping | null = null;
  return {
    editor: () => editor,
    setEditor: (next) => {
      editor = next;
    },
    online: () => isOnline,
    setOnline: (next) => {
      isOnline = next;
    },
    closed: () => closed,
    markClosed: () => {
      closed = true;
    },
    unsent: () => unsent,
    setUnsent: (next) => {
      unsent = next;
    },
  };
};
