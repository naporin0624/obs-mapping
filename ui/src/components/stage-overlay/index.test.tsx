// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gn, groupOf, mapOf, sn, surf, withMask } from '../../geometry/fixtures';
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
  onMaskHandleDown: vi.fn(),
  onMaskEdgeDown: vi.fn(),
  onDoubleClick: vi.fn(),
  onMove: vi.fn(),
  onUp: vi.fn(),
});
const mapping = { ...mapOf(), grid: { size: 1 } };

const renderOverlay = (guides: StageDrag['guides']) =>
  render(
    <svg>
      <StageOverlay mapping={mapping} shapeEdit={null} selection={emptySelection()} visibleIds={new Set()} scale={1} drag={drag(guides)} />
    </svg>,
  );

describe('StageOverlay guides', () => {
  it('draws each guide clipped to the pasteboard, hidden from assistive tech and inert to the pointer', () => {
    const { container } = renderOverlay([{ origin: [300, 40], dir: [1, 0] }]);
    const line = container.querySelector('line[data-guide]');
    expect(line?.getAttribute('aria-hidden')).toBe('true');
    expect(line?.getAttribute('pointer-events')).toBe('none');
    expect([line?.getAttribute('x1'), line?.getAttribute('x2'), line?.getAttribute('y1')]).toEqual(['-240', '2160', '40']);
  });
  it('draws nothing without guides', () => {
    expect(renderOverlay([]).container.querySelector('line[data-guide]')).toBeNull();
  });
});

describe('StageOverlay pasteboard', () => {
  it('draws the handle of a corner that sits outside the canvas', () => {
    const outside = mapOf(surf('s1', -40, 10, 100, 100));
    const { container } = render(
      <svg>
        <StageOverlay mapping={outside} shapeEdit={null} selection={{ ...emptySelection(), surfaceIds: ['s1'] }} visibleIds={new Set(['s1'])} scale={1} drag={drag([])} />
      </svg>,
    );
    const xs = Array.from(container.querySelectorAll('rect')).map((r) => r.getAttribute('x'));
    expect(xs).toContain(String(-40 - 10 / 2));
  });
  it('deselects on a press in the margin outside the canvas', () => {
    const d = drag([]);
    const { container } = render(
      <svg>
        <StageOverlay mapping={mapping} shapeEdit={null} selection={emptySelection()} visibleIds={new Set()} scale={1} drag={d} />
      </svg>,
    );
    const background = container.querySelector('rect[data-background]');
    expect([background?.getAttribute('x'), background?.getAttribute('y'), background?.getAttribute('width'), background?.getAttribute('height')]).toEqual(['-240', '-240', '2400', '1560']);
    if (background === null) throw new Error('no background');
    fireEvent.pointerDown(background);
    expect(d.onBackgroundDown).toHaveBeenCalled();
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
        <StageOverlay mapping={grouped} shapeEdit={null} selection={selection} visibleIds={new Set(['s1', 's2', 's3'])} scale={1} drag={drag([])} />
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
          <StageOverlay mapping={grouped} shapeEdit={null} selection={selection} visibleIds={new Set()} scale={1} drag={drag([])} />
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
          <StageOverlay mapping={nested} shapeEdit={null} selection={{ ...emptySelection(), groupIds: [id] }} visibleIds={new Set()} scale={1} drag={drag([])} />
        </svg>,
      ).container.querySelector('rect[data-frame]');
      cleanup();
      return (rect?.getAttribute('class') ?? '').split(' ').filter((c) => c.startsWith('cursor_'));
    };
    expect([cursor('outer'), cursor('inner')]).toEqual([['cursor_move'], ['cursor_not-allowed']]);
  });
});

