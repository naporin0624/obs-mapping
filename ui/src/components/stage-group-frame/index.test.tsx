// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StageGroupFrame } from '.';

afterEach(cleanup);

const frame = { x: 10, y: 20, width: 300, height: 100 };

const renderFrame = (movable: boolean, onPointerDown = vi.fn()) =>
  render(
    <svg>
      <StageGroupFrame frame={frame} movable={movable} scale={1} onPointerDown={onPointerDown} />
    </svg>,
  );

describe('StageGroupFrame', () => {
  it('draws one rect at the frame and four corner handles', () => {
    const { container } = renderFrame(true);
    const rect = container.querySelector('rect[data-frame]');
    expect([rect?.getAttribute('x'), rect?.getAttribute('y'), rect?.getAttribute('width'), rect?.getAttribute('height')]).toEqual(['10', '20', '300', '100']);
    expect(container.querySelectorAll('rect[data-handle]')).toHaveLength(4);
  });
  it('uses the move cursor when movable and the locked cursor otherwise', () => {
    const cursor = (movable: boolean): string => {
      const c = renderFrame(movable).container.querySelector('rect[data-frame]')?.getAttribute('class') ?? '';
      cleanup();
      return c
        .split(' ')
        .filter((n) => n.startsWith('cursor_'))
        .join(' ');
    };
    expect([cursor(true), cursor(false)]).toEqual(['cursor_move', 'cursor_not-allowed']);
  });
  it('forwards pointer down from the frame', () => {
    const down = vi.fn();
    const { container } = renderFrame(true, down);
    const rect = container.querySelector('rect[data-frame]');
    if (rect === null) throw new Error('no frame');
    fireEvent.pointerDown(rect);
    expect(down).toHaveBeenCalledTimes(1);
  });
  it('keeps handles inert to the pointer', () => {
    const { container } = renderFrame(true);
    expect(container.querySelector('rect[data-handle]')?.getAttribute('pointer-events')).toBe('none');
  });
});
