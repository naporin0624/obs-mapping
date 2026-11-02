// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { groupOf } from '../../geometry/fixtures';
import { GroupInspector } from '.';

afterEach(cleanup);

const group = groupOf('g-1', { name: 'パネル列', layout: { direction: 'row', gap: 20, align: 'start', padding: 4 } });

const setup = () => {
  const dispatch = vi.fn();
  render(<GroupInspector group={group} dispatch={dispatch} />);
  return dispatch;
};

describe('GroupInspector', () => {
  it('shows the group name', () => {
    setup();
    expect((screen.getByLabelText('名前') as HTMLInputElement).value).toBe('パネル列');
  });
  it('reflects the current direction and align in the radios', () => {
    setup();
    expect((screen.getByRole('radio', { name: '横に並べる' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: '先頭' }) as HTMLInputElement).checked).toBe(true);
  });
  it('groups the radios under their legends', () => {
    setup();
    expect(screen.getByRole('group', { name: '方向' })).toBeTruthy();
    expect(screen.getByRole('group', { name: '揃え' })).toBeTruthy();
  });
  it('patches direction to column', () => {
    const dispatch = setup();
    fireEvent.click(screen.getByRole('radio', { name: '縦に並べる' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'patchGroup', groupId: 'g-1', patch: { layout: { ...group.layout, direction: 'column' } } });
  });
  it('patches align to center', () => {
    const dispatch = setup();
    fireEvent.click(screen.getByRole('radio', { name: '中央' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'patchGroup', groupId: 'g-1', patch: { layout: { ...group.layout, align: 'center' } } });
  });
  it('sends gap on commit', () => {
    const dispatch = setup();
    const input = screen.getByLabelText('間隔');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.blur(input);
    expect(dispatch).toHaveBeenCalledWith({ type: 'patchGroup', groupId: 'g-1', patch: { layout: { ...group.layout, gap: 12 } } });
  });
  it('sends padding on commit', () => {
    const dispatch = setup();
    const input = screen.getByLabelText('余白');
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.blur(input);
    expect(dispatch).toHaveBeenCalledWith({ type: 'patchGroup', groupId: 'g-1', patch: { layout: { ...group.layout, padding: 8 } } });
  });
  it('renames the group', () => {
    const dispatch = setup();
    const input = screen.getByLabelText('名前');
    fireEvent.change(input, { target: { value: '列' } });
    fireEvent.blur(input);
    expect(dispatch).toHaveBeenCalledWith({ type: 'patchGroup', groupId: 'g-1', patch: { name: '列' } });
  });
});

describe('GroupInspector field edge cases', () => {
  it('reverts an emptied name to the stored one', () => {
    setup();
    const input = screen.getByLabelText('名前') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('パネル列');
  });
  it('shows the clamped gap and padding the store holds after an oversized commit', () => {
    const clamped = groupOf('g-1', { name: 'パネル列', layout: { direction: 'row', gap: 4096, align: 'start', padding: 4096 } });
    render(<GroupInspector group={clamped} dispatch={vi.fn()} />);
    const gap = screen.getByLabelText('間隔') as HTMLInputElement;
    fireEvent.change(gap, { target: { value: '5000' } });
    fireEvent.blur(gap);
    expect([gap.value, (screen.getByLabelText('余白') as HTMLInputElement).value]).toEqual(['4096', '4096']);
  });
});
