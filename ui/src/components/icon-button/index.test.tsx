// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UndoIcon } from '../icons';
import { IconButton } from '.';

afterEach(cleanup);

describe('IconButton', () => {
  it('is named by its label and hides the glyph', () => {
    render(<IconButton label="Undo" icon={<UndoIcon />} onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Undo' });
    expect(button.textContent).toBe('');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
  it('shows the label as a tooltip on keyboard focus', async () => {
    render(<IconButton label="Undo" icon={<UndoIcon />} onClick={vi.fn()} />);
    expect(screen.queryByRole('tooltip')).toBeNull();
    await userEvent.tab();
    expect(screen.getByRole('tooltip').textContent).toBe('Undo');
  });
  it('calls onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<IconButton label="Undo" icon={<UndoIcon />} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('describes a disabled button with its reason', () => {
    render(<IconButton label="Group" icon={<UndoIcon />} unavailable={{ reason: 'Select a surface' }} onClick={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Group', description: 'Select a surface' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.parentElement?.getAttribute('title')).toBe('Group (Select a surface)');
  });
  it('keeps the reason node hidden from sight', () => {
    render(<IconButton label="Group" icon={<UndoIcon />} unavailable={{ reason: 'Select a surface' }} onClick={vi.fn()} />);
    expect(screen.getByText('Select a surface', { ignore: 'none' }).hasAttribute('hidden')).toBe(true);
  });
});
