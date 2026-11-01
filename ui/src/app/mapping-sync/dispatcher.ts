import { reducer, type Action } from '../../editor/reducer';
import type { EditorState } from '../../editor/state';
import type { SessionState } from './session-state';

export type DispatcherDeps = {
  state: SessionState;
  onCommit: (prev: EditorState, next: EditorState, action: Action) => void;
  emit: (editor: EditorState) => void;
};

/**
 * Actions run one at a time in arrival order; actions raised while one runs
 * (side effects, subscribers) wait their turn, and the editor is emitted once per settled state.
 */
export const createDispatcher = (d: DispatcherDeps) => {
  let queue: readonly Action[] = [];
  let running = false;
  let emitted: EditorState | null = null;

  const commit = (action: Action): void => {
    const prev = d.state.editor();
    const next = reducer(prev, action);
    if (next === prev) return;
    d.state.setEditor(next);
    d.onCommit(prev, next, action);
  };

  const drain = (): void => {
    while (queue.length > 0 && !d.state.closed()) {
      const [head, ...rest] = queue;
      queue = rest;
      if (head !== undefined) commit(head);
    }
  };

  const emitSettled = (): void => {
    const editor = d.state.editor();
    if (editor === emitted || d.state.closed()) return;
    emitted = editor;
    d.emit(editor);
  };

  const run = (): void => {
    if (running) return;
    running = true;
    try {
      do {
        drain();
        emitSettled();
      } while (queue.length > 0 && !d.state.closed());
    } finally {
      running = false;
      queue = [];
    }
  };

  const dispatch = (action: Action): void => {
    if (d.state.closed()) return;
    queue = [...queue, action];
    run();
  };

  return { dispatch, run };
};
