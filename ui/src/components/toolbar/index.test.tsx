// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { localeAtom, type Locale } from '../../i18n/locale';
import type { TileTarget } from '../../editor/tile-group';
import { Toolbar } from '.';

afterEach(cleanup);

type Extra = { tile?: TileTarget; immovableReason?: string | null; canGroup?: boolean; canUngroup?: boolean; onGroup?: () => void; dispatch?: () => void };

const surfaces = (count: number): TileTarget => (count === 0 ? { kind: 'blocked', why: 'noSurface' } : { kind: 'surfaces', count });

const show = (selectedCount: number, extra: Extra = {}) =>
  render(
    <Toolbar
      dispatch={extra.dispatch ?? vi.fn()}
      canUndo={false}
      canRedo={false}
      selectedCount={selectedCount}
      immovableReason={extra.immovableReason ?? null}
      tile={extra.tile ?? surfaces(selectedCount)}
      canvas={{ width: 1920, height: 1080 }}
      canGroup={extra.canGroup ?? false}
      canUngroup={extra.canUngroup ?? false}
      onGroup={extra.onGroup ?? vi.fn()}
      gridSize={10}
      overlayEnabled={false}
      onToggleOverlay={vi.fn()}
    />,
  );

describe('Toolbar align / distribute', () => {
  it('enables 整列 with one selected surface', () => {
    show(1);
    expect(screen.getByRole('button', { name: '整列' }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText('面を選択')).toBeNull();
  });
  it('disables 整列 with none selected and explains why', () => {
    show(0);
    expect(screen.getByRole('button', { name: '整列', description: '面を選択' }).hasAttribute('disabled')).toBe(true);
  });
  it('explains that 等間隔 needs 3 or more surfaces', () => {
    show(2);
    expect(screen.getByRole('button', { name: '等間隔', description: '3面以上を選択' }).hasAttribute('disabled')).toBe(true);
  });
  it('enables 等間隔 with three and drops the reason', () => {
    show(3);
    expect(screen.getByRole('button', { name: '等間隔' }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText('3面以上を選択')).toBeNull();
  });
});

describe('Toolbar align / distribute popovers', () => {
  it('keeps the six align modes behind 整列, horizontal then vertical', async () => {
    const user = userEvent.setup();
    show(1);
    await user.click(screen.getByRole('button', { name: '整列' }));
    const dialog = await screen.findByRole('dialog', { name: '整列' });
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['左揃え', '左右中央', '右揃え', '上揃え', '上下中央', '下揃え']);
  });
  it.each([
    ['左揃え', 'left'],
    ['上下中央', 'centerY'],
  ] as const)('dispatches align from %s and closes the popover', async (name, mode) => {
    const dispatch = vi.fn();
    const user = userEvent.setup();
    show(1, { dispatch });
    await user.click(screen.getByRole('button', { name: '整列' }));
    await user.click(await screen.findByRole('button', { name }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'align', mode });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it.each([
    ['横に等間隔', 'x'],
    ['縦に等間隔', 'y'],
  ] as const)('dispatches distribute from %s and closes the popover', async (name, axis) => {
    const dispatch = vi.fn();
    const user = userEvent.setup();
    show(3, { dispatch });
    await user.click(screen.getByRole('button', { name: '等間隔' }));
    await user.click(await screen.findByRole('button', { name }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'distribute', axis });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Toolbar immovable selection', () => {
  it('replaces the generic reason when the selection has nothing movable', () => {
    const note = 'グループの中の要素は、グループが位置を決めています';
    show(0, { immovableReason: note });
    expect(screen.getByRole('button', { name: '整列', description: note })).toBeTruthy();
    expect(screen.getByRole('button', { name: '等間隔', description: note })).toBeTruthy();
  });
});

describe('Toolbar tile', () => {
  it('disables 敷き詰め without a top-level surface and explains why', () => {
    show(1, { tile: { kind: 'blocked', why: 'noSurface' } });
    expect(screen.getByRole('button', { name: '敷き詰め', description: '面を選択' }).hasAttribute('disabled')).toBe(true);
  });
  it('shares the immovable reason with the other layout buttons', () => {
    const note = 'グループの中の要素は、グループが位置を決めています';
    show(0, { immovableReason: note });
    expect(screen.getByRole('button', { name: '敷き詰め', description: note })).toBeTruthy();
  });
  it('dispatches tile with the grid from the popover', async () => {
    const dispatch = vi.fn();
    const user = userEvent.setup();
    show(2, { dispatch });
    await user.click(screen.getByRole('button', { name: '敷き詰め' }));
    await user.click(await screen.findByRole('button', { name: '適用' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'tile', cols: 2, rows: 1, gap: 0 });
  });
});

describe('Toolbar tile a group', () => {
  it('dispatches tileGroup with the group, direction and gap', async () => {
    const dispatch = vi.fn();
    const user = userEvent.setup();
    show(1, { dispatch, tile: { kind: 'group', groupId: 'g-1', count: 2, direction: 'column' } });
    await user.click(screen.getByRole('button', { name: '敷き詰め' }));
    await user.click(await screen.findByRole('button', { name: '適用' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'tileGroup', groupId: 'g-1', direction: 'column', gap: 0 });
  });
  it.each([
    ['mixed', 'グループは 1 つだけ選んでください'],
    ['subgroup', '中にグループがあるグループは敷き詰められません'],
    ['empty', '表示中の面がないグループは敷き詰められません'],
    ['nested', 'グループの中の要素は、グループが位置を決めています'],
  ] as const)('explains a %s selection', (why, reason) => {
    show(1, { tile: { kind: 'blocked', why } });
    expect(screen.getByRole('button', { name: '敷き詰め', description: reason }).hasAttribute('disabled')).toBe(true);
  });
});

describe('Toolbar group / ungroup', () => {
  it('shows one short reason when nothing is selected, shared by both buttons', () => {
    show(0);
    expect(screen.getByRole('button', { name: 'グループ化', description: '面かグループを選択' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'グループ解除', description: '面かグループを選択' })).toBeTruthy();
    expect(screen.queryByText('グループを選ぶと使えます')).toBeNull();
  });
  it('asks for a group when only グループ解除 is disabled', () => {
    show(1, { canGroup: true });
    expect(screen.getByRole('button', { name: 'グループ解除', description: 'グループを選択' })).toBeTruthy();
    expect(screen.queryByText('面かグループを選択')).toBeNull();
  });
  it('shows no reason when both are enabled', () => {
    show(1, { canGroup: true, canUngroup: true });
    expect(screen.queryByRole('button', { name: 'グループ化', description: /./ })).toBeNull();
  });
  it('disables グループ化 with nothing selected', () => {
    show(0, { canGroup: false });
    expect(screen.getByRole('button', { name: 'グループ化' }).hasAttribute('disabled')).toBe(true);
  });
  it('calls onGroup when グループ化 is pressed', () => {
    const onGroup = vi.fn();
    show(1, { canGroup: true, onGroup });
    fireEvent.click(screen.getByRole('button', { name: 'グループ化' }));
    expect(onGroup).toHaveBeenCalledTimes(1);
  });
  it('dispatches ungroup from グループ解除', () => {
    const dispatch = vi.fn();
    show(0, { canUngroup: true, dispatch });
    fireEvent.click(screen.getByRole('button', { name: 'グループ解除' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'ungroup' });
  });
  it('disables グループ解除 without a selected group', () => {
    show(1);
    expect(screen.getByRole('button', { name: 'グループ解除' }).hasAttribute('disabled')).toBe(true);
  });
});

const showIn = (locale: Locale, extra: Extra = {}) => {
  const store = createStore();
  store.set(localeAtom, locale);
  return render(
    <Provider store={store}>
      <Toolbar
        dispatch={extra.dispatch ?? vi.fn()}
        canUndo
        canRedo
        selectedCount={extra.immovableReason === undefined ? 3 : 0}
        immovableReason={extra.immovableReason ?? null}
        tile={surfaces(extra.immovableReason === undefined ? 3 : 0)}
        canvas={{ width: 1920, height: 1080 }}
        canGroup
        canUngroup
        onGroup={vi.fn()}
        gridSize={10}
        overlayEnabled={false}
        onToggleOverlay={vi.fn()}
        fileActions={<button type="button">file</button>}
      />
    </Provider>,
  );
};

const NAMES: Record<Locale, readonly string[]> = {
  ja: ['元に戻す', 'やり直す', '整列', '等間隔', '敷き詰め', 'グループ化', 'グループ解除'],
  en: ['Undo', 'Redo', 'Align', 'Distribute', 'Tile', 'Group selection', 'Ungroup'],
};

describe('Toolbar icon buttons', () => {
  it.each(['ja', 'en'] as const)('names every icon button in %s, in keyboard order', (locale) => {
    showIn(locale);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names.slice(0, 7)).toEqual([...NAMES[locale]]);
  });
  it('hides the icon glyphs and shows no visible text in icon buttons', () => {
    showIn('ja');
    const undo = screen.getByRole('button', { name: '元に戻す' });
    expect(undo.textContent).toBe('');
    expect(undo.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
  it('shows the name as a tooltip when an enabled button takes keyboard focus', async () => {
    showIn('ja');
    await userEvent.tab();
    expect(screen.getByRole('tooltip').textContent).toBe('元に戻す');
  });
  it('separates clusters without a trailing separator', () => {
    showIn('ja');
    expect(screen.getAllByRole('separator').length).toBe(5);
  });
  it('appends the disabled reason to the tooltip and describes the button with it', () => {
    show(2);
    const h = screen.getByRole('button', { name: '等間隔', description: '3面以上を選択' });
    expect(h.parentElement?.getAttribute('title')).toBe('等間隔 (3面以上を選択)');
  });
  it('names the align and distribute triggers without visible text', () => {
    show(0);
    expect(screen.queryByText('整列')).toBeNull();
    expect(screen.queryByText('等間隔')).toBeNull();
  });
  it('keeps the file actions slot in the first row', () => {
    showIn('ja');
    const buttons = screen.getAllByRole('button');
    expect(buttons[7]?.textContent).toBe('file');
  });
});

const showView = (overlayEnabled: boolean, onToggleOverlay = vi.fn(), dispatch = vi.fn()) =>
  render(
    <Toolbar
      dispatch={dispatch}
      canUndo={false}
      canRedo={false}
      selectedCount={0}
      immovableReason={null}
      tile={surfaces(0)}
      canvas={{ width: 1920, height: 1080 }}
      canGroup={false}
      canUngroup={false}
      onGroup={vi.fn()}
      gridSize={10}
      overlayEnabled={overlayEnabled}
      onToggleOverlay={onToggleOverlay}
    />,
  );

describe('Toolbar view row', () => {
  it('toggles the overlay from an icon-only pressed button', async () => {
    const onToggle = vi.fn();
    showView(false, onToggle);
    const overlay = screen.getByRole('button', { name: 'オーバーレイ' });
    expect(overlay.getAttribute('aria-pressed')).toBe('false');
    expect(overlay.textContent).toBe('');
    await userEvent.click(overlay);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
  it('reports the overlay as pressed while it is on', () => {
    showView(true);
    expect(screen.getByRole('button', { name: 'オーバーレイ' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('names the grid input by its label without visible text', async () => {
    const dispatch = vi.fn();
    showView(false, vi.fn(), dispatch);
    const grid = screen.getByRole('spinbutton', { name: 'グリッド' });
    expect(grid.closest('label')?.querySelector('svg[data-icon="grid"]')).not.toBeNull();
    await userEvent.clear(grid);
    await userEvent.type(grid, '20{Enter}');
    expect(dispatch).toHaveBeenCalledWith({ type: 'setGrid', size: 20 });
  });
});
