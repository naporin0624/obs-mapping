// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Selection } from '../../editor/state';
import { gn, groupOf, mapOf, sn, surf } from '../../geometry/fixtures';
import type { Mapping } from '../../model/mapping';
import { Inspector } from '.';

afterEach(cleanup);

const mapping: Mapping = {
  ...mapOf(surf('a', 0, 0), surf('b', 50, 0)),
  groups: [groupOf('g-1', { name: 'パネル列' })],
  layers: [gn('g-1', sn('a')), sn('b')],
};

const mount = (selection: Partial<Selection>) =>
  render(<Inspector mapping={mapping} selection={{ surfaceIds: [], groupIds: [], corner: null, ...selection }} shapeEdit={null} inputs={['src']} dispatch={vi.fn()} />);

const boundsField = (label: string): HTMLInputElement => {
  const bounds = screen.getByText('位置とサイズ').nextElementSibling;
  if (bounds === null) throw new Error('no bounds');
  return within(bounds as HTMLElement).getAllByLabelText(label)[0] as HTMLInputElement;
};

describe('Inspector field groups', () => {
  it.each(['位置とサイズ', '切り抜き'])('names the %s grid as a group', (name) => {
    mount({ surfaceIds: ['a'] });
    expect(within(screen.getByRole('group', { name })).getAllByLabelText('X').length).toBe(1);
  });
});

describe('Inspector', () => {
  it('shows GroupInspector for exactly one selected group', () => {
    mount({ groupIds: ['g-1'] });
    expect((screen.getByLabelText('名前') as HTMLInputElement).value).toBe('パネル列');
  });
  it('switches to bulk source editing for two or more selected items', () => {
    mount({ surfaceIds: ['b'], groupIds: ['g-1'] });
    expect(screen.getByText('2 レイヤーを選択中')).toBeTruthy();
    expect(screen.queryByLabelText('名前')).toBeNull();
  });
  it('tells that empty groups hold no layer to change', () => {
    mount({ groupIds: ['g-empty', 'g-gone'] });
    expect(screen.getByText('選択したグループにレイヤーがありません。')).toBeTruthy();
  });
  it('keeps the hint when nothing is selected', () => {
    mount({});
    expect(screen.getByText('面を 1 つ選択すると編集できます。')).toBeTruthy();
  });
  it('tells that the group decides the position of a grouped surface', () => {
    mount({ surfaceIds: ['a'] });
    expect(screen.getByText('グループが位置を決めています')).toBeTruthy();
  });
  it('disables Bounds X/Y but not W/H for a grouped surface', () => {
    mount({ surfaceIds: ['a'] });
    expect([boundsField('X').disabled, boundsField('Y').disabled, boundsField('W').disabled, boundsField('H').disabled]).toEqual([true, true, false, false]);
  });
  it('points X/Y at the hint with aria-describedby', () => {
    mount({ surfaceIds: ['a'] });
    const hint = screen.getByText('グループが位置を決めています');
    expect(boundsField('X').getAttribute('aria-describedby')).toBe(hint.id);
  });
  it('keeps the corner fields editable', () => {
    mount({ surfaceIds: ['a'], corner: { surfaceId: 'a', index: 0 } });
    const corner = screen.getByText('角 1').nextElementSibling;
    if (corner === null) throw new Error('no corner grid');
    expect((within(corner as HTMLElement).getByLabelText('X') as HTMLInputElement).disabled).toBe(false);
  });
  it('leaves a root-level surface fully editable without the hint', () => {
    mount({ surfaceIds: ['b'] });
    expect(screen.queryByText('グループが位置を決めています')).toBeNull();
    expect(boundsField('X').disabled).toBe(false);
  });
});
