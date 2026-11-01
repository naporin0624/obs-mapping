import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent, type RefObject } from 'react';
import { keyAction } from '../../editor/keys';
import type { Action } from '../../editor/reducer';
import type { EditorState } from '../../editor/state';
import { useScreenshots } from '../../editor/use-screenshots';
import { useStageDrag } from '../../editor/use-stage-drag';
import { effectiveVisibleIds } from '../../model/visibility';
import type { ObsClient } from '../../obs/client';
import { StageOverlay } from '../stage-overlay';
import { StageUnderlay } from '../stage-underlay';
import { StageSurface } from '../stage-surface';
import { outerCls, frameCls, layerCls } from './styles.css';

// the focus ring lives on the outer element so the frame's overflow:hidden does not clip it

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

const onStageKey = (e: KeyboardEvent<HTMLElement>, dispatch: Dispatch<Action>): void => {
  const action = keyAction(e);
  if (action === null) return;
  e.preventDefault();
  dispatch(action);
};

/** Live preview of every surface (screenshots warped in the browser) with draggable corner handles on top. */
export const Stage = ({ state, dispatch, client, online }: Props) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const width = useWidth(frameRef);
  const { mapping, selection } = state;
  const scale = Math.max(width, 1) / mapping.canvas.width;
  const visibleIds = useMemo(() => effectiveVisibleIds(mapping), [mapping]);
  const images = useScreenshots(
    client,
    mapping.surfaces.filter((s) => visibleIds.has(s.id)).map((s) => s.source),
    online,
  );
  const drag = useStageDrag({ state, dispatch, svgRef, scale });

  useEffect(() => {
    focusRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className={outerCls}
      tabIndex={0}
      role="application"
      aria-label="Stage"
      ref={focusRef}
      onPointerDown={() => focusRef.current?.focus({ preventScroll: true })}
      onKeyDown={(e) => onStageKey(e, dispatch)}
    >
      <div ref={frameRef} className={frameCls} style={{ aspectRatio: `${String(mapping.canvas.width)} / ${String(mapping.canvas.height)}` }}>
        <StageUnderlay />
        <div className={layerCls}>
          {mapping.surfaces.map((s) => (
            <StageSurface key={s.id} surface={s} image={images[s.source]} scale={scale} visible={visibleIds.has(s.id)} />
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
          <StageOverlay mapping={mapping} selection={selection} visibleIds={visibleIds} scale={scale} drag={drag} />
        </svg>
      </div>
    </div>
  );
};
