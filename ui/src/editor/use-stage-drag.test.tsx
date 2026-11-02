// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import type { Mapping } from '../model/mapping';
import { reducer, type Action } from './reducer';
import { emptySelection, initialEditorState, type Selection } from './state';
import { useStageDrag } from './use-stage-drag';

type Pointer = ReactPointerEvent<SVGElement>;

// The svg spans the 1920x1080 canvas plus a 240px pasteboard; this rect makes client px equal canvas px.
const PASTEBOARD_RECT = { left: -240, top: -240, width: 2400, height: 1560 };

const svg = (rect = PASTEBOARD_RECT): SVGSVGElement =>
  ({
    getBoundingClientRect: () => rect,
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => false,
    releasePointerCapture: vi.fn(),
  }) as unknown as SVGSVGElement;

const pointer = (x: number, y: number, altKey = false, mods: { shiftKey?: boolean; metaKey?: boolean } = {}): Pointer =>
  ({ clientX: x, clientY: y, altKey, pointerId: 1, shiftKey: false, metaKey: false, ...mods, stopPropagation: vi.fn() }) as unknown as Pointer;

const setup = () => {
  const surfaces = [surf('a', 0, 0, 100, 100), surf('b', 1000, 300, 100, 50)];
  const state = initialEditorState({ ...mapOf(...surfaces), grid: { size: 1000 } });
  const ref: RefObject<SVGSVGElement | null> = { current: svg() };
  return renderHook(() => useStageDrag({ state, dispatch: vi.fn(), svgRef: ref, scale: 1 }));
};

const topLine = { origin: [0, 0], dir: [1, 0] };

describe('useStageDrag guides', () => {
  it('exposes the guide of a line snap during a corner drag and clears it on release', () => {
    const { result } = setup();
    act(() => result.current.onCornerDown(pointer(1000, 300), 'b', 0));
    act(() => result.current.onMove(pointer(1500, 3)));
    expect(result.current.guides).toEqual([topLine]);
    act(() => result.current.onUp(pointer(1500, 3)));
    expect(result.current.guides).toEqual([]);
  });
  it('shows no guide while Option is held', () => {
    const { result } = setup();
    act(() => result.current.onCornerDown(pointer(1000, 300), 'b', 0));
    act(() => result.current.onMove(pointer(1500, 3, true)));
    expect(result.current.guides).toEqual([]);
  });
  it('exposes the guide while a whole surface is dragged', () => {
    const { result } = setup();
    act(() => result.current.onSurfaceDown(pointer(1050, 350), 'b'));
    act(() => result.current.onMove(pointer(1050, 53)));
    expect(result.current.guides).toEqual([topLine]);
  });
});

const grouped = (): Mapping => ({
  ...mapOf(surf('s1', 0, 0, 100, 100), surf('s2', 200, 0, 100, 100), surf('s3', 500, 0, 100, 100)),
  groups: [groupOf('g1')],
  layers: [gn('g1', sn('s1'), sn('s2')), sn('s3')],
});

const withSelection = (selection: Selection) => {
  const dispatch = vi.fn();
  const state = { ...initialEditorState(grouped()), selection };
  const ref: RefObject<SVGSVGElement | null> = { current: svg() };
  const hook = renderHook(() => useStageDrag({ state, dispatch, svgRef: ref, scale: 1 }));
  return { hook, dispatch };
};

const selected = (dispatch: ReturnType<typeof vi.fn>): unknown => dispatch.mock.calls.map((c) => c[0] as { type: string }).find((a) => a.type === 'select');
const types = (dispatch: ReturnType<typeof vi.fn>): string[] => dispatch.mock.calls.map((c) => (c[0] as { type: string }).type);
const only = (surfaceIds: string[], groupIds: string[] = []): unknown => ({ type: 'select', selection: { surfaceIds, groupIds, corner: null } });

describe('useStageDrag pasteboard mapping', () => {
  it('maps the top-left of the svg to the outer corner of the pasteboard', () => {
    const dispatch = vi.fn();
    const ref: RefObject<SVGSVGElement | null> = { current: svg({ left: 10, top: 20, width: 600, height: 390 }) };
    const { result } = renderHook(() => useStageDrag({ state: initialEditorState(mapOf(surf('a', 0, 0, 100, 100))), dispatch, svgRef: ref, scale: 0.25 }));
    act(() => result.current.onCornerDown(pointer(10, 20), 'a', 0));
    act(() => result.current.onMove(pointer(10, 20, true)));
    expect(dispatch).toHaveBeenCalledWith({ type: 'dragCorner', surfaceId: 'a', index: 0, to: [-240, -240] });
  });
  it('maps the bottom-right of the svg to the far pasteboard corner', () => {
    const dispatch = vi.fn();
    const ref: RefObject<SVGSVGElement | null> = { current: svg({ left: 10, top: 20, width: 600, height: 390 }) };
    const { result } = renderHook(() => useStageDrag({ state: initialEditorState(mapOf(surf('a', 0, 0, 100, 100))), dispatch, svgRef: ref, scale: 0.25 }));
    act(() => result.current.onCornerDown(pointer(10, 20), 'a', 2));
    act(() => result.current.onMove(pointer(610, 410, true)));
    expect(dispatch).toHaveBeenCalledWith({ type: 'dragCorner', surfaceId: 'a', index: 2, to: [2160, 1320] });
  });
});

