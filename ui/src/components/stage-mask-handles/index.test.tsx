// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rectCorners } from '../../geometry/rect';
import type { Mask } from '../../model/mapping';
import { StageMaskHandles } from '.';
import { handleOnCls } from './styles.css';

afterEach(cleanup);

const corners = rectCorners({ x: 100, y: 50, width: 200, height: 100 });
const ellipse: Mask = { type: 'ellipse', x: 0, y: 0, width: 1, height: 1 };
const triangle: Mask = {
  type: 'polygon',
  points: [
    [0, 0],
    [1, 0],
    [0.5, 1],
  ],
};

const draw = (mask: Mask, vertex: number | null = null, onHandleDown = vi.fn(), onEdgeDown = vi.fn()) =>
  render(
    <svg>
      <StageMaskHandles corners={corners} mask={mask} vertex={vertex} scale={1} onHandleDown={onHandleDown} onEdgeDown={onEdgeDown} />
    </svg>,
  ).container;

const at = (el: Element | null): [number, number] => [Number(el?.getAttribute('cx')), Number(el?.getAttribute('cy'))];

describe('StageMaskHandles', () => {
  it('draws four edge-midpoint handles and a body for an ellipse, in canvas px', () => {
    const c = draw(ellipse);
    expect(c.querySelectorAll('[data-mask-handle]')).toHaveLength(4);
    expect(c.querySelectorAll('[data-mask-body]')).toHaveLength(1);
    expect(at(c.querySelector('[data-mask-handle="right"]'))).toEqual([300, 100]);
    expect(at(c.querySelector('[data-mask-handle="top"]'))).toEqual([200, 50]);
    expect(c.querySelectorAll('[data-vertex], [data-edge]')).toHaveLength(0);
  });
  it('clips the body to the quad so an overflowing mask cannot take presses outside it', () => {
    const c = draw({ type: 'ellipse', x: -0.25, y: 0, width: 1.5, height: 1 });
    const id = /^url\(#(.+)\)$/.exec(c.querySelector('[data-mask-body]')?.getAttribute('clip-path') ?? '')?.[1];
    const clip = Array.from(c.querySelectorAll('clipPath')).find((x) => x.id === id);
    expect(clip?.querySelector('polygon')?.getAttribute('points')).toBe(corners.map((p) => `${String(p[0])},${String(p[1])}`).join(' '));
  });
  it('draws a handle per vertex and a hit line per edge for a polygon', () => {
    const c = draw(triangle);
    expect(c.querySelectorAll('[data-vertex]')).toHaveLength(3);
    expect(at(c.querySelector('[data-vertex="2"]'))).toEqual([200, 150]);
    const edge = c.querySelector('[data-edge="2"]');
    expect(['x1', 'y1', 'x2', 'y2'].map((k) => Number(edge?.getAttribute(k)))).toEqual([200, 150, 100, 50]);
  });
  it('orders edge hit lines below the vertex handles', () => {
    const c = draw(triangle);
    const nodes = [...c.querySelectorAll('[data-edge], [data-vertex]')];
    expect(nodes.findIndex((n) => n.hasAttribute('data-vertex'))).toBeGreaterThan(nodes.findLastIndex((n) => n.hasAttribute('data-edge')));
  });
  it('marks only the selected vertex', () => {
    const c = draw(triangle, 1);
    expect([...c.querySelectorAll('[data-vertex]')].map((n) => n.classList.contains(handleOnCls))).toEqual([false, true, false]);
  });
  it('reports which handle or edge was pressed', () => {
    const onHandleDown = vi.fn();
    const onEdgeDown = vi.fn();
    const c = draw(triangle, null, onHandleDown, onEdgeDown);
    fireEvent.pointerDown(c.querySelector('[data-vertex="1"]') as Element);
    fireEvent.pointerDown(c.querySelector('[data-edge="0"]') as Element);
    fireEvent.pointerDown(c.querySelector('[data-mask-body]') as Element);
    expect(onHandleDown.mock.calls.map((call) => call[1] as unknown)).toEqual([{ vertex: 1 }, 'body']);
    expect(onEdgeDown.mock.calls.map((call) => call[1] as unknown)).toEqual([0]);
  });
});
