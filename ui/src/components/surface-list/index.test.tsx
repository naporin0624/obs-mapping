// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySelection, type Selection } from '../../editor/state';
import { gn, groupOf, mapOf, sn, surf } from '../../geometry/fixtures';
import type { Mapping } from '../../model/mapping';
import { SurfaceList } from '.';

afterEach(cleanup);

const withGroup = (): Mapping => ({ ...mapOf(surf('a', 0, 0)), groups: [groupOf('g-1')], layers: [gn('g-1', sn('a'))] });

const mount = (mapping: Mapping, selection: Selection = emptySelection(), inputs: readonly string[] = ['cam']) => {
  const dispatch = vi.fn();
  render(
    <Provider store={createStore()}>
      <SurfaceList mapping={mapping} selection={selection} inputs={inputs} dispatch={dispatch} onReloadInputs={vi.fn()} />
    </Provider>,
  );
  return dispatch;
};

describe('SurfaceList', () => {
  it('shows the layer tree under the レイヤー heading', () => {
    mount(withGroup());
    expect(screen.getByText('レイヤー')).toBeTruthy();
    expect(screen.getByRole('treegrid', { name: 'レイヤー' })).toBeTruthy();
  });

  it('Delete is disabled with nothing selected', () => {
    mount(withGroup());
    expect((screen.getByRole('button', { name: '削除' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('deleting a selected group dispatches removeSelected', async () => {
    const dispatch = mount(withGroup(), { surfaceIds: [], groupIds: ['g-1'], corner: null });
    await userEvent.click(screen.getByRole('button', { name: '削除' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'removeSelected' });
  });

  it('shows the hint when there are no surfaces and no groups', () => {
    mount(mapOf());
    expect(screen.getByText('面がありません。ソースを選んで追加してください。')).toBeTruthy();
  });

  it('hides the hint when only an empty group exists', () => {
    mount({ ...mapOf(), groups: [groupOf('g-1')], layers: [gn('g-1')] });
    expect(screen.queryByText('面がありません。ソースを選んで追加してください。')).toBeNull();
  });

  it('Add dispatches addSurface for the chosen input', async () => {
    const dispatch = mount(mapOf());
    await userEvent.click(screen.getByRole('button', { name: '追加' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'addSurface', source: 'cam' });
  });

  it('Add and Delete are icon buttons with titles and no visible text', () => {
    mount(withGroup());
    [
      ['追加', 'plus'],
      ['削除', 'trash'],
    ].forEach(([name, icon]) => {
      const button = screen.getByRole('button', { name });
      expect(button.getAttribute('title')).toBe(name);
      expect(button.textContent).toBe('');
      expect(button.querySelector('svg')?.getAttribute('data-icon')).toBe(icon);
    });
  });
});
