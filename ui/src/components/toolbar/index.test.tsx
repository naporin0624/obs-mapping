// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { localeAtom, type Locale } from '../../i18n/locale';
import { Toolbar } from '.';

afterEach(cleanup);

type Extra = { immovableReason?: string | null; canGroup?: boolean; canUngroup?: boolean; onGroup?: () => void; dispatch?: () => void };

const show = (selectedCount: number, extra: Extra = {}) =>
  render(
    <Toolbar
      dispatch={extra.dispatch ?? vi.fn()}
      canUndo={false}
      canRedo={false}
      selectedCount={selectedCount}
      immovableReason={extra.immovableReason ?? null}
      canGroup={extra.canGroup ?? false}
      canUngroup={extra.canUngroup ?? false}
      onGroup={extra.onGroup ?? vi.fn()}
      gridSize={10}
      overlayEnabled={false}
      onToggleOverlay={vi.fn()}
    />,
  );

describe('Toolbar align / distribute', () => {
  it('enables Align with one selected surface', () => {
    show(1);
    expect(screen.getByRole('button', { name: '左揃え' }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText('面を選択')).toBeNull();
  });
  it('disables Align with none selected and explains why', () => {
    show(0);
    const left = screen.getByRole('button', { name: '左揃え', description: '面を選択' });
    expect(left.hasAttribute('disabled')).toBe(true);
  });
  it('explains that Distribute needs 3 or more surfaces', () => {
    show(2);
    const h = screen.getByRole('button', { name: '横に等間隔', description: '3面以上を選択' });
    expect(h.hasAttribute('disabled')).toBe(true);
  });
  it('enables Distribute with three and drops the reason', () => {
    show(3);
    expect(screen.getByRole('button', { name: '縦に等間隔' }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText('3面以上を選択')).toBeNull();
  });
});

describe('Toolbar immovable selection', () => {
  it('replaces the generic reason when the selection has nothing movable', () => {
    const note = 'グループの中の要素は、グループが位置を決めています';
    show(0, { immovableReason: note });
    expect(screen.getByRole('button', { name: '左揃え', description: note })).toBeTruthy();
    expect(screen.getByRole('button', { name: '横に等間隔', description: note })).toBeTruthy();
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
  ja: ['元に戻す', 'やり直す', '左揃え', '左右中央', '右揃え', '上揃え', '上下中央', '下揃え', '横に等間隔', '縦に等間隔', 'グループ化', 'グループ解除'],
  en: ['Undo', 'Redo', 'Left', 'Center', 'Right', 'Top', 'Middle', 'Bottom', 'Distribute horizontally', 'Distribute vertically', 'Group selection', 'Ungroup'],
};

describe('Toolbar icon buttons', () => {
  it.each(['ja', 'en'] as const)('names every icon button in %s, in keyboard order', (locale) => {
    showIn(locale);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names.slice(0, 12)).toEqual([...NAMES[locale]]);
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
    expect(screen.getAllByRole('separator').length).toBe(4);
  });
  it('appends the disabled reason to the tooltip and describes the button with it', () => {
    show(2);
    const h = screen.getByRole('button', { name: '横に等間隔', description: '3面以上を選択' });
    expect(h.parentElement?.getAttribute('title')).toBe('横に等間隔 (3面以上を選択)');
  });
  it('drops the cluster heading text', () => {
    show(0);
    expect(screen.queryByText('整列')).toBeNull();
    expect(screen.queryByText('等間隔')).toBeNull();
  });
  it('keeps the file actions slot in the first row', () => {
    showIn('ja');
    const buttons = screen.getAllByRole('button');
    expect(buttons[12]?.textContent).toBe('file');
  });
});
