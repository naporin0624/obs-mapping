// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialEditorState } from '../../editor/state';
import { gn, groupOf, mapOf, sn, surf } from '../../geometry/fixtures';
import type { ObsClient } from '../../obs/client';
import { Stage } from '.';

afterEach(cleanup);

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 2400, height: 1560 } as DOMRect);
});

const renderStage = (dispatch = vi.fn()) => {
  const mapping = { ...mapOf(surf('s1', 0, 0, 100, 100)), groups: [groupOf('g1')], layers: [gn('g1', sn('s1'))] };
  const client = {} as ObsClient;
  return render(
    <Provider>
      <Stage state={initialEditorState(mapping)} dispatch={dispatch} client={client} online={false} />
    </Provider>,
  );
};

describe('Stage pasteboard', () => {
  it('extends the svg viewBox by the margin around the canvas', () => {
    expect(renderStage().container.querySelector('svg')?.getAttribute('viewBox')).toBe('-240 -240 2400 1560');
  });
});

describe('Stage double click', () => {
  it('drills into the group under the pointer from the svg root', () => {
    const dispatch = vi.fn();
    const svg = renderStage(dispatch).container.querySelector('svg');
    if (svg === null) throw new Error('no svg');
    fireEvent.doubleClick(svg, { clientX: 290, clientY: 290 });
    expect(dispatch).toHaveBeenCalledWith({ type: 'select', selection: { surfaceIds: [], groupIds: ['g1'], corner: null } });
  });
});

describe('Stage keys', () => {
  it('leaves Cmd+Z to the document-wide history keys so undo is not dispatched twice', () => {
    const dispatch = vi.fn();
    const stage = renderStage(dispatch).getByRole('application');
    fireEvent.keyDown(stage, { key: 'z', metaKey: true });
    fireEvent.keyDown(stage, { key: 'z', metaKey: true, shiftKey: true });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('still nudges from the Stage', () => {
    const dispatch = vi.fn();
    fireEvent.keyDown(renderStage(dispatch).getByRole('application'), { key: 'ArrowLeft' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'nudge', dx: -1, dy: 0 });
  });
});
