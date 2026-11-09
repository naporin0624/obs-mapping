import { useEffect, type Dispatch } from 'react';
import { historyAction } from './history-keys';
import type { UiAction } from './reducer';

/** Listens on the whole document so undo / redo work wherever focus is, except in text entry. */
export const useHistoryKeys = (dispatch: Dispatch<UiAction>): void => {
  useEffect(() => {
    // USEEFFECT_JUSTIFICATION: a document-wide keydown listener is a subscription owned by the editor's lifetime.
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return;
      const action = historyAction(e);
      if (action === null) return;
      e.preventDefault();
      dispatch(action);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);
};
