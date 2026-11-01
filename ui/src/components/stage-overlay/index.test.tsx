// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapOf } from '../../geometry/fixtures';
import { emptySelection } from '../../editor/state';
import type { StageDrag } from '../../editor/use-stage-drag';
import { StageOverlay } from '.';

afterEach(cleanup);

const drag = (guides: StageDrag['guides']): StageDrag => ({ guides, onBackgroundDown: vi.fn(), onCornerDown: vi.fn(), onSurfaceDown: vi.fn(), onMove: vi.fn(), onUp: vi.fn() });
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
