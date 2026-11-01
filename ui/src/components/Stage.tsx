import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject } from 'react';
import { css } from '../../styled-system/css';
import { keyAction } from '../editor/keys';
import type { Action } from '../editor/reducer';
import type { EditorState } from '../editor/state';
import { useScreenshots } from '../editor/use-screenshots';
import { useStageDrag } from '../editor/use-stage-drag';
import type { ObsClient } from '../obs/client';
import { StageOverlay } from './StageOverlay';
import { StageSurface } from './StageSurface';
import { focusRing } from './styles';

const frameCls = css({
  ...focusRing,
  width: '100%',
  bg: 'bg.canvas',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.default',
  overflow: 'hidden',
  userSelect: 'none',
});
const layerCls = css({ position: 'absolute', inset: 0, width: '100%', height: '100%' });

type Props = { state: EditorState; dispatch: Dispatch<Action>; client: ObsClient; online: boolean };

const useWidth = (ref: RefObject<HTMLDivElement | null>): number => {
  const [width, setWidth] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
};

/** Live preview of every surface (screenshots warped in the browser) with draggable corner handles on top. */
export const Stage = ({ state, dispatch, client, online }: Props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const width = useWidth(frameRef);
  const { mapping, selection } = state;
  const scale = Math.max(width, 1) / mapping.canvas.width;
  const images = useScreenshots(
    client,
    mapping.surfaces.filter((s) => s.visible).map((s) => s.source),
    online,
  );
  const drag = useStageDrag({ state, dispatch, svgRef, scale });

  useEffect(() => {
    frameRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={frameRef}
      className={frameCls}
      style={{ aspectRatio: `${String(mapping.canvas.width)} / ${String(mapping.canvas.height)}` }}
      tabIndex={0}
      role="application"
      aria-label="Stage"
      onPointerDown={() => frameRef.current?.focus({ preventScroll: true })}
      onKeyDown={(e) => {
        const action = keyAction(e);
        if (action === null) return;
        e.preventDefault();
        dispatch(action);
      }}
    >
      <div className={layerCls}>
        {mapping.surfaces.map((s) => (
          <StageSurface key={s.id} surface={s} image={images[s.source]} scale={scale} />
        ))}
      </div>
      <svg
        ref={svgRef}
        className={layerCls}
        viewBox={`0 0 ${String(mapping.canvas.width)} ${String(mapping.canvas.height)}`}
        preserveAspectRatio="none"
        style={{ touchAction: 'none' }}
        onPointerMove={drag.onMove}
        onPointerUp={drag.onUp}
        onPointerCancel={drag.onUp}
      >
        <StageOverlay mapping={mapping} selection={selection} scale={scale} drag={drag} />
      </svg>
    </div>
  );
};
