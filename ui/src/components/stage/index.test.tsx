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
  vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1920, height: 1080 } as DOMRect);
});

describe('Stage double click', () => {
  it('drills into the group under the pointer from the svg root', () => {
    const mapping = { ...mapOf(surf('s1', 0, 0, 100, 100)), groups: [groupOf('g1')], layers: [gn('g1', sn('s1'))] };
    const dispatch = vi.fn();
    const client = {} as ObsClient;
    const { container } = render(
      <Provider>
        <Stage state={initialEditorState(mapping)} dispatch={dispatch} client={client} online={false} />
      </Provider>,
    );
    const svg = container.querySelector('svg');
    if (svg === null) throw new Error('no svg');
    fireEvent.doubleClick(svg, { clientX: 50, clientY: 50 });
    expect(dispatch).toHaveBeenCalledWith({ type: 'select', selection: { surfaceIds: [], groupIds: ['g1'], corner: null } });
  });
});