describe('useStageDrag selection', () => {
  it('selects the outermost group and starts a drag when an unselected grouped surface is pressed', () => {
    const { hook, dispatch } = withSelection(emptySelection());
    act(() => hook.result.current.onSurfaceDown(pointer(50, 50), 's1'));
    expect(selected(dispatch)).toEqual(only([], ['g1']));
    expect(types(dispatch)).toContain('dragStart');
  });
  it('replaces the selection with the deepest surface on Cmd+click', () => {
    const { hook, dispatch } = withSelection({ ...emptySelection(), surfaceIds: ['s3'] });
    act(() => hook.result.current.onSurfaceDown(pointer(50, 50, false, { metaKey: true }), 's1'));
    expect(selected(dispatch)).toEqual(only(['s1']));
  });
  it('adds to the selection on Shift+click', () => {
    const { hook, dispatch } = withSelection({ ...emptySelection(), surfaceIds: ['s3'] });
    act(() => hook.result.current.onSurfaceDown(pointer(50, 50, false, { shiftKey: true }), 's1'));
    expect(selected(dispatch)).toEqual(only(['s3'], ['g1']));
  });
  it('does not start a drag when a selected laid-out surface is pressed', () => {
    const { hook, dispatch } = withSelection({ ...emptySelection(), surfaceIds: ['s1'] });
    act(() => hook.result.current.onSurfaceDown(pointer(50, 50), 's1'));
    expect(types(dispatch)).not.toContain('dragStart');
  });
  it('drills into the surface under the pointer on double click', () => {
    const { hook, dispatch } = withSelection({ ...emptySelection(), groupIds: ['g1'] });
    act(() => hook.result.current.onDoubleClick(pointer(50, 50) as never));
    expect(selected(dispatch)).toEqual(only(['s1']));
  });
});

describe('useStageDrag group frame presses', () => {
  const inFrame = { ...emptySelection(), groupIds: ['g1'] };
  it('selects the deepest surface under the pointer on Cmd+press inside the frame', () => {
    const { hook, dispatch } = withSelection(inFrame);
    act(() => hook.result.current.onGroupDown(pointer(50, 50, false, { metaKey: true }), 'g1'));
    expect(selected(dispatch)).toEqual(only(['s1']));
    expect(types(dispatch)).not.toContain('dragStart');
  });
  it('toggles the clickTarget of the surface under the pointer on Shift+press inside the frame', () => {
    const { hook, dispatch } = withSelection(inFrame);
    act(() => hook.result.current.onGroupDown(pointer(50, 50, false, { shiftKey: true }), 'g1'));
    expect(selected(dispatch)).toEqual(only([], []));
  });
  it('keeps the group and starts a drag on an unmodified press', () => {
    const { hook, dispatch } = withSelection(inFrame);
    act(() => hook.result.current.onGroupDown(pointer(50, 50), 'g1'));
    expect(selected(dispatch)).toBeUndefined();
    expect(types(dispatch)).toContain('dragStart');
  });
  it('replaces a multi-selection on Cmd+click of a node already inside it', () => {
    const { hook, dispatch } = withSelection({ ...emptySelection(), surfaceIds: ['s1', 's3'] });
    act(() => hook.result.current.onSurfaceDown(pointer(50, 50, false, { metaKey: true }), 's1'));
    expect(selected(dispatch)).toEqual(only(['s1']));
  });
});

const twoGroups = (): Mapping => ({
  ...mapOf(surf('s1', 0, 0, 100, 100), surf('s2', 200, 0, 100, 100), surf('s3', 500, 0, 100, 100), surf('s4', 900, 300, 100, 100)),
  grid: { size: 10 },
  groups: [groupOf('g1'), groupOf('g2', { origin: [900, 300] })],
  layers: [gn('g1', sn('s1'), sn('s2')), sn('s3'), gn('g2', sn('s4'))],
});
const run = (selection: Selection, mapping: Mapping = grouped()) => {
  const dispatch = vi.fn();
  const ref: RefObject<SVGSVGElement | null> = { current: svg() };
  const hook = renderHook(() => useStageDrag({ state: { ...initialEditorState(mapping), selection }, dispatch, svgRef: ref, scale: 1 }));
  return { hook, dispatch };
};
const dragItems = (d: ReturnType<typeof vi.fn>): unknown[] => d.mock.calls.map((c) => c[0] as { type: string }).filter((a) => a.type === 'dragItems');

