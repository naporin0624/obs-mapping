// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceSelect, type SourceOption } from './SourceSelect';

const items: readonly SourceOption[] = [
  { id: 'Mapping', label: 'Mapping', detail: '1920x1080' },
  { id: 'Mapping-B', label: 'Mapping-B', detail: '1280x720' },
];

afterEach(cleanup);

const trigger = (): HTMLElement => screen.getByRole('button', { name: /Source/ });

describe('SourceSelect', () => {
  it('shows the placeholder when nothing is selected', () => {
    render(<SourceSelect label="Source" placeholder="Select a source" items={items} value={null} onChange={vi.fn()} />);
    expect(trigger().textContent).toContain('Select a source');
  });

  it('shows the selected label and detail in the trigger', () => {
    render(<SourceSelect label="Source" placeholder="Select a source" items={items} value="Mapping-B" onChange={vi.fn()} />);
    expect(trigger().textContent).toContain('Mapping-B');
    expect(trigger().textContent).toContain('1280x720');
  });

  it('supports aria-label instead of a visible label', () => {
    render(<SourceSelect ariaLabel="Source" placeholder="x" items={items} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Source/ })).toBeTruthy();
  });

  it('calls onChange with the id of the clicked option', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SourceSelect label="Source" placeholder="p" items={items} value={null} onChange={onChange} />);
    await user.click(trigger());
    await user.click(await screen.findByRole('option', { name: /Mapping-B/ }));
    expect(onChange).toHaveBeenCalledWith('Mapping-B');
  });

  it('calls onChange when picking with the keyboard', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SourceSelect label="Source" placeholder="p" items={items} value={null} onChange={onChange} />);
    trigger().focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(items.map((i) => i.id)).toContain(onChange.mock.calls[0]?.[0]);
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<SourceSelect label="Source" placeholder="No inputs" items={[]} value={null} isDisabled onChange={vi.fn()} />);
    expect((trigger() as HTMLButtonElement).disabled).toBe(true);
    await user.click(trigger());
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('reports open state changes', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<SourceSelect label="Source" placeholder="p" items={items} value={null} onChange={vi.fn()} onOpenChange={onOpenChange} />);
    await user.click(trigger());
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});
