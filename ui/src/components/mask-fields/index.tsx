import { useId, type Dispatch } from 'react';
import { initialMask, maskKind, moveVertex, type MaskKind } from '../../editor/mask-edit';
import type { UiAction } from '../../editor/reducer';
import type { ShapeEdit } from '../../editor/state';
import { maskToPx } from '../../geometry/mask';
import { boundsOf } from '../../geometry/rect';
import type { Messages } from '../../i18n/messages';
import { useT } from '../../i18n/use-t';
import type { EllipseMask, PolygonMask, Surface } from '../../model/mapping';
import { buttonCls } from '../styles.css';
import { NumField } from '../field';
import { headingCls, gridCls } from '../inspector/styles.css';
import { Segmented, type Option } from '../segmented';
import { maskCls } from './styles.css';

type FieldProps = { surface: Surface; dispatch: Dispatch<UiAction> };

const kindsOf = (t: Messages): readonly Option<MaskKind>[] => [
  { value: 'none', label: t.maskNone },
  { value: 'ellipse', label: t.maskEllipse },
  { value: 'polygon', label: t.maskPolygon },
];

const EllipseFields = ({ surface, mask, dispatch }: FieldProps & { mask: EllipseMask }) => {
  const t = useT();
  const bounds = boundsOf(surface);
  const px = maskToPx(mask, bounds) as EllipseMask;
  const set = (patch: Partial<EllipseMask>): void => {
    const next = { ...mask, ...patch };
    if (!(next.width > 0 && next.height > 0 && Number.isFinite(next.width + next.height + next.x + next.y))) return;
    dispatch({ type: 'setMask', surfaceId: surface.id, mask: next });
  };
  return (
    <div role="group" aria-label={t.maskEllipse} className={gridCls}>
      <NumField label="X" value={px.x} onCommit={(x) => set({ x: x / bounds.width })} />
      <NumField label="Y" value={px.y} onCommit={(y) => set({ y: y / bounds.height })} />
      <NumField label="W" value={px.width} onCommit={(width) => set({ width: width / bounds.width })} />
      <NumField label="H" value={px.height} onCommit={(height) => set({ height: height / bounds.height })} />
    </div>
  );
};

const VertexFields = ({ surface, mask, index, dispatch }: FieldProps & { mask: PolygonMask; index: number }) => {
  const t = useT();
  const headingId = useId();
  const bounds = boundsOf(surface);
  const unit = mask.points[index];
  if (unit === undefined) return null;
  const point = [unit[0] * bounds.width, unit[1] * bounds.height] as const;
  const set = (to: readonly [number, number]): void => dispatch({ type: 'setMask', surfaceId: surface.id, mask: moveVertex(mask, index, to) });
  return (
    <>
      <div id={headingId} className={headingCls}>
        {t.maskVertexHeading(index + 1)}
      </div>
      <div role="group" aria-labelledby={headingId} className={gridCls}>
        <NumField label="X" value={point[0]} onCommit={(x) => set([x / bounds.width, unit[1]])} />
        <NumField label="Y" value={point[1]} onCommit={(y) => set([unit[0], y / bounds.height])} />
      </div>
    </>
  );
};

const ShapeValues = ({ surface, shapeEdit, dispatch }: FieldProps & { shapeEdit: ShapeEdit | null }) => {
  const mask = surface.mask;
  if (mask?.type === 'ellipse') return <EllipseFields surface={surface} mask={mask} dispatch={dispatch} />;
  const vertex = shapeEdit?.surfaceId === surface.id ? shapeEdit.vertex : null;
  if (mask?.type === 'polygon' && vertex !== null) return <VertexFields surface={surface} mask={mask} index={vertex} dispatch={dispatch} />;
  return null;
};

const changeKind = (surface: Surface, kind: MaskKind): UiAction => ({ type: 'setMask', surfaceId: surface.id, mask: kind === 'none' ? null : initialMask(kind) });

/** Inspector section for the surface mask: kind, edit toggle and exact values. */
export const MaskFields = ({ surface, shapeEdit, dispatch }: FieldProps & { shapeEdit: ShapeEdit | null }) => {
  const t = useT();
  const editing = shapeEdit?.surfaceId === surface.id;
  return (
    <div className={maskCls}>
      <Segmented legend={t.maskHeading} options={kindsOf(t)} value={maskKind(surface)} onChange={(kind) => dispatch(changeKind(surface, kind))} />
      <button
        type="button"
        className={buttonCls}
        disabled={surface.mask === undefined}
        onClick={() => dispatch(editing ? { type: 'exitShapeEdit' } : { type: 'enterShapeEdit', surfaceId: surface.id })}
      >
        {editing ? t.maskEditDone : t.maskEdit}
      </button>
      <ShapeValues surface={surface} shapeEdit={shapeEdit} dispatch={dispatch} />
    </div>
  );
};
