import { useId, type PointerEvent as ReactPointerEvent } from 'react';
import { ellipseHandlePoint, type MaskHandle } from '../../editor/mask-drag';
import type { EllipseHandle } from '../../editor/mask-edit';
import { unitToQuad } from '../../geometry/homography';
import { maskOutline } from '../../geometry/mask';
import type { EllipseMask, Mask, Point, PolygonMask, Surface } from '../../model/mapping';
import { bodyCls, edgeCls, handleCls, handleOnCls } from './styles.css';

const HANDLE_PX = 10;
const OUTLINE_SEGMENTS = 64;
const ELLIPSE_HANDLES: readonly EllipseHandle[] = ['left', 'right', 'top', 'bottom'];

type Pointer = ReactPointerEvent<SVGElement>;
type Corners = Surface['corners'];

type Props = {
  corners: Corners;
  mask: Mask;
  vertex: number | null;
  scale: number;
  onHandleDown: (e: Pointer, handle: MaskHandle) => void;
  onEdgeDown: (e: Pointer, edge: number) => void;
};

const toCanvas = (corners: Corners, unit: readonly Point[]): Point[] | null => {
  const mapped = unit.map((p) => unitToQuad(corners, p));
  return mapped.some((p) => p === null) ? null : (mapped as Point[]);
};

const pointsAttr = (ps: readonly Point[]): string => ps.map((p) => `${String(p[0])},${String(p[1])}`).join(' ');

type HandleProps = { at: Point; on: boolean; scale: number; onPointerDown: (e: Pointer) => void } & Record<`data-${string}`, string>;

const Handle = ({ at, on, scale, onPointerDown, ...data }: HandleProps) => (
  <circle {...data} cx={at[0]} cy={at[1]} r={HANDLE_PX / 2 / scale} className={`${handleCls} ${on ? handleOnCls : ''}`} vectorEffect="non-scaling-stroke" onPointerDown={onPointerDown} />
);

const EllipseHandles = ({ corners, mask, scale, onHandleDown }: Omit<Props, 'mask' | 'vertex' | 'onEdgeDown'> & { mask: EllipseMask }) => {
  const at = toCanvas(
    corners,
    ELLIPSE_HANDLES.map((h) => ellipseHandlePoint(mask, h)),
  );
  if (at === null) return null;
  return (
    <>
      {ELLIPSE_HANDLES.map((h, i) => (
        <Handle key={h} data-mask-handle={h} at={at[i] ?? [0, 0]} on={false} scale={scale} onPointerDown={(e) => onHandleDown(e, h)} />
      ))}
    </>
  );
};

// Edge hit lines come first so the vertex handles stay on top of them.
const PolygonHandles = ({ corners, mask, vertex, scale, onHandleDown, onEdgeDown }: Omit<Props, 'mask'> & { mask: PolygonMask }) => {
  const at = toCanvas(corners, mask.points);
  if (at === null) return null;
  return (
    <>
      {at.map((a, i) => {
        const b = at[(i + 1) % at.length] ?? a;
        return <line key={`e${String(i)}`} data-edge={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={edgeCls} vectorEffect="non-scaling-stroke" onPointerDown={(e) => onEdgeDown(e, i)} />;
      })}
      {at.map((p, i) => (
        <Handle key={`v${String(i)}`} data-vertex={String(i)} at={p} on={vertex === i} scale={scale} onPointerDown={(e) => onHandleDown(e, { vertex: i })} />
      ))}
    </>
  );
};

/** Shape-edit handles for one surface's mask, in canvas px: a draggable body plus ellipse edge handles or polygon vertices and edges. */
export const StageMaskHandles = (props: Props) => {
  const { corners, mask, onHandleDown } = props;
  const clipId = useId();
  const outline = toCanvas(corners, maskOutline(mask, OUTLINE_SEGMENTS));
  return (
    <g>
      <clipPath id={clipId}>
        <polygon points={pointsAttr(corners)} />
      </clipPath>
      {outline === null ? null : (
        <polygon data-mask-body="" points={pointsAttr(outline)} fillRule="evenodd" clipPath={`url(#${clipId})`} className={bodyCls} onPointerDown={(e) => onHandleDown(e, 'body')} />
      )}
      {mask.type === 'ellipse' ? <EllipseHandles {...props} mask={mask} /> : <PolygonHandles {...props} mask={mask} />}
    </g>
  );
};
