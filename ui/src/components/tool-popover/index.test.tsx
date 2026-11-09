// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlignCenterHIcon, AlignLeftIcon, AlignTopIcon } from '../icons';
import { ToolPopover, type ToolItem } from '.';

afterEach(cleanup);

const rowsOf = (onLeft = vi.fn(), onTop = vi.fn()): readonly (readonly ToolItem[])[] => [
  [
    { id: 'left', label: '左揃え', icon: <AlignLeftIcon />, onAction: onLeft },
    { id: 'centerX', label: '左右中央', icon: <AlignCenterHIcon />, onAction: vi.fn() },
  ],
  [{ id: 'top', label: '上揃え', icon: <AlignTopIcon />, onAction: onTop }],
];

const open = async (rows = rowsOf()) => {
  const user = userEvent.setup();
  render(<ToolPopover label="整列" icon={<AlignLeftIcon />} rows={rows} />);
  await user.click(screen.getByRole('button', { name: '整列' }));
  return { user, dialog: await screen.findByRole('dialog', { name: '整列' }) };
};

describe('ToolPopover trigger', () => {
  it('is an icon-only button that says whether its popover is open', () => {
    render(<ToolPopover label="整列" icon={<AlignLeftIcon />} rows={rowsOf()} />);
    const trigger = screen.getByRole('button', { name: '整列' });
    expect(trigger.textContent).toBe('');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.querySelector('[data-icon="align-left"]')).not.toBeNull();
    expect(trigger.querySelector('[data-icon="caret-down"]')).not.toBeNull();
  });
  it('is disabled with its reason when unavailable', () => {
    render(<ToolPopover label="整列" icon={<AlignLeftIcon />} rows={rowsOf()} unavailable={{ reason: '面を選択' }} />);
    expect(screen.getByRole('button', { name: '整列', description: '面を選択' }).hasAttribute('disabled')).toBe(true);
  });
  it('shows its name as a tooltip on keyboard focus', async () => {
    render(<ToolPopover label="整列" icon={<AlignLeftIcon />} rows={rowsOf()} />);
    await userEvent.tab();
    expect(screen.getByRole('tooltip').textContent).toBe('整列');
  });
});

describe('ToolPopover items', () => {
  it('lists every item as a named icon button, row by row', async () => {
    const { dialog } = await open();
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['左揃え', '左右中央', '上揃え']);
  });
  it('runs the item and closes, returning focus to the trigger', async () => {
    const onTop = vi.fn();
    const { user, dialog } = await open(rowsOf(vi.fn(), onTop));
    await user.click(within(dialog).getByRole('button', { name: '上揃え' }));
    expect(onTop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '整列' })));
  });
  it('closes on Escape without running anything', async () => {
    const onLeft = vi.fn();
    const { user } = await open(rowsOf(onLeft));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onLeft).not.toHaveBeenCalled();
  });
});
