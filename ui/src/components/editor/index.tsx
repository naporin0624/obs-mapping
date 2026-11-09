import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { activateMappingAtom, dispatchAtom, groupSelectionAtom, hasLiveEditorAtom, importAtom, mappingViewAtom, overlayEnabledAtom, setOverlayAtom } from '../../atoms/mapping';
import { clientAtom, inputsAtom, onlineAtom, reloadInputsAtom } from '../../atoms/session';
import { reportErrorAtom } from '../../atoms/toast';
import { useT } from '../../i18n/use-t';
import { movableItems } from '../../editor/items';
import type { EditorState } from '../../editor/state';
import { tileTarget } from '../../editor/tile-group';
import { useHistoryKeys } from '../../editor/use-history-keys';
import { ImportExport } from '../import-export';
import { Inspector } from '../inspector';
import { Stage } from '../stage';
import { SurfaceList } from '../surface-list';
import { Toolbar } from '../toolbar';
import { UnderlayControls } from '../underlay-controls';
import { LoadBoundary } from './load-boundary';
import { bodyCls, stageColCls, sideCls, noteCls } from './styles.css';

const useEditorCommands = () => ({
  dispatch: useSetAtom(dispatchAtom),
  setOverlay: useSetAtom(setOverlayAtom),
  applyImport: useSetAtom(importAtom),
  group: useSetAtom(groupSelectionAtom),
  reloadInputs: useSetAtom(reloadInputsAtom),
  reportError: useSetAtom(reportErrorAtom),
});

const selectionCounts = ({ mapping, selection }: EditorState) => ({
  movable: movableItems(mapping, selection).length,
  selected: selection.surfaceIds.length + selection.groupIds.length,
});

const EditorBody = () => {
  const t = useT();
  const view = useAtomValue(mappingViewAtom);
  const online = useAtomValue(onlineAtom);
  const overlayEnabled = useAtomValue(overlayEnabledAtom);
  const inputs = useAtomValue(inputsAtom);
  const client = useAtomValue(clientAtom);
  const activate = useSetAtom(activateMappingAtom);
  const { dispatch, group, setOverlay, applyImport, reloadInputs, reportError } = useEditorCommands();
  const source = view?.source;
  useHistoryKeys(dispatch);

  useEffect(() => {
    // USEEFFECT_JUSTIFICATION: opening the loaded source is a command, so it must not run in a getter.
    void activate();
  }, [activate, source]);

  if (view === null) return null;
  const { editor } = view;
  const { movable: movableCount, selected: selectedCount } = selectionCounts(editor);
  return (
    <>
      <Toolbar
        dispatch={dispatch}
        canUndo={editor.past.length > 0 && !editor.dragging}
        canRedo={editor.future.length > 0 && !editor.dragging}
        selectedCount={movableCount}
        immovableReason={movableCount === 0 && selectedCount > 0 ? t.editorImmovable : null}
        tile={tileTarget(editor.mapping, editor.selection)}
        canvas={editor.mapping.canvas}
        canGroup={selectedCount > 0}
        canUngroup={editor.selection.groupIds.length > 0}
        onGroup={group}
        gridSize={editor.mapping.grid.size}
        overlayEnabled={overlayEnabled}
        onToggleOverlay={() => setOverlay(!overlayEnabled)}
        fileActions={<ImportExport mapping={editor.mapping} online={online} onApply={applyImport} onError={reportError} />}
      >
        <UnderlayControls />
      </Toolbar>
      <div className={bodyCls}>
        <div className={stageColCls}>
          <Stage state={editor} dispatch={dispatch} client={client} online={online} />
        </div>
        <aside className={sideCls}>
          <SurfaceList mapping={editor.mapping} selection={editor.selection} inputs={inputs} dispatch={dispatch} onReloadInputs={() => void reloadInputs()} />
          <Inspector mapping={editor.mapping} selection={editor.selection} shapeEdit={editor.shapeEdit} inputs={inputs} dispatch={dispatch} />
        </aside>
      </div>
    </>
  );
};

/** The editing screen for the selected Mapping source. */
export const Editor = () => {
  const t = useT();
  const online = useAtomValue(onlineAtom);
  const live = useAtomValue(hasLiveEditorAtom);
  if (!online && !live) return <div className={noteCls}>{t.editorOffline}</div>;
  return (
    <LoadBoundary>
      <EditorBody />
    </LoadBoundary>
  );
};
