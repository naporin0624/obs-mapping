// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Dispatch } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiAction } from './reducer';
import { useHistoryKeys } from './use-history-keys';

afterEach(cleanup);

const Harness = ({ dispatch }: { dispatch: Dispatch<UiAction> }) => {
  useHistoryKeys(dispatch);
  return (
    <>
      <button type="button">layer</button>
      <input aria-label="x" />
    </>
  );
};

describe('useHistoryKeys', () => {
  it('dispatches undo / redo for Cmd+Z from anywhere in the document', () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'layer' }), { key: 'z', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(dispatch.mock.calls).toEqual([[{ type: 'undo' }], [{ type: 'redo' }]]);
  });

  it('prevents the default only when it handles the key', () => {
    render(<Harness dispatch={vi.fn()} />);
    expect(fireEvent.keyDown(screen.getByRole('button', { name: 'layer' }), { key: 'z', metaKey: true, cancelable: true })).toBe(false);
    expect(fireEvent.keyDown(screen.getByRole('textbox', { name: 'x' }), { key: 'z', metaKey: true, cancelable: true })).toBe(true);
  });

  it('leaves Cmd+Z inside a text field to the browser', () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'x' }), { key: 'z', metaKey: true });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('skips keys another handler already consumed', () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} />);
    const button = screen.getByRole('button', { name: 'layer' });
    button.addEventListener('keydown', (e) => e.preventDefault());
    fireEvent.keyDown(button, { key: 'z', metaKey: true, cancelable: true });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} />).unmount();
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
