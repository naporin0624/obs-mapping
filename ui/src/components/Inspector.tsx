import type { Dispatch } from 'react';
import { css } from '../../styled-system/css';
import { withCrop, type CropKey } from '../editor/crop';
import type { Action } from '../editor/reducer';
import type { CornerIndex, Selection } from '../editor/state';
import { boundsOf, type Bounds } from '../geometry/rect';
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

type FieldProps = { surface: Surface; dispatch: Dispatch<Action> };

const CornerFields = ({ surface, index, dispatch }: FieldProps & { index: CornerIndex }) => {
  const [cx, cy] = surface.corners[index];
  const set = (to: readonly [number, number]): void => dispatch({ type: 'setCorner', surfaceId: surface.id, index, to });
  return (
    <>
      <div className={headingCls}>{`Corner ${String(index + 1)}`}</div>
      <div className={gridCls}>
        <NumField label="X" value={cx} onCommit={(x) => set([x, cy])} />
        <NumField label="Y" value={cy} onCommit={(y) => set([cx, y])} />
      </div>
    </>
  );
};

const BoundsFields = ({ surface, dispatch }: FieldProps) => {
  const bounds = boundsOf(surface);
  const set = (patch: Partial<Bounds>): void => dispatch({ type: 'setBounds', surfaceId: surface.id, bounds: { ...bounds, ...patch } });
  return (
    <>
      <div className={headingCls}>Bounds</div>
      <div className={gridCls}>
        <NumField label="X" value={bounds.x} onCommit={(x) => set({ x })} />
        <NumField label="Y" value={bounds.y} onCommit={(y) => set({ y })} />
        <NumField label="W" value={bounds.width} onCommit={(width) => set({ width })} />
        <NumField label="H" value={bounds.height} onCommit={(height) => set({ height })} />
      </div>
    </>
  );
};

const CropFields = ({ surface, dispatch }: FieldProps) => (
  <>
    <div className={headingCls}>Crop</div>
    <div className={gridCls}>
      {CROP_FIELDS.map((f) => (
        <NumField
          key={f.key}
          label={f.label}
          step={0.01}
          value={surface.crop[f.key]}
          onCommit={(v) => dispatch({ type: 'patchSurface', surfaceId: surface.id, patch: { crop: withCrop(surface.crop, f.key, v) } })}
        />
      ))}
    </div>
  </>
);

const SurfaceFields = ({ surface, selection, inputs, dispatch }: SurfaceProps) => {
  const id = surface.id;
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
      {corner === null ? null : <CornerFields surface={surface} index={corner.index} dispatch={dispatch} />}
      <BoundsFields surface={surface} dispatch={dispatch} />
      <CropFields surface={surface} dispatch={dispatch} />
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
