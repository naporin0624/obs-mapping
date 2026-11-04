// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { surf } from '../../geometry/fixtures';
import type { Surface } from '../../model/mapping';
import { BulkSourceFields } from '.';

afterEach(cleanup);

const layer = (id: string, name: string, source: string): Surface => ({ ...surf(id, 0, 0), name, source });

const mixed = [layer('a', 'Left wall', 'cam-A'), layer('b', 'Floor 3', '')];

const mount = (targets: readonly Surface[], dispatch = vi.fn()) => {
  render(<BulkSourceFields targets={targets} inputs={['cam-A', 'cam-B']} counts={new Map([['cam-A', 1]])} dispatch={dispatch} />);
  return dispatch;
};

const trigger = (): HTMLElement => screen.getByRole('button', { name: /ソース/ });

describe('BulkSourceFields', () => {
  it('heads the panel with the number of target layers', () => {
    mount(mixed);
    expect(screen.getByText('2 レイヤーを選択中')).toBeTruthy();
  });
  it('shows the shared source when every target uses it', () => {
    mount([layer('a', 'A', 'cam-A'), layer('b', 'B', 'cam-A')]);
    expect(trigger().textContent).toContain('cam-A');
  });
  it('shows unassigned when every target is unassigned', () => {
    mount([layer('a', 'A', ''), layer('b', 'B', '')]);
    expect(trigger().textContent).toContain('未割当');
  });
  it('shows how many kinds are mixed', () => {
    mount(mixed);
    expect(trigger().textContent).toContain('混在 (2種)');
  });
  it('lists every target with its current source', () => {
    mount(mixed);
    const items = within(screen.getByRole('list', { name: '変更されるレイヤー' })).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['Left wallcam-A', 'Floor 3(未割当)']);
  });
  it('sets the picked source on every target at once', async () => {
    const user = userEvent.setup();
    const dispatch = mount(mixed);
    await user.click(trigger());
    await user.click(await screen.findByRole('option', { name: /cam-B/ }));
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ type: 'setSources', surfaceIds: ['a', 'b'], source: 'cam-B' });
  });
  it('offers a target source that OBS no longer lists', async () => {
    const user = userEvent.setup();
    mount([layer('a', 'A', 'gone'), layer('b', 'B', 'cam-A')]);
    await user.click(trigger());
    expect(await screen.findByRole('option', { name: /gone/ })).toBeTruthy();
  });
  it('shows a hint instead of the fields when there is no target', () => {
    mount([]);
    expect(screen.getByText('選択したグループにレイヤーがありません。')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /ソース/ })).toBeNull();
  });
});
