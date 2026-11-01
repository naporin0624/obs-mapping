import { css } from '../../styled-system/css';
import { useInputs } from '../editor/use-inputs';
import { useSync } from '../editor/use-sync';
import type { ObsClient } from '../obs/client';
import { ImportExport } from './ImportExport';
import { Inspector } from './Inspector';
import { Stage } from './Stage';
import { SurfaceList } from './SurfaceList';
import { buttonCls } from './styles';
import { Toast } from './Toast';
import { Toolbar } from './Toolbar';

const bodyCls = css({ display: 'flex', alignItems: 'flex-start', gap: '2', p: '2', flexWrap: 'wrap' });
const stageColCls = css({ flex: '3 1 480px', minWidth: 0 });
const sideCls = css({ flex: '1 1 260px', minWidth: '240px', borderWidth: 'default', borderStyle: 'solid', borderColor: 'border.subtle' });
const noteCls = css({ p: '3', color: 'fg.muted', display: 'flex', alignItems: 'center', gap: '3' });

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
