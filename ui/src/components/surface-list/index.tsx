import { useState, type Dispatch } from 'react';
import type { Action } from '../../editor/reducer';
import type { Selection } from '../../editor/state';
import type { Mapping } from '../../model/mapping';
import { countSurfacesBySource, surfaceCountLabel } from '../../model/source-usage';
import { PlusIcon, TrashIcon } from '../icons';
import { LayerTree } from '../layer-tree';
import { SourceSelect } from '../source-select';
import { buttonCls, buttonSolidCls, rowCls } from '../styles.css';
import { sectionCls, headingCls, hintCls, growCls } from './styles.css';

type Props = {
  mapping: Mapping;
  selection: Selection;
  inputs: readonly string[];
  dispatch: Dispatch<Action>;
  onReloadInputs: () => void;
};

/** Layer tree plus add / delete controls for surfaces and groups. */
export const SurfaceList = ({ mapping, selection, inputs, dispatch, onReloadInputs }: Props) => {
  const [pick, setPick] = useState('');
  const chosen = inputs.includes(pick) ? pick : (inputs[0] ?? '');
  const counts = countSurfacesBySource(mapping);

  return (
    <section className={sectionCls}>
      <div className={headingCls}>レイヤー</div>
      <LayerTree mapping={mapping} selection={selection} dispatch={dispatch} />
      {mapping.surfaces.length === 0 && mapping.groups.length === 0 ? <div className={hintCls}>面がありません。ソースを選んで追加してください。</div> : null}
      <div className={rowCls}>
        <SourceSelect
          className={growCls}
          ariaLabel="Source"
          placeholder="No inputs"
          items={inputs.map((name) => ({ id: name, label: name, detail: surfaceCountLabel(counts.get(name) ?? 0) }))}
          value={chosen === '' ? null : chosen}
          isDisabled={inputs.length === 0}
          onChange={setPick}
          onOpenChange={(open) => {
            if (open) onReloadInputs();
          }}
        />
        <button type="button" className={buttonSolidCls} aria-label="追加" title="追加" disabled={chosen === ''} onClick={() => dispatch({ type: 'addSurface', source: chosen })}>
          <PlusIcon />
        </button>
        <button
          type="button"
          className={buttonCls}
          aria-label="削除"
          title="削除"
          disabled={selection.surfaceIds.length === 0 && selection.groupIds.length === 0}
          onClick={() => dispatch({ type: 'removeSelected' })}
        >
          <TrashIcon />
        </button>
      </div>
    </section>
  );
};
