import type { StageDrag } from '../../editor/use-stage-drag';
import type { CornerIndex, Selection } from '../../editor/state';
import { quadWarning, type QuadWarning } from '../../geometry/quad';
import type { Mapping, Surface } from '../../model/mapping';
import { outlineCls, selectedCls, hiddenCls, warnCls, handleCls, handleOnCls, gridLineCls, warnTextCls } from './styles.css';

const HANDLE_PX = 10;
const MIN_GRID_STAGE_PX = 4;

const WARNING_TEXT: Record<Exclude<QuadWarning, null>, string> = { not_convex: 'NOT CONVEX', degenerate: 'DEGENERATE' };

const points = (s: Surface): string => s.corners.map((p) => `${String(p[0])},${String(p[1])}`).join(' ');

const center = (s: Surface): readonly [number, number] => [s.corners.reduce((a, p) => a + p[0], 0) / 4, s.corners.reduce((a, p) => a + p[1], 0) / 4];

const classOf = (s: Surface, selected: boolean, warning: QuadWarning): string => [outlineCls, selected ? selectedCls : '', s.visible ? '' : hiddenCls, warning === null ? '' : warnCls].join(' ');

type SurfaceProps = { surface: Surface; scale: number; drag: StageDrag };

const SurfaceOutline = ({ surface, selected, scale, drag }: SurfaceProps & { selected: boolean }) => {
  const warning = quadWarning(surface.corners);
  const [cx, cy] = center(surface);
  return (
    <g>
      <polygon points={points(surface)} className={classOf(surface, selected, warning)} vectorEffect="non-scaling-stroke" onPointerDown={(e) => drag.onSurfaceDown(e, surface.id)} />
      {warning === null ? null : (
        <text x={cx} y={cy} textAnchor="middle" fontSize={12 / scale} className={warnTextCls}>
          {WARNING_TEXT[warning]}
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

type Props = { mapping: Mapping; selection: Selection; scale: number; drag: StageDrag };

/** SVG layer in canvas px: grid, surface outlines (danger dashed + text for bad quads), then corner handles. */
export const StageOverlay = ({ mapping, selection, scale, drag }: Props) => (
  <>
    <rect x={0} y={0} width={mapping.canvas.width} height={mapping.canvas.height} fill="transparent" onPointerDown={() => drag.onBackgroundDown()} />
    <Grid mapping={mapping} scale={scale} />
    {mapping.surfaces.map((s) => (
      <SurfaceOutline key={s.id} surface={s} selected={selection.surfaceIds.includes(s.id)} scale={scale} drag={drag} />
    ))}
    {mapping.surfaces
      .filter((s) => selection.surfaceIds.includes(s.id))
      .map((s) => (
        <Handles key={s.id} surface={s} selection={selection} scale={scale} drag={drag} />
      ))}
  </>
);
