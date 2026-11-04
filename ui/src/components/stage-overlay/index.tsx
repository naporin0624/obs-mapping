import { useId } from 'react';
import type { Messages } from '../../i18n/messages';
import { useT } from '../../i18n/use-t';
import type { StageDrag } from '../../editor/use-stage-drag';
import type { CornerIndex, Selection, ShapeEdit } from '../../editor/state';
import { isLaidOut, isTopLevel } from '../../editor/items';
import { clipLine } from '../../geometry/clip';
import { unitToQuad } from '../../geometry/homography';
import { maskOutline } from '../../geometry/mask';
import { pasteboardBounds } from '../../geometry/pasteboard';
import { groupFrame } from '../../layout/frame';
import { quadWarning, type QuadWarning } from '../../geometry/quad';
import type { Mapping, Point, Surface } from '../../model/mapping';
import { StageGroupFrame } from '../stage-group-frame';
import { StageMaskHandles } from '../stage-mask-handles';
import { outlineCls, selectedCls, movableCls, lockedCls, hiddenCls, warnCls, handleCls, handleOnCls, gridLineCls, guideLineCls, warnTextCls } from './styles.css';

const HANDLE_PX = 10;
const MIN_GRID_STAGE_PX = 4;

const warningText = (t: Messages, warning: Exclude<QuadWarning, null>): string => (warning === 'not_convex' ? t.warnNotConvex : t.warnDegenerate);

const points = (s: Surface): string => s.corners.map((p) => `${String(p[0])},${String(p[1])}`).join(' ');

const center = (s: Surface): readonly [number, number] => [s.corners.reduce((a, p) => a + p[0], 0) / 4, s.corners.reduce((a, p) => a + p[1], 0) / 4];

const MASK_SEGMENTS = 64;

const maskPoints = (s: Surface): string | null => {
  if (s.mask === undefined) return null;
  const quad = maskOutline(s.mask, MASK_SEGMENTS).map((p) => unitToQuad(s.corners, p));
  if (quad.some((p) => p === null)) return null;
  return (quad as Point[]).map((p) => `${String(p[0])},${String(p[1])}`).join(' ');
};

type Look = { selected: boolean; locked: boolean; visible: boolean; warning: QuadWarning };

const classOf = ({ selected, locked, visible, warning }: Look): string =>
  [outlineCls, selected ? selectedCls : '', locked ? lockedCls : movableCls, visible ? '' : hiddenCls, warning === null ? '' : warnCls].join(' ');

type SurfaceProps = { surface: Surface; scale: number; drag: StageDrag };
type OutlineProps = SurfaceProps & { selected: boolean; locked: boolean; visible: boolean };

const SurfaceOutline = ({ surface, selected, locked, visible, scale, drag }: OutlineProps) => {
  const t = useT();
  const warning = quadWarning(surface.corners);
  const hit = maskPoints(surface);
  const clipId = useId();
  const [cx, cy] = center(surface);
  return (
    <g>
      {hit === null ? null : (
        <clipPath id={clipId}>
          <polygon points={points(surface)} />
        </clipPath>
      )}
      <polygon
        points={points(surface)}
        className={classOf({ selected, locked, visible, warning })}
        vectorEffect="non-scaling-stroke"
        pointerEvents={hit === null ? undefined : 'none'}
        onPointerDown={hit === null ? (e) => drag.onSurfaceDown(e, surface.id) : undefined}
      />
      {hit === null ? null : (
        <polygon
          points={hit}
          fillRule="evenodd"
          strokeDasharray="2 3"
          clipPath={`url(#${clipId})`}
          className={classOf({ selected, locked, visible, warning: null })}
          vectorEffect="non-scaling-stroke"
          onPointerDown={(e) => drag.onSurfaceDown(e, surface.id)}
        />
      )}
      {warning === null ? null : (
        <text x={cx} y={cy} textAnchor="middle" fontSize={12 / scale} className={warnTextCls}>
          {warningText(t, warning)}
        </text>
      )}
    </g>
  );
};

const Handles = ({ surface, selection, scale, drag }: SurfaceProps & { selection: Selection }) => {
  const size = HANDLE_PX / scale;
  return (
    <g>
      {surface.corners.map((p, i) => {
        const on = selection.corner?.surfaceId === surface.id && selection.corner.index === i;
        return (
          <rect
            key={i}
            data-corner={i}
            x={p[0] - size / 2}
            y={p[1] - size / 2}
            width={size}
            height={size}
            className={`${handleCls} ${on ? handleOnCls : ''}`}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => drag.onCornerDown(e, surface.id, i as CornerIndex)}
          />
        );
      })}
    </g>
  );
};

