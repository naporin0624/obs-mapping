// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStore, Provider } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collapsedGroupsAtom } from '../../atoms/layers';
import { emptySelection } from '../../editor/state';
import { gn, groupOf, mapOf, sn, surf } from '../../geometry/fixtures';
import type { Mapping } from '../../model/mapping';
import { LayerTree } from '.';

afterEach(cleanup);

const sample = (): Mapping => ({
  ...mapOf(surf('a', 0, 0), surf('b', 0, 0)),
  groups: [groupOf('g-1', { name: 'Stage', visible: false })],
  layers: [gn('g-1', sn('a')), sn('b')],
});

const mount = (m: Mapping = sample()) => {
  const store = createStore();
  const dispatch = vi.fn();
  render(
    <Provider store={store}>
      <LayerTree mapping={m} selection={emptySelection()} dispatch={dispatch} />
    </Provider>,
  );
  return { store, dispatch };
};

const firstRow = (): HTMLElement => {
  const [row] = screen.getAllByRole('row');
  if (row === undefined) throw new Error('no rows');
  return row;
};

const chevronsIn = (row: HTMLElement): HTMLElement[] =>
  within(row)
    .queryAllByRole('button')
    .filter((b) => b.getAttribute('slot') === 'chevron');

describe('LayerTree', () => {
  it('renders a treegrid with nested rows one level deeper', () => {
    mount();
    expect(screen.getByRole('treegrid')).toBeTruthy();
    const rows = screen.getAllByRole('row');
    expect(rows.map((r) => r.getAttribute('aria-level'))).toEqual(['1', '2', '1']);
  });

  it('collapsing a group hides its children and records it in the atom', async () => {
    const { store } = mount();
    const [chevron] = chevronsIn(firstRow());
    if (chevron === undefined) throw new Error('no chevron');
    await userEvent.click(chevron);
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect([...store.get(collapsedGroupsAtom)]).toEqual(['g-1']);
  });

  it('the group visibility button dispatches patchGroup without selecting', async () => {
    const { dispatch } = mount();
    await userEvent.click(screen.getByRole('button', { name: 'Stage を表示する' }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'patchGroup', groupId: 'g-1', patch: { visible: true } });
  });

  it('clicking a group row selects it', async () => {
    const { dispatch } = mount();
    await userEvent.click(screen.getByText('Stage'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'select', selection: { surfaceIds: [], groupIds: ['g-1'], corner: null } });
  });

  it('visibility buttons are named and pressed-aware; hidden-by-group rows say so', () => {
    mount();
    const buttons = screen.getAllByRole('button', { name: /を(表示する|非表示にする)$/ });
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'true']);
    expect(screen.getByText('グループで非表示')).toBeTruthy();
    expect(screen.getByText('1 個')).toBeTruthy();
  });
});

describe('LayerTree states', () => {
  it('every row has a drag handle for keyboard and screen reader users', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Stage を並べ替える' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'a を並べ替える' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'b を並べ替える' })).toBeTruthy();
  });

  it('the drag handle comes before the chevron and the visibility toggle', () => {
    mount();
    const buttons = within(firstRow()).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('slot') ?? b.getAttribute('aria-pressed'))).toEqual(['drag', 'chevron', 'false']);
  });

  it('an empty group has no chevron', () => {
    mount({ ...mapOf(), groups: [groupOf('g-1')], layers: [gn('g-1')] });
    expect(chevronsIn(firstRow())).toHaveLength(0);
  });

  it('a selected row is aria-selected', () => {
    const store = createStore();
    render(
      <Provider store={store}>
        <LayerTree mapping={sample()} selection={{ surfaceIds: ['b'], groupIds: [], corner: null }} dispatch={vi.fn()} />
      </Provider>,
    );
    const rows = screen.getAllByRole('row');
    expect(rows.map((r) => r.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
  });

  it('a surface under a hidden group is dimmed; the hidden group itself is not', () => {
    mount();
    const rows = screen.getAllByRole('row');
    expect(rows.map((r) => r.getAttribute('data-dimmed'))).toEqual(['false', 'true', 'false']);
  });

  it('dims a surface nested two levels under a hidden group', () => {
    const m: Mapping = {
      ...mapOf(surf('a', 0, 0)),
      groups: [groupOf('g-1', { visible: false }), groupOf('g-2')],
      layers: [gn('g-1', gn('g-2', sn('a')))],
    };
    mount(m);
    const dimmed = screen.getAllByRole('row').map((r) => r.getAttribute('data-dimmed'));
    expect(dimmed).toEqual(['false', 'true', 'true']);
    expect(screen.getAllByText('グループで非表示')).toHaveLength(2);
  });
});

describe('LayerTree visibility icon', () => {
  it('a hidden surface under a hidden group shows Off, not hidden-by-group', () => {
    const m: Mapping = { ...mapOf({ ...surf('a', 0, 0), visible: false }), groups: [groupOf('g-1', { visible: false })], layers: [gn('g-1', sn('a'))] };
    mount(m);
    expect(screen.queryByText('グループで非表示')).toBeNull();
    const toggles = screen.getAllByRole('button', { name: /を表示する$/ });
    expect(toggles).toHaveLength(2);
    expect(toggles.every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });
  it('shows an svg icon instead of On/Off text', () => {
    mount();
    const toggles = screen.getAllByRole('button', { name: /を(表示する|非表示にする)$/ });
    expect(toggles).toHaveLength(3);
    toggles.forEach((b) => {
      expect(b.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(b.textContent).toBe('');
    });
    expect(screen.queryByText('On')).toBeNull();
    expect(screen.queryByText('Off')).toBeNull();
  });

  it('keeps the open eye for a surface hidden only by its group', () => {
    mount();
    const toggle = screen.getByRole('button', { name: 'a を非表示にする' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.querySelector('svg')?.getAttribute('data-icon')).toBe('eye');
  });

  it('draws the slashed eye for a hidden group', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Stage を表示する' }).querySelector('svg')?.getAttribute('data-icon')).toBe('eye-off');
  });

  it('toggling a surface dispatches patchSurface', async () => {
    const { dispatch } = mount();
    await userEvent.click(screen.getByRole('button', { name: 'b を非表示にする' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'patchSurface', surfaceId: 'b', patch: { visible: false } });
  });
});
