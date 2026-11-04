import { useId, type Dispatch } from 'react';
import { withCrop, type CropKey } from '../../editor/crop';
import type { UiAction } from '../../editor/reducer';
import type { CornerIndex, Selection, ShapeEdit } from '../../editor/state';
import { boundsOf, type Bounds } from '../../geometry/rect';
import type { Group, Mapping, Surface } from '../../model/mapping';
import { useT } from '../../i18n/use-t';
import { countSurfacesBySource } from '../../model/source-usage';
import { isLaidOut } from '../../editor/items';
import { bulkTargets, isBulkSelection } from '../../editor/bulk-source';
import { BulkSourceFields } from '../bulk-source-fields';
import { NumField, TextField } from '../field';
import { GroupInspector } from '../group-inspector';
import { MaskFields } from '../mask-fields';
import { SourceSelect } from '../source-select';
import { sectionCls, headingCls, gridCls, hintCls } from './styles.css';

const CROP_FIELDS: readonly { key: CropKey; label: string }[] = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'width', label: 'W' },
  { key: 'height', label: 'H' },
];

type Props = { mapping: Mapping; selection: Selection; shapeEdit: ShapeEdit | null; inputs: readonly string[]; dispatch: Dispatch<UiAction> };

type SurfaceProps = {
  surface: Surface;
  laidOut: boolean;
  selection: Selection;
  shapeEdit: ShapeEdit | null;
  inputs: readonly string[];
  counts: ReadonlyMap<string, number>;
  dispatch: Dispatch<UiAction>;
};

type FieldProps = { surface: Surface; dispatch: Dispatch<UiAction> };

const CornerFields = ({ surface, index, dispatch }: FieldProps & { index: CornerIndex }) => {
  const t = useT();
  const headingId = useId();
  const [cx, cy] = surface.corners[index];
  const set = (to: readonly [number, number]): void => dispatch({ type: 'setCorner', surfaceId: surface.id, index, to });
  return (
    <>
      <div id={headingId} className={headingCls}>
        {t.cornerHeading(index + 1)}
      </div>
      <div role="group" aria-labelledby={headingId} className={gridCls}>
        <NumField label="X" value={cx} onCommit={(x) => set([x, cy])} />
        <NumField label="Y" value={cy} onCommit={(y) => set([cx, y])} />
      </div>
    </>
  );
};

const BoundsFields = ({ surface, laidOut, hintId, dispatch }: FieldProps & { laidOut: boolean; hintId: string }) => {
  const t = useT();
  const headingId = useId();
  const bounds = boundsOf(surface);
  const set = (patch: Partial<Bounds>): void => dispatch({ type: 'setBounds', surfaceId: surface.id, bounds: { ...bounds, ...patch } });
  return (
    <>
      <div id={headingId} className={headingCls}>
        {t.boundsHeading}
      </div>
      <div role="group" aria-labelledby={headingId} className={gridCls}>
        <NumField label="X" value={bounds.x} onCommit={(x) => set({ x })} disabled={laidOut} describedBy={laidOut ? hintId : undefined} />
        <NumField label="Y" value={bounds.y} onCommit={(y) => set({ y })} disabled={laidOut} describedBy={laidOut ? hintId : undefined} />
        <NumField label="W" value={bounds.width} onCommit={(width) => set({ width })} />
        <NumField label="H" value={bounds.height} onCommit={(height) => set({ height })} />
      </div>
    </>
  );
};

const CropFields = ({ surface, dispatch }: FieldProps) => {
  const t = useT();
  const headingId = useId();
  return (
    <>
      <div id={headingId} className={headingCls}>
        {t.cropHeading}
      </div>
      <div role="group" aria-labelledby={headingId} className={gridCls}>
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
};

const SurfaceFields = ({ surface, laidOut, selection, shapeEdit, inputs, counts, dispatch }: SurfaceProps) => {
  const t = useT();
  const id = surface.id;
  const hintId = useId();
  const corner = selection.corner?.surfaceId === id ? selection.corner : null;
  const options = inputs.includes(surface.source) || surface.source === '' ? inputs : [surface.source, ...inputs];
  return (
    <>
      <TextField label={t.name} value={surface.name} onCommit={(name) => dispatch({ type: 'patchSurface', surfaceId: id, patch: { name } })} />
      <SourceSelect
        label={t.source}
        placeholder={t.unassigned}
        items={options.map((name) => ({ id: name, label: name, detail: t.surfaceCount(counts.get(name) ?? 0) }))}
        value={surface.source === '' ? null : surface.source}
        onChange={(source) => dispatch({ type: 'patchSurface', surfaceId: id, patch: { source } })}
      />
      {corner === null ? null : <CornerFields surface={surface} index={corner.index} dispatch={dispatch} />}
      {laidOut ? (
        <div id={hintId} className={hintCls}>
          {t.laidOutHint}
        </div>
      ) : null}
      <BoundsFields surface={surface} laidOut={laidOut} hintId={hintId} dispatch={dispatch} />
      <CropFields surface={surface} dispatch={dispatch} />
      <MaskFields surface={surface} shapeEdit={shapeEdit} dispatch={dispatch} />
    </>
  );
};

const soleGroup = (mapping: Mapping, selection: Selection): Group | undefined =>
  selection.surfaceIds.length === 0 && selection.groupIds.length === 1 ? mapping.groups.find((g) => g.id === selection.groupIds[0]) : undefined;

const InspectorBody = ({ mapping, selection, shapeEdit, inputs, dispatch }: Props) => {
  const t = useT();
  const group = soleGroup(mapping, selection);
  if (group !== undefined) return <GroupInspector key={group.id} group={group} dispatch={dispatch} />;
  if (isBulkSelection(selection)) return <BulkSourceFields targets={bulkTargets(mapping, selection)} inputs={inputs} counts={countSurfacesBySource(mapping)} dispatch={dispatch} />;
  const surface = selection.surfaceIds.length === 1 ? mapping.surfaces.find((s) => s.id === selection.surfaceIds[0]) : undefined;
  if (surface === undefined) return <div className={hintCls}>{t.inspectorEmpty}</div>;
  return (
    <SurfaceFields
      key={surface.id}
      surface={surface}
      laidOut={isLaidOut(mapping, surface.id)}
      selection={selection}
      shapeEdit={shapeEdit}
      inputs={inputs}
      counts={countSurfacesBySource(mapping)}
      dispatch={dispatch}
    />
  );
};

/** Properties of the single selected surface or group, or the shared source of several. */
export const Inspector = (props: Props) => {
  const t = useT();
  return (
    <section className={sectionCls}>
      <div className={headingCls}>{t.inspectorHeading}</div>
      <InspectorBody {...props} />
    </section>
  );
};