describe('StageOverlay mask hit area', () => {
  const circle = { type: 'ellipse', x: 0, y: 0, width: 1, height: 1 } as const;
  const masked = { ...mapOf(withMask(surf('a', 0, 0, 100, 100), circle)), grid: { size: 1 } };
  const renderMasked = () =>
    render(
      <svg>
        <StageOverlay mapping={masked} shapeEdit={null} selection={emptySelection()} visibleIds={new Set(['a'])} scale={1} drag={drag([])} />
      </svg>,
    );
  const polygons = (c: HTMLElement) => Array.from(c.querySelectorAll('polygon')).filter((p) => p.closest('clipPath') === null);

  it('makes the quad outline inert and puts the pointer handler on a 64-point mask polygon', () => {
    const { container } = renderMasked();
    const [quad, hit] = polygons(container);
    expect(quad?.getAttribute('pointer-events')).toBe('none');
    expect(hit?.getAttribute('points')?.split(' ')).toHaveLength(64);
    expect(hit?.getAttribute('fill-rule')).toBe('evenodd');
  });
  it('routes presses on the hit polygon to the drag handler', () => {
    const d = drag([]);
    const { container } = render(
      <svg>
        <StageOverlay mapping={masked} shapeEdit={null} selection={emptySelection()} visibleIds={new Set(['a'])} scale={1} drag={d} />
      </svg>,
    );
    fireEvent.pointerDown(polygons(container)[1] as Element);
    expect(d.onSurfaceDown).toHaveBeenCalledOnce();
  });
  it('clips the hit polygon of an overflowing mask to the quad', () => {
    const wide = { type: 'ellipse', x: -0.25, y: 0, width: 1.5, height: 1 } as const;
    const { container } = render(
      <svg>
        <StageOverlay mapping={mapOf(withMask(surf('a', 0, 0, 100, 100), wide))} shapeEdit={null} selection={emptySelection()} visibleIds={new Set(['a'])} scale={1} drag={drag([])} />
      </svg>,
    );
    const [quad, hit] = polygons(container);
    const id = /^url\(#(.+)\)$/.exec(hit?.getAttribute('clip-path') ?? '')?.[1];
    const clip = Array.from(container.querySelectorAll('clipPath')).find((c) => c.id === id);
    expect(clip?.querySelector('polygon')?.getAttribute('points')).toBe(quad?.getAttribute('points'));
  });
  it('leaves an unmasked surface with a single polygon', () => {
    const { container } = renderOverlay([]);
    expect(polygons(container).every((p) => p.getAttribute('pointer-events') !== 'none')).toBe(true);
  });
});

describe('StageOverlay shape edit', () => {
  const ellipse = { type: 'ellipse', x: 0, y: 0, width: 1, height: 1 } as const;
  const twoMasked = () => mapOf(withMask(surf('s1', 0, 0, 100, 100), ellipse), surf('s2', 200, 0, 100, 100));
  const drawEdit = (d: StageDrag, shapeEdit: { surfaceId: string; vertex: number | null } | null) =>
    render(
      <svg>
        <StageOverlay mapping={twoMasked()} shapeEdit={shapeEdit} selection={{ ...emptySelection(), surfaceIds: ['s1'] }} visibleIds={new Set(['s1', 's2'])} scale={1} drag={d} />
      </svg>,
    ).container;
  it('hides the corner handles and shows the mask handles of the edited surface', () => {
    const c = drawEdit(drag([]), { surfaceId: 's1', vertex: null });
    expect(c.querySelectorAll('rect[data-corner]')).toHaveLength(0);
    expect(c.querySelectorAll('[data-mask-handle]')).toHaveLength(4);
  });
  it('shows corner handles and no mask handles outside shape edit', () => {
    const c = drawEdit(drag([]), null);
    expect(c.querySelectorAll('rect[data-corner]')).toHaveLength(4);
    expect(c.querySelectorAll('[data-mask-handle]')).toHaveLength(0);
  });
  it('routes mask handle presses with the surface id', () => {
    const d = drag([]);
    const c = drawEdit(d, { surfaceId: 's1', vertex: null });
    fireEvent.pointerDown(c.querySelector('[data-mask-handle="right"]') as Element);
    expect(d.onMaskHandleDown).toHaveBeenCalledWith(expect.anything(), 's1', 'right');
  });
});
