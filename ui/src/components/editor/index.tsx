import { useInputs } from '../../editor/use-inputs';
import { useSync } from '../../editor/use-sync';
import type { ObsClient } from '../../obs/client';
import { ImportExport } from '../import-export';
import { Inspector } from '../inspector';
import { Stage } from '../stage';
import { SurfaceList } from '../surface-list';
import { buttonCls } from '../styles.css';
import { Toast } from '../toast';
import { Toolbar } from '../toolbar';
import { bodyCls, stageColCls, sideCls, noteCls } from './styles.css';

type Props = { client: ObsClient; source: string; online: boolean };

/** The editing screen for one Mapping source. */
export const Editor = ({ client, source, online }: Props) => {
  const sync = useSync(client, source, online);
  const { inputs, reload } = useInputs(client, online);
  const { state, dispatch } = sync;

  if (!sync.loaded) {
    return (
      <>
        <div className={noteCls}>
          {sync.loadError !== null ? `読み込みに失敗しました: ${sync.loadError}` : online ? '読み込み中...' : 'OBS に接続すると編集できます。'}
          {sync.loadError !== null && online ? (
            <button type="button" className={buttonCls} onClick={sync.retry}>
              Retry
            </button>
          ) : null}
        </div>
        <Toast toast={sync.toast} onDismiss={sync.dismissToast} />
      </>
    );
  }
  return (
    <>
      <Toolbar
        dispatch={dispatch}
        canUndo={state.past.length > 0 && !state.dragging}
        canRedo={state.future.length > 0 && !state.dragging}
        selectedCount={state.selection.surfaceIds.length}
        gridSize={state.mapping.grid.size}
        overlayEnabled={sync.overlayEnabled}
        onToggleOverlay={() => sync.setOverlayEnabled(!sync.overlayEnabled)}
      >
        <ImportExport mapping={state.mapping} online={online} onApply={sync.applyImport} onError={sync.reportError} />
      </Toolbar>
      <div className={bodyCls}>
        <div className={stageColCls}>
          <Stage state={state} dispatch={dispatch} client={client} online={online} />
        </div>
        <aside className={sideCls}>
          <SurfaceList mapping={state.mapping} selection={state.selection} inputs={inputs} dispatch={dispatch} onReloadInputs={reload} />
          <Inspector mapping={state.mapping} selection={state.selection} inputs={inputs} dispatch={dispatch} />
        </aside>
      </div>
      <Toast toast={sync.toast} onDismiss={sync.dismissToast} />
    </>
  );
};
