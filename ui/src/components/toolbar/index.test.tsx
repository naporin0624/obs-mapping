// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from '.';

afterEach(cleanup);

const show = (selectedCount: number) =>
  render(<Toolbar dispatch={vi.fn()} canUndo={false} canRedo={false} selectedCount={selectedCount} gridSize={10} overlayEnabled={false} onToggleOverlay={vi.fn()} />);

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
