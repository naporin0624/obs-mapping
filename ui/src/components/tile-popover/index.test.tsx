// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Direction } from '../../model/mapping';
import { TilePopover } from '.';

afterEach(cleanup);

const canvas = { width: 1920, height: 1080 };

const open = async (count = 3, onApply = vi.fn()) => {
  const user = userEvent.setup();
  render(<TilePopover subject={{ kind: 'surfaces', count, onApply }} canvas={canvas} />);
  await user.click(screen.getByRole('button', { name: '敷き詰め' }));
  return { user, dialog: await screen.findByRole('dialog', { name: '敷き詰め' }), onApply };
};

const cellLabels = (dialog: HTMLElement): string[] => [...within(dialog).getByRole('img').children].map((c) => c.textContent ?? '');

const retype = async (user: ReturnType<typeof userEvent.setup>, label: string, value: string) => {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, `${value}{Enter}`);
};

describe('TilePopover form', () => {
  it('is a disabled toolbar button with its reason when nothing can be tiled', () => {
    render(<TilePopover subject={{ kind: 'surfaces', count: 0, onApply: vi.fn() }} canvas={canvas} unavailable={{ reason: '面を選択' }} />);
    const trigger = screen.getByRole('button', { name: '敷き詰め', description: '面を選択' });
    expect(trigger.hasAttribute('disabled')).toBe(true);
  });
  it('opens with one column per selected surface in a single row and no gap', async () => {
    const { dialog } = await open(3);
    expect(within(dialog).getByLabelText<HTMLInputElement>('列').value).toBe('3');
    expect(within(dialog).getByLabelText<HTMLInputElement>('行').value).toBe('1');
    expect(within(dialog).getByLabelText<HTMLInputElement>('間隔(px)').value).toBe('0');
  });
  it('previews the cells numbered in the order the surfaces fill them', async () => {
    const { dialog } = await open(3);
    expect(within(dialog).getByRole('img', { name: '3 列 × 1 行の配置' })).toBeTruthy();
    expect(cellLabels(dialog)).toEqual(['1', '2', '3']);
  });
  it('leaves the extra cells blank when there are more cells than surfaces', async () => {
    const { user, dialog } = await open(3);
    await retype(user, '行', '2');
    expect(cellLabels(dialog)).toEqual(['1', '2', '3', '', '', '']);
  });
  it('says how many surfaces will not fit', async () => {
    const { user } = await open(3);
    await retype(user, '列', '2');
    expect(screen.getByText('マスに入らない 1 面は動きません')).toBeTruthy();
  });
});

describe('TilePopover apply', () => {
  it('applies the grid and closes', async () => {
    const { user, onApply } = await open(3);
    await retype(user, '間隔(px)', '20');
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ cols: 3, rows: 1, gap: 20 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('clamps counts to whole numbers of at least one', async () => {
    const { user, onApply } = await open(3);
    await retype(user, '列', '0');
    await retype(user, '行', '2.6');
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ cols: 1, rows: 3, gap: 0 });
  });
  it('blocks apply when the gap leaves no room', async () => {
    const { user } = await open(3);
    await retype(user, '間隔(px)', '2000');
    expect(screen.getByText('間隔が大きすぎてマスが作れません')).toBeTruthy();
    expect(screen.getByRole('button', { name: '適用' }).hasAttribute('disabled')).toBe(true);
  });
  it('opens from the keyboard and moves focus into the dialog', async () => {
    const user = userEvent.setup();
    render(<TilePopover subject={{ kind: 'surfaces', count: 2, onApply: vi.fn() }} canvas={canvas} />);
    await user.tab();
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: '敷き詰め' });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

const openGroup = async (count: number, direction: Direction, onApply = vi.fn()) => {
  const user = userEvent.setup();
  render(<TilePopover subject={{ kind: 'group', count, direction, onApply }} canvas={canvas} />);
  await user.click(screen.getByRole('button', { name: '敷き詰め' }));
  return { user, dialog: await screen.findByRole('dialog', { name: '敷き詰め' }), onApply };
};

const cellBoxes = (dialog: HTMLElement): { width: string; height: string }[] =>
  [...within(dialog).getByRole('img').children].map((c) => ({ width: (c as HTMLElement).style.width, height: (c as HTMLElement).style.height }));

describe('TilePopover for a group', () => {
  it('offers one row or one column instead of columns and rows', async () => {
    const { dialog } = await openGroup(2, 'row');
    expect(within(dialog).getByRole('group', { name: '向き' })).toBeTruthy();
    expect(within(dialog).getByRole('radio', { name: '横一列' })).toBeTruthy();
    expect(within(dialog).getByRole('radio', { name: '縦一列' })).toBeTruthy();
    expect(within(dialog).queryByLabelText('列')).toBeNull();
    expect(within(dialog).queryByLabelText('行')).toBeNull();
    expect(within(dialog).getByLabelText<HTMLInputElement>('間隔(px)').value).toBe('0');
  });
  it('starts from the direction the group already flows in', async () => {
    const { dialog } = await openGroup(3, 'column');
    expect(within(dialog).getByRole<HTMLInputElement>('radio', { name: '縦一列' }).checked).toBe(true);
    expect(within(dialog).getByRole('img', { name: '1 列 × 3 行の配置' })).toBeTruthy();
  });
  it('previews one numbered cell per child in layer order', async () => {
    const { dialog } = await openGroup(2, 'row');
    expect(cellLabels(dialog)).toEqual(['1', '2']);
    expect(cellBoxes(dialog)).toEqual([
      { width: '50%', height: '100%' },
      { width: '50%', height: '100%' },
    ]);
  });
  it('switches the preview when the direction changes', async () => {
    const { user, dialog } = await openGroup(2, 'row');
    await user.click(within(dialog).getByRole('radio', { name: '縦一列' }));
    expect(within(dialog).getByRole('img', { name: '1 列 × 2 行の配置' })).toBeTruthy();
  });
  it('applies the direction and gap and closes', async () => {
    const { user, dialog, onApply } = await openGroup(2, 'row');
    await user.click(within(dialog).getByRole('radio', { name: '縦一列' }));
    await retype(user, '間隔(px)', '12');
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ direction: 'column', gap: 12 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('blocks apply when the gap leaves no room', async () => {
    const { user } = await openGroup(2, 'row');
    await retype(user, '間隔(px)', '2000');
    expect(screen.getByText('間隔が大きすぎてマスが作れません')).toBeTruthy();
    expect(screen.getByRole('button', { name: '適用' }).hasAttribute('disabled')).toBe(true);
  });
});
