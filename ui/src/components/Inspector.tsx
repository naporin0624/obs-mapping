import type { Dispatch } from 'react';
import { css } from '../../styled-system/css';
import { withCrop, type CropKey } from '../editor/crop';
import type { Action } from '../editor/reducer';
import type { Selection } from '../editor/state';
import { boundsOf } from '../geometry/rect';
import type { Mapping, Surface } from '../model/mapping';
import { NumField, TextField } from './Field';
import { inputCls, labelCls } from './styles';

const sectionCls = css({ display: 'flex', flexDirection: 'column', gap: '2', p: '2' });
const headingCls = css({ fontFamily: 'mono', fontWeight: 700, color: 'fg.muted' });
const gridCls = css({ display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: '1', justifyContent: 'start' });

const CROP_FIELDS: readonly { key: CropKey; label: string }[] = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'width', label: 'W' },
  { key: 'height', label: 'H' },
];

type Props = { mapping: Mapping; selection: Selection; inputs: readonly string[]; dispatch: Dispatch<Action> };

type SurfaceProps = { surface: Surface; selection: Selection; inputs: readonly string[]; dispatch: Dispatch<Action> };

const SurfaceFields = ({ surface, selection, inputs, dispatch }: SurfaceProps) => {
  const id = surface.id;
  const bounds = boundsOf(surface);
  const corner = selection.corner?.surfaceId === id ? selection.corner : null;
  const options = inputs.includes(surface.source) || surface.source === '' ? inputs : [surface.source, ...inputs];
  return (
    <>
      <TextField label="Name" value={surface.name} onCommit={(name) => dispatch({ type: 'patchSurface', surfaceId: id, patch: { name } })} />
      <label className={labelCls}>
        <span>Source</span>
        <select className={`${inputCls} ${css({ flex: 1 })}`} value={surface.source} onChange={(e) => dispatch({ type: 'patchSurface', surfaceId: id, patch: { source: e.target.value } })}>
          {surface.source === '' ? <option value="">未割当</option> : null}
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {corner === null ? null : (
        <>
          <div className={headingCls}>{`Corner ${String(corner.index + 1)}`}</div>
          <div className={gridCls}>
            <NumField
              label="X"
              value={surface.corners[corner.index][0]}
              onCommit={(x) => dispatch({ type: 'setCorner', surfaceId: id, index: corner.index, to: [x, surface.corners[corner.index][1]] })}
            />
            <NumField
              label="Y"
              value={surface.corners[corner.index][1]}
              onCommit={(y) => dispatch({ type: 'setCorner', surfaceId: id, index: corner.index, to: [surface.corners[corner.index][0], y] })}
            />
          </div>
        </>
      )}
      <div className={headingCls}>Bounds</div>
      <div className={gridCls}>
        <NumField label="X" value={bounds.x} onCommit={(x) => dispatch({ type: 'setBounds', surfaceId: id, bounds: { ...bounds, x } })} />
        <NumField label="Y" value={bounds.y} onCommit={(y) => dispatch({ type: 'setBounds', surfaceId: id, bounds: { ...bounds, y } })} />
        <NumField label="W" value={bounds.width} onCommit={(width) => dispatch({ type: 'setBounds', surfaceId: id, bounds: { ...bounds, width } })} />
        <NumField label="H" value={bounds.height} onCommit={(height) => dispatch({ type: 'setBounds', surfaceId: id, bounds: { ...bounds, height } })} />
      </div>
      <div className={headingCls}>Crop</div>
      <div className={gridCls}>
        {CROP_FIELDS.map((f) => (
          <NumField
            key={f.key}
            label={f.label}
            step={0.01}
            value={surface.crop[f.key]}
            onCommit={(v) => dispatch({ type: 'patchSurface', surfaceId: id, patch: { crop: withCrop(surface.crop, f.key, v) } })}
          />
        ))}
      </div>
    </>
  );
};

/** Properties of the single selected surface. */
export const Inspector = ({ mapping, selection, inputs, dispatch }: Props) => {
  const surface = selection.surfaceIds.length === 1 ? mapping.surfaces.find((s) => s.id === selection.surfaceIds[0]) : undefined;
  return (
    <section className={sectionCls}>
      <div className={headingCls}>Inspector</div>
      {surface === undefined ? (
        <div className={css({ color: 'fg.muted' })}>面を 1 つ選択すると編集できます。</div>
      ) : (
        <SurfaceFields key={surface.id} surface={surface} selection={selection} inputs={inputs} dispatch={dispatch} />
      )}
    </section>
  );
};
