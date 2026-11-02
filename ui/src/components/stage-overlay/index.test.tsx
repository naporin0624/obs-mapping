// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gn, groupOf, mapOf, sn, surf } from '../../geometry/fixtures';
import { emptySelection, type Selection } from '../../editor/state';
import type { StageDrag } from '../../editor/use-stage-drag';
import { StageOverlay } from '.';

afterEach(cleanup);

const drag = (guides: StageDrag['guides']): StageDrag => ({
  guides,
  onBackgroundDown: vi.fn(),
  onCornerDown: vi.fn(),
  onSurfaceDown: vi.fn(),
  onGroupDown: vi.fn(),
  onDoubleClick: vi.fn(),
  onMove: vi.fn(),
  onUp: vi.fn(),
});
const mapping = { ...mapOf(), grid: { size: 1 } };

const renderOverlay = (guides: StageDrag['guides']) =>
  render(
    <svg>
      <StageOverlay mapping={mapping} selection={emptySelection()} visibleIds={new Set()} scale={1} drag={drag(guides)} />
    </svg>,
  );

describe('StageOverlay guides', () => {
  it('draws each guide clipped to the canvas, hidden from assistive tech and inert to the pointer', () => {
    const { container } = renderOverlay([{ origin: [300, 40], dir: [1, 0] }]);
    const line = container.querySelector('line[data-guide]');
    expect(line?.getAttribute('aria-hidden')).toBe('true');
    expect(line?.getAttribute('pointer-events')).toBe('none');
    expect([line?.getAttribute('x1'), line?.getAttribute('x2'), line?.getAttribute('y1')]).toEqual(['0', '1920', '40']);
  });
  it('draws nothing without guides', () => {
    expect(renderOverlay([]).container.querySelector('line[data-guide]')).toBeNull();
  });
});

describe('StageOverlay laid-out surfaces and group frames', () => {
  const grouped = {
    ...mapOf(surf('s1', 0, 0), surf('s2', 50, 0), surf('s3', 200, 0)),
    groups: [groupOf('g1')],
    layers: [gn('g1', sn('s1'), sn('s2')), sn('s3')],
  };
  const polygons = (selection: Selection) =>
    render(
      <svg>
        <StageOverlay mapping={grouped} selection={selection} visibleIds={new Set(['s1', 's2', 's3'])} scale={1} drag={drag([])} />
      </svg>,
    ).container.querySelectorAll('polygon');
  const cursorLocked = (p: Element | undefined): boolean => (p?.getAttribute('class') ?? '').split(' ').some((c) => c.includes('cursor_not-allowed'));

  it('locks only a selected surface that is laid out', () => {
    const [a, b, c] = polygons({ ...emptySelection(), surfaceIds: ['s1', 's3'] });
    expect([cursorLocked(a), cursorLocked(b), cursorLocked(c)]).toEqual([true, false, false]);
  });
  it('gives each outline exactly one cursor class', () => {
    const cursors = Array.from(polygons({ ...emptySelection(), surfaceIds: ['s1', 's3'] })).map((p) => (p.getAttribute('class') ?? '').split(' ').filter((c) => c.startsWith('cursor_')));
    expect(cursors).toEqual([['cursor_not-allowed'], ['cursor_move'], ['cursor_move']]);
  });
  it('draws a frame only for selected groups', () => {
    const frames = (selection: Selection) => {
      const n = render(
        <svg>
          <StageOverlay mapping={grouped} selection={selection} visibleIds={new Set()} scale={1} drag={drag([])} />
        </svg>,
      ).container.querySelectorAll('rect[data-frame]').length;
      cleanup();
      return n;
    };
    expect([frames(emptySelection()), frames({ ...emptySelection(), groupIds: ['g1'] })]).toEqual([0, 1]);
  });
});

describe('StageOverlay group frame cursor', () => {
  it('locks the frame of a nested group but not a top-level one', () => {
    const nested = {
      ...mapOf(surf('s1', 0, 0)),
      groups: [groupOf('outer'), groupOf('inner')],
      layers: [gn('outer', gn('inner', sn('s1')))],
    };
    const cursor = (id: string): string[] => {
      const rect = render(
        <svg>
          <StageOverlay mapping={nested} selection={{ ...emptySelection(), groupIds: [id] }} visibleIds={new Set()} scale={1} drag={drag([])} />
        </svg>,
      ).container.querySelector('rect[data-frame]');
      cleanup();
      return (rect?.getAttribute('class') ?? '').split(' ').filter((c) => c.startsWith('cursor_'));
    };
    expect([cursor('outer'), cursor('inner')]).toEqual([['cursor_move'], ['cursor_not-allowed']]);
  });
});
