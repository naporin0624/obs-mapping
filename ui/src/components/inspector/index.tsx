import { useId, type Dispatch } from 'react';
import { withCrop, type CropKey } from '../../editor/crop';
import type { Action } from '../../editor/reducer';
import type { CornerIndex, Selection } from '../../editor/state';
import { boundsOf, type Bounds } from '../../geometry/rect';
import type { Group, Mapping, Surface } from '../../model/mapping';
import { countSurfacesBySource, surfaceCountLabel } from '../../model/source-usage';
import { isLaidOut } from '../../editor/items';
import { NumField, TextField } from '../field';
import { GroupInspector } from '../group-inspector';
import { SourceSelect } from '../source-select';
import { sectionCls, headingCls, gridCls, hintCls } from './styles.css';

const CROP_FIELDS: readonly { key: CropKey; label: string }[] = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'width', label: 'W' },
  { key: 'height', label: 'H' },
];

type Props = { mapping: Mapping; selection: Selection; inputs: readonly string[]; dispatch: Dispatch<Action> };

type SurfaceProps = { surface: Surface; laidOut: boolean; selection: Selection; inputs: readonly string[]; counts: ReadonlyMap<string, number>; dispatch: Dispatch<Action> };

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

const BoundsFields = ({ surface, laidOut, hintId, dispatch }: FieldProps & { laidOut: boolean; hintId: string }) => {
  const bounds = boundsOf(surface);
  const set = (patch: Partial<Bounds>): void => dispatch({ type: 'setBounds', surfaceId: surface.id, bounds: { ...bounds, ...patch } });
  return (
    <>
      <div className={headingCls}>Bounds</div>
      <div className={gridCls}>
        <NumField label="X" value={bounds.x} onCommit={(x) => set({ x })} disabled={laidOut} describedBy={laidOut ? hintId : undefined} />
        <NumField label="Y" value={bounds.y} onCommit={(y) => set({ y })} disabled={laidOut} describedBy={laidOut ? hintId : undefined} />
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

const SurfaceFields = ({ surface, laidOut, selection, inputs, counts, dispatch }: SurfaceProps) => {
  const id = surface.id;
  const hintId = useId();
  const corner = selection.corner?.surfaceId === id ? selection.corner : null;
  const options = inputs.includes(surface.source) || surface.source === '' ? inputs : [surface.source, ...inputs];
  return (
    <>
      <TextField label="Name" value={surface.name} onCommit={(name) => dispatch({ type: 'patchSurface', surfaceId: id, patch: { name } })} />
      <SourceSelect
        label="Source"
        placeholder="未割当"
        items={options.map((name) => ({ id: name, label: name, detail: surfaceCountLabel(counts.get(name) ?? 0) }))}
        value={surface.source === '' ? null : surface.source}
        onChange={(source) => dispatch({ type: 'patchSurface', surfaceId: id, patch: { source } })}
      />
      {corner === null ? null : <CornerFields surface={surface} index={corner.index} dispatch={dispatch} />}
      {laidOut ? (
        <div id={hintId} className={hintCls}>
          グループが位置を決めています
        </div>
      ) : null}
      <BoundsFields surface={surface} laidOut={laidOut} hintId={hintId} dispatch={dispatch} />
      <CropFields surface={surface} dispatch={dispatch} />
    </>
  );
};

const soleGroup = (mapping: Mapping, selection: Selection): Group | undefined =>
  selection.surfaceIds.length === 0 && selection.groupIds.length === 1 ? mapping.groups.find((g) => g.id === selection.groupIds[0]) : undefined;

const InspectorBody = ({ mapping, selection, inputs, dispatch }: Props) => {
  const group = soleGroup(mapping, selection);
  if (group !== undefined) return <GroupInspector key={group.id} group={group} dispatch={dispatch} />;
  const surface = selection.surfaceIds.length === 1 ? mapping.surfaces.find((s) => s.id === selection.surfaceIds[0]) : undefined;
  if (surface === undefined) return <div className={hintCls}>面を 1 つ選択すると編集できます。</div>;
  return (
    <SurfaceFields key={surface.id} surface={surface} laidOut={isLaidOut(mapping, surface.id)} selection={selection} inputs={inputs} counts={countSurfacesBySource(mapping)} dispatch={dispatch} />
  );
};

/** Properties of the single selected surface or group. */
export const Inspector = (props: Props) => (
  <section className={sectionCls}>
    <div className={headingCls}>Inspector</div>
    <InspectorBody {...props} />
  </section>
);
