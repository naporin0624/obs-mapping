// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GridIcon } from '../icons';
import { NumField } from '.';

afterEach(cleanup);

describe('NumField', () => {
  it('shows the label as text by default', () => {
    render(<NumField label="Width" value={10} onCommit={vi.fn()} />);
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeTruthy();
    expect(screen.getByText('Width')).toBeTruthy();
  });
  it('commits a typed number on Enter', async () => {
    const onCommit = vi.fn();
    render(<NumField label="Width" value={10} onCommit={onCommit} />);
    const input = screen.getByRole('spinbutton', { name: 'Width' });
    await userEvent.clear(input);
    await userEvent.type(input, '42{Enter}');
    expect(onCommit).toHaveBeenCalledWith(42);
  });
});

describe('NumField with an icon', () => {
  it('keeps the label as the accessible name but shows only the glyph', () => {
    render(<NumField label="Grid" icon={<GridIcon />} value={10} onCommit={vi.fn()} />);
    const input = screen.getByRole('spinbutton', { name: 'Grid' });
    const label = input.closest('label');
    expect(label?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
  it('shows the label as a tooltip on keyboard focus', async () => {
    render(<NumField label="Grid" icon={<GridIcon />} value={10} onCommit={vi.fn()} />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('spinbutton', { name: 'Grid' }));
    expect(screen.getByRole('tooltip').textContent).toBe('Grid');
  });
});