describe('useStageDrag group drag', () => {
  it('dispatches the incremental delta and none when unchanged', () => {
    const { hook, dispatch } = run({ ...emptySelection(), groupIds: ['g1'] });
    act(() => hook.result.current.onGroupDown(pointer(50, 50), 'g1'));
    act(() => hook.result.current.onMove(pointer(54, 53, true)));
    act(() => hook.result.current.onMove(pointer(54, 53, true)));
    expect(dragItems(dispatch)).toEqual([{ type: 'dragItems', ids: ['g1'], dx: 4, dy: 3 }]);
  });
  it('moves every selected group together', () => {
    const { hook, dispatch } = run({ ...emptySelection(), groupIds: ['g1', 'g2'] }, twoGroups());
    act(() => hook.result.current.onGroupDown(pointer(50, 50), 'g1'));
    act(() => hook.result.current.onMove(pointer(54, 53, true)));
    expect(dragItems(dispatch)).toEqual([{ type: 'dragItems', ids: ['g1', 'g2'], dx: 4, dy: 3 }]);
  });
  it('moves a group and a top-level surface together, whichever is pressed', () => {
    const { hook, dispatch } = run({ ...emptySelection(), groupIds: ['g1'], surfaceIds: ['s3'] }, twoGroups());
    act(() => hook.result.current.onSurfaceDown(pointer(550, 50), 's3'));
    act(() => hook.result.current.onMove(pointer(554, 53, true)));
    expect(dragItems(dispatch)).toEqual([{ type: 'dragItems', ids: ['s3', 'g1'], dx: 4, dy: 3 }]);
  });
});

describe('useStageDrag group drag snapping and selection', () => {
  it('snaps on the combined frame of the selection', () => {
    const base = twoGroups();
    const mapping: Mapping = { ...base, surfaces: [...base.surfaces, surf('s5', 1003, 0, 100, 100)], layers: [...base.layers, sn('s5')] };
    const { hook, dispatch } = run({ ...emptySelection(), groupIds: ['g1', 'g2'] }, mapping);
    act(() => hook.result.current.onGroupDown(pointer(50, 50), 'g1'));
    act(() => hook.result.current.onMove(pointer(50, 50)));
    expect(dragItems(dispatch)).toEqual([{ type: 'dragItems', ids: ['g1', 'g2'], dx: 3, dy: 0 }]);
  });
  it('shows a guide when the group frame snaps to another surface edge', () => {
    const { hook } = run({ ...emptySelection(), groupIds: ['g1'] }, { ...grouped(), grid: { size: 1 } });
    act(() => hook.result.current.onGroupDown(pointer(50, 50), 'g1'));
    act(() => hook.result.current.onMove(pointer(50, 53)));
    expect(hook.result.current.guides.length).toBeGreaterThan(0);
  });
  it('leaves no history for a press without movement', () => {
    const state = initialEditorState(grouped());
    const afterPress = [{ type: 'select', selection: { ...emptySelection(), groupIds: ['g1'] } }, { type: 'dragStart' }, { type: 'dragEnd' }].reduce((s, a) => reducer(s, a as Action), state);
    expect(afterPress.past).toEqual(state.past);
    expect(afterPress.dragging).toBe(false);
  });
  it('selects the outermost group and drags it in one gesture from an unselected grouped surface', () => {
    const { hook, dispatch } = run(emptySelection());
    act(() => hook.result.current.onSurfaceDown(pointer(50, 50), 's1'));
    act(() => hook.result.current.onMove(pointer(54, 53, true)));
    expect(selected(dispatch)).toEqual(only([], ['g1']));
    expect(dragItems(dispatch)).toEqual([{ type: 'dragItems', ids: ['g1'], dx: 4, dy: 3 }]);
  });
  it('does not start a group drag for a nested group', () => {
    const nested: Mapping = { ...grouped(), groups: [groupOf('g1'), groupOf('g2')], layers: [gn('g1', gn('g2', sn('s1'), sn('s2'))), sn('s3')] };
    const { hook, dispatch } = run({ ...emptySelection(), groupIds: ['g2'] }, nested);
    act(() => hook.result.current.onSurfaceDown(pointer(50, 50), 's1'));
    expect(types(dispatch)).not.toContain('dragStart');
  });
});
