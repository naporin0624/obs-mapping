// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { mapOf, surf } from '../geometry/fixtures';
import { initialEditorState } from './state';
import { useStageDrag } from './use-stage-drag';

type Pointer = ReactPointerEvent<SVGElement>;

const svg = (): SVGSVGElement =>
  ({
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080 }),
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => false,
    releasePointerCapture: vi.fn(),
  }) as unknown as SVGSVGElement;

const pointer = (x: number, y: number, altKey = false): Pointer => ({ clientX: x, clientY: y, altKey, pointerId: 1, shiftKey: false, metaKey: false, stopPropagation: vi.fn() }) as unknown as Pointer;

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
