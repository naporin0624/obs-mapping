// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { Provider } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectSourceAtom } from '../../atoms/session';
import { chooseUnderlayAtom, toggleUnderlayAtom, underlayDepsAtom } from '../../atoms/underlay';
import { fakeObs, mapping } from '../../test/fake-obs';
import { buildStore } from '../../test/store-harness';
import { createMemoryUnderlayStore } from '../../underlay/memory-store';
import { StageUnderlay, UnderlayImage } from '.';

afterEach(cleanup);

const setup = async () => {
  const { store } = buildStore(fakeObs(mapping(10)));
  store.set(underlayDepsAtom, { store: createMemoryUnderlayStore(), createUrl: () => 'blob:1', revokeUrl: vi.fn() });
  await act(async () => {
    store.set(selectSourceAtom, 'Map');
    await store.set(chooseUnderlayAtom, 'Map', new File(['x'], 'a.png', { type: 'image/png' }));
  });
  render(
    <Provider store={store}>
      <StageUnderlay />
    </Provider>,
  );
  return store;
};

describe('UnderlayImage', () => {
  it('renders the url at the given opacity, undraggable', () => {
    render(<UnderlayImage url="blob:x" opacity={0.3} />);
    const img = screen.getByAltText('下地画像');
    expect(img.getAttribute('src')).toBe('blob:x');
    expect(img.style.opacity).toBe('0.3');
    expect(img.getAttribute('draggable')).toBe('false');
  });
});

describe('StageUnderlay', () => {
  it('draws the chosen image for the selected source', async () => {
    await setup();
    expect(screen.getByAltText('下地画像').getAttribute('src')).toBe('blob:1');
  });

  it('draws nothing while hidden', async () => {
    const store = await setup();
    await act(() => store.set(toggleUnderlayAtom));
    expect(screen.queryByAltText('下地画像')).toBeNull();
  });

  it('draws nothing for a different selected source', async () => {
    const store = await setup();
    await act(async () => store.set(selectSourceAtom, 'Other'));
    expect(screen.queryByAltText('下地画像')).toBeNull();
  });
});
