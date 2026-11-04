// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialMask } from '../../editor/mask-edit';
import type { ShapeEdit } from '../../editor/state';
import { surf } from '../../geometry/fixtures';
import type { Mask, Surface } from '../../model/mapping';
import { MaskFields } from '.';

afterEach(cleanup);

const withMask = (mask: Mask | undefined): Surface => ({ ...surf('a', 0, 0, 500, 500), ...(mask === undefined ? {} : { mask }) });

const mount = (mask: Mask | undefined, shapeEdit: ShapeEdit | null = null) => {
  const dispatch = vi.fn();
  render(<MaskFields surface={withMask(mask)} shapeEdit={shapeEdit} dispatch={dispatch} />);
  return dispatch;
};

const ellipse: Mask = { type: 'ellipse', x: 0.1, y: 0.2, width: 0.5, height: 0.4 };
const polygon: Mask = initialMask('polygon');

describe('MaskFields', () => {
  it('sends an initial ellipse when 円 is chosen', () => {
    const dispatch = mount(undefined);
    fireEvent.click(screen.getByLabelText('円'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'setMask', surfaceId: 'a', mask: initialMask('ellipse') });
  });
  it('sends an initial polygon when 多角形 is chosen', () => {
    const dispatch = mount(undefined);
    fireEvent.click(screen.getByLabelText('多角形'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'setMask', surfaceId: 'a', mask: initialMask('polygon') });
  });
  it('clears the mask when なし is chosen', () => {
    const dispatch = mount(ellipse);
    fireEvent.click(screen.getByLabelText('なし'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'setMask', surfaceId: 'a', mask: null });
  });
  it('converts an ellipse W entered in px back to a unit width', () => {
    const dispatch = mount(ellipse);
    const w = screen.getByLabelText('W');
    fireEvent.change(w, { target: { value: '500' } });
    fireEvent.blur(w);
    expect(dispatch).toHaveBeenCalledWith({ type: 'setMask', surfaceId: 'a', mask: { ...ellipse, width: 1 } });
  });
  it('shows ellipse fields in px', () => {
    mount(ellipse);
    expect((screen.getByLabelText('W') as HTMLInputElement).value).toBe('250');
  });
});

describe('MaskFields fields', () => {
  it('ignores a zero ellipse width', () => {
    const dispatch = mount(ellipse);
    const w = screen.getByLabelText('W');
    fireEvent.change(w, { target: { value: '0' } });
    fireEvent.blur(w);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('groups ellipse fields under the 円 name', () => {
    mount(ellipse);
    expect(within(screen.getByRole('group', { name: '円' })).getByLabelText('X')).toBeTruthy();
  });
  it('groups vertex fields under their heading', () => {
    mount(polygon, { surfaceId: 'a', vertex: 1 });
    expect(within(screen.getByRole('group', { name: '頂点 2' })).getByLabelText('X')).toBeTruthy();
  });
  it('ignores shape edit state of another surface', () => {
    mount(polygon, { surfaceId: 'other', vertex: 1 });
    expect(screen.queryByText('頂点 2')).toBeNull();
    expect(screen.queryByRole('button', { name: '編集を終える' })).toBeNull();
  });
  it('shows vertex fields only for a selected polygon vertex', () => {
    mount(polygon, { surfaceId: 'a', vertex: 1 });
    expect(screen.getByText('頂点 2')).toBeTruthy();
    expect((screen.getByLabelText('X') as HTMLInputElement).value).toBe('500');
  });
  it('hides vertex fields without a selected vertex', () => {
    mount(polygon, { surfaceId: 'a', vertex: null });
    expect(screen.queryByText('頂点 1')).toBeNull();
  });
  it('commits a vertex coordinate as a unit value', () => {
    const dispatch = mount(polygon, { surfaceId: 'a', vertex: 0 });
    const x = screen.getByLabelText('X');
    fireEvent.change(x, { target: { value: '250' } });
    fireEvent.blur(x);
    const call = dispatch.mock.calls[0]?.[0] as { mask: { points: number[][] } };
    expect(call.mask.points[0]).toEqual([0.5, 0]);
  });
});

describe('MaskFields exact commits', () => {
  const mountOdd = (mask: Mask, shapeEdit: ShapeEdit | null = null) => {
    const dispatch = vi.fn();
    render(<MaskFields surface={{ ...surf('a', 0, 0, 333, 333), mask }} shapeEdit={shapeEdit} dispatch={dispatch} />);
    return dispatch;
  };
  const sent = (dispatch: ReturnType<typeof vi.fn>): Mask | undefined => (dispatch.mock.calls[0]?.[0] as { mask: Mask } | undefined)?.mask;
  it('changes only the edited ellipse value', () => {
    const odd: Mask = { type: 'ellipse', x: 0.1, y: 0.7, width: 0.3, height: 0.9 };
    const dispatch = mountOdd(odd);
    const w = screen.getByLabelText('W');
    fireEvent.change(w, { target: { value: '200' } });
    fireEvent.blur(w);
    const mask = sent(dispatch);
    expect(mask?.type === 'ellipse' ? [mask.x, mask.y, mask.height] : []).toEqual([0.1, 0.7, 0.9]);
  });
  it('changes only the edited vertex', () => {
    const odd: Mask = {
      type: 'polygon',
      points: [
        [0.7, 0.1],
        [0.1, 0.9],
        [0.9, 0.3],
      ],
    };
    const dispatch = mountOdd(odd, { surfaceId: 'a', vertex: 0 });
    const x = screen.getByLabelText('X');
    fireEvent.change(x, { target: { value: '100' } });
    fireEvent.blur(x);
    const mask = sent(dispatch);
    const points = mask?.type === 'polygon' ? mask.points : [];
    expect(points[0]?.[1]).toBe(0.1);
    expect(points.slice(1)).toEqual([
      [0.1, 0.9],
      [0.9, 0.3],
    ]);
  });
});

describe('MaskFields edit button', () => {
  it('disables the edit button without a mask', () => {
    mount(undefined);
    expect((screen.getByRole('button', { name: '形を編集' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('enters shape edit', () => {
    const dispatch = mount(ellipse);
    fireEvent.click(screen.getByRole('button', { name: '形を編集' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'enterShapeEdit', surfaceId: 'a' });
  });
  it('exits shape edit with 編集を終える', () => {
    const dispatch = mount(ellipse, { surfaceId: 'a', vertex: null });
    fireEvent.click(within(document.body).getByRole('button', { name: '編集を終える' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'exitShapeEdit' });
  });
});
