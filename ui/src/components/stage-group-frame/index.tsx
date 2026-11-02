import type { PointerEvent } from 'react';
import type { Bounds } from '../../geometry/rect';
import { frameCls, movableCls, lockedCls, handleCls } from './styles.css';

const HANDLE_PX = 8;

type Props = {
  frame: Bounds;
  movable: boolean;
  scale: number;
  onPointerDown: (e: PointerEvent<SVGElement>) => void;
};

const corners = (f: Bounds): readonly (readonly [number, number])[] => [
  [f.x, f.y],
  [f.x + f.width, f.y],
  [f.x + f.width, f.y + f.height],
  [f.x, f.y + f.height],
];

/** Dashed outline around a group with four visual-only corner marks; no resizing. */
export const StageGroupFrame = ({ frame, movable, scale, onPointerDown }: Props) => {
  const size = HANDLE_PX / scale;
  return (
    <g>
      <rect
        data-frame=""
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        className={`${frameCls} ${movable ? movableCls : lockedCls}`}
        vectorEffect="non-scaling-stroke"
        onPointerDown={onPointerDown}
      />
      {corners(frame).map(([x, y], i) => (
        <rect key={i} data-handle="" x={x - size / 2} y={y - size / 2} width={size} height={size} className={handleCls} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      ))}
    </g>
  );
};
