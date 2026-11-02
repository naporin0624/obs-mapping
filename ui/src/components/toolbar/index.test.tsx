// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const reasonOf = (button: HTMLElement): string | undefined => document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent ?? undefined;

describe('Toolbar align / distribute', () => {
  it('enables Align with one selected surface', () => {
    show(1);
    expect(screen.getByRole('button', { name: 'Left' }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText('面を選択')).toBeNull();
  });
  it('disables Align with none selected and explains why', () => {
    show(0);
    const left = screen.getByRole('button', { name: 'Left' });
    expect(left.hasAttribute('disabled')).toBe(true);
    expect(reasonOf(left)).toBe('面を選択');
  });
  it('explains that Distribute needs 3 or more surfaces', () => {
    show(2);
    const h = screen.getByRole('button', { name: 'Horizontal' });
    expect(h.hasAttribute('disabled')).toBe(true);
    expect(reasonOf(h)).toBe('3面以上を選択');
  });
  it('enables Distribute with three and drops the reason', () => {
    show(3);
    expect(screen.getByRole('button', { name: 'Vertical' }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText('3面以上を選択')).toBeNull();
  });
});

describe('Toolbar immovable selection', () => {
  it('replaces the generic reason when the selection has nothing movable', () => {
    const note = 'グループの中の要素は、グループが位置を決めています';
    show(0, { immovableReason: note });
    expect(reasonOf(screen.getByRole('button', { name: 'Left' }))).toBe(note);
    expect(reasonOf(screen.getByRole('button', { name: 'Horizontal' }))).toBe(note);
  });
});

describe('Toolbar group / ungroup', () => {
  it('explains why グループ化 and グループ解除 are disabled', () => {
    show(0);
    expect(reasonOf(screen.getByRole('button', { name: 'グループ化' }))).toBe('面かグループを選ぶと使えます');
    expect(reasonOf(screen.getByRole('button', { name: 'グループ解除' }))).toBe('グループを選ぶと使えます');
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