const Grid = ({ mapping, scale }: { mapping: Mapping; scale: number }) => {
  const { size } = mapping.grid;
  if (size * scale < MIN_GRID_STAGE_PX) return null;
  const { width, height } = mapping.canvas;
  const xs = Array.from({ length: Math.floor(width / size) + 1 }, (_, i) => i * size);
  const ys = Array.from({ length: Math.floor(height / size) + 1 }, (_, i) => i * size);
  return (
    <g pointerEvents="none">
      {xs.map((x) => (
        <line key={`x${String(x)}`} x1={x} y1={0} x2={x} y2={height} className={gridLineCls} vectorEffect="non-scaling-stroke" />
      ))}
      {ys.map((y) => (
        <line key={`y${String(y)}`} x1={0} y1={y} x2={width} y2={y} className={gridLineCls} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
};

const GroupFrames = ({ mapping, selection, scale, drag }: { mapping: Mapping; selection: Selection; scale: number; drag: StageDrag }) => (
  <>
    {selection.groupIds.map((id) => (
      <StageGroupFrame key={id} frame={groupFrame(mapping, id)} movable={isTopLevel(mapping, id)} scale={scale} onPointerDown={(e) => drag.onGroupDown(e, id)} />
    ))}
  </>
);

const Guides = ({ drag, mapping }: { drag: StageDrag; mapping: Mapping }) => (
  <g pointerEvents="none" aria-hidden="true">
    {drag.guides.map((g, i) => {
      const seg = clipLine(g, pasteboardBounds(mapping.canvas));
      return seg === null ? null : (
        <line key={i} data-guide="" x1={seg[0][0]} y1={seg[0][1]} x2={seg[1][0]} y2={seg[1][1]} className={guideLineCls} vectorEffect="non-scaling-stroke" pointerEvents="none" aria-hidden="true" />
      );
    })}
  </g>
);

const Background = ({ mapping, drag }: { mapping: Mapping; drag: StageDrag }) => {
  const b = pasteboardBounds(mapping.canvas);
  return <rect data-background="" x={b.x} y={b.y} width={b.width} height={b.height} fill="transparent" onPointerDown={(e) => drag.onBackgroundDown(e)} />;
};

const MaskHandles = ({ surface, shapeEdit, scale, drag }: SurfaceProps & { shapeEdit: ShapeEdit }) =>
  surface.mask === undefined ? null : (
    <StageMaskHandles
      corners={surface.corners}
      mask={surface.mask}
      vertex={shapeEdit.vertex}
      scale={scale}
      onHandleDown={(e, handle) => drag.onMaskHandleDown(e, surface.id, handle)}
      onEdgeDown={(e, edge) => drag.onMaskEdgeDown(e, surface.id, edge)}
    />
  );

// Corner and mask handles never show together, so a warp drag cannot be mistaken for a mask edit.
const SelectionHandles = ({ surface, selection, shapeEdit, scale, drag }: SurfaceProps & { selection: Selection; shapeEdit: ShapeEdit | null }) =>
  shapeEdit?.surfaceId === surface.id ? (
    <MaskHandles surface={surface} shapeEdit={shapeEdit} scale={scale} drag={drag} />
  ) : (
    <Handles surface={surface} selection={selection} scale={scale} drag={drag} />
  );

type Props = { mapping: Mapping; selection: Selection; shapeEdit: ShapeEdit | null; visibleIds: ReadonlySet<string>; scale: number; drag: StageDrag };

/** SVG layer in canvas px (pasteboard margin included): grid, surface outlines (danger dashed + text for bad quads), group frames, then corner or mask handles. */
export const StageOverlay = ({ mapping, selection, shapeEdit, visibleIds, scale, drag }: Props) => (
  <>
    <Background mapping={mapping} drag={drag} />
    <Grid mapping={mapping} scale={scale} />
    {mapping.surfaces.map((s) => (
      <SurfaceOutline
        key={s.id}
        surface={s}
        selected={selection.surfaceIds.includes(s.id)}
        locked={selection.surfaceIds.includes(s.id) && isLaidOut(mapping, s.id)}
        visible={visibleIds.has(s.id)}
        scale={scale}
        drag={drag}
      />
    ))}
    <GroupFrames mapping={mapping} selection={selection} scale={scale} drag={drag} />
    <Guides drag={drag} mapping={mapping} />
    {mapping.surfaces
      .filter((s) => selection.surfaceIds.includes(s.id))
      .map((s) => (
        <SelectionHandles key={s.id} surface={s} selection={selection} shapeEdit={shapeEdit} scale={scale} drag={drag} />
      ))}
  </>
);
