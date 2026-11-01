import { useState, type Dispatch } from 'react';
import type { Action } from '../../editor/reducer';
import type { Selection } from '../../editor/state';
import type { Mapping } from '../../model/mapping';
import { countSurfacesBySource, surfaceCountLabel } from '../../model/source-usage';
import { SourceSelect } from '../source-select';
import { buttonCls, buttonSolidCls, rowCls } from '../styles.css';
import { sectionCls, headingCls, listCls, itemCls, nameCls, subCls, hintCls, growCls } from './styles.css';

type Props = {
  mapping: Mapping;
  selection: Selection;
  inputs: readonly string[];
  dispatch: Dispatch<Action>;
  onReloadInputs: () => void;
};

const nextSelection = (current: Selection, id: string, additive: boolean): Selection => ({
  surfaceIds: additive ? (current.surfaceIds.includes(id) ? current.surfaceIds.filter((x) => x !== id) : [...current.surfaceIds, id]) : [id],
  corner: null,
});

type RowProps = {
  surface: Mapping['surfaces'][number];
  index: number;
  selected: boolean;
  over: boolean;
  onSelect: (additive: boolean) => void;
  dispatch: Dispatch<Action>;
  drag: { id: string | null; setId: (id: string | null) => void; setOver: (id: string | null) => void };
};

const SurfaceRow = ({ surface: s, index, selected, over, onSelect, dispatch, drag }: RowProps) => (
  <li
    role="option"
    aria-selected={selected}
    data-over={over}
    className={itemCls}
    draggable
    onClick={(e) => onSelect(e.shiftKey || e.metaKey)}
    onDragStart={() => drag.setId(s.id)}
    onDragOver={(e) => {
      e.preventDefault();
      drag.setOver(s.id);
    }}
    onDrop={() => {
      if (drag.id !== null && drag.id !== s.id) dispatch({ type: 'reorder', surfaceId: drag.id, toIndex: index });
      drag.setId(null);
      drag.setOver(null);
    }}
    onDragEnd={() => {
      drag.setId(null);
      drag.setOver(null);
    }}
  >
    <button
      type="button"
      className={buttonCls}
      aria-pressed={s.visible}
      aria-label={s.visible ? 'Hide' : 'Show'}
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: 'patchSurface', surfaceId: s.id, patch: { visible: !s.visible } });
      }}
    >
      {s.visible ? 'On' : 'Off'}
    </button>
    <span className={nameCls}>{s.name}</span>
    <span className={subCls}>{s.source === '' ? '未割当' : s.source}</span>
  </li>
);

/** Surfaces: select (Shift = multi), drag to reorder, toggle visibility, add from an OBS input. */
export const SurfaceList = ({ mapping, selection, inputs, dispatch, onReloadInputs }: Props) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pick, setPick] = useState('');
  const chosen = inputs.includes(pick) ? pick : (inputs[0] ?? '');
  const counts = countSurfacesBySource(mapping);
  const drag = { id: dragId, setId: setDragId, setOver: setOverId };

  return (
    <section className={sectionCls}>
      <div className={headingCls}>Surfaces</div>
      <ul className={listCls} role="listbox" aria-multiselectable="true" aria-label="Surfaces">
        {mapping.surfaces.map((s, index) => (
          <SurfaceRow
            key={s.id}
            surface={s}
            index={index}
            selected={selection.surfaceIds.includes(s.id)}
            over={overId === s.id && dragId !== s.id}
            onSelect={(additive) => dispatch({ type: 'select', selection: nextSelection(selection, s.id, additive) })}
            dispatch={dispatch}
            drag={drag}
          />
        ))}
      </ul>
      {mapping.surfaces.length === 0 ? <div className={hintCls}>面がありません。ソースを選んで追加してください。</div> : null}
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
        <button type="button" className={buttonSolidCls} disabled={chosen === ''} onClick={() => dispatch({ type: 'addSurface', source: chosen })}>
          Add
        </button>
        <button type="button" className={buttonCls} disabled={selection.surfaceIds.length === 0} onClick={() => dispatch({ type: 'removeSelected' })}>
          Delete
        </button>
      </div>
    </section>
  );
};
