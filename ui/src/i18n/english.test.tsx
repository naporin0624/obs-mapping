// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import type { ReactNode } from 'react';
import { useLocale } from 'react-aria-components';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Inspector } from '../components/inspector';
import { Toolbar } from '../components/toolbar';
import { gn, groupOf, mapOf, sn, surf } from '../geometry/fixtures';
import type { Selection } from '../editor/state';
import type { Mapping } from '../model/mapping';
import { LocaleProvider } from './locale-provider';
import { localeAtom, type Locale } from './locale';

afterEach(cleanup);

const storeOf = (locale: Locale) => {
  const store = createStore();
  store.set(localeAtom, locale);
  return store;
};

const mapping: Mapping = {
  ...mapOf(surf('a', 0, 0), surf('b', 50, 0)),
  groups: [groupOf('g-1')],
  layers: [gn('g-1', sn('a')), sn('b')],
};

const inEnglish = (ui: ReactNode) => render(<Provider store={storeOf('en')}>{ui}</Provider>);

const inspect = (selection: Partial<Selection>) => inEnglish(<Inspector mapping={mapping} selection={{ surfaceIds: [], groupIds: [], corner: null, ...selection }} inputs={[]} dispatch={vi.fn()} />);

const toolbar = () => (
  <Toolbar
    dispatch={vi.fn()}
    canUndo={false}
    canRedo={false}
    selectedCount={0}
    immovableReason={null}
    canGroup={false}
    canUngroup={false}
    onGroup={vi.fn()}
    gridSize={10}
    overlayEnabled={false}
    onToggleOverlay={vi.fn()}
  />
);

const LocaleProbe = () => <span data-testid="rac-locale">{useLocale().locale}</span>;

const probed = (store: ReturnType<typeof storeOf>) => (
  <Provider store={store}>
    <LocaleProvider>
      <LocaleProbe />
    </LocaleProvider>
  </Provider>
);

describe('English locale', () => {
  it('renders the toolbar in English', () => {
    inEnglish(toolbar());
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Left' })).toBeTruthy();
    expect(screen.getByText('Select a surface')).toBeTruthy();
    expect(screen.queryByText('元に戻す')).toBeNull();
  });

  it('keeps the group action distinct from the toolbar section label', () => {
    inEnglish(toolbar());
    expect(screen.getByText('Group')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Group selection' })).toBeTruthy();
  });

  it('renders the surface inspector in English', () => {
    inspect({ surfaceIds: ['a'] });
    expect(screen.getByText('Position is set by the group')).toBeTruthy();
    expect(screen.getByText('Bounds')).toBeTruthy();
    expect(screen.getByText('Crop')).toBeTruthy();
  });

  it('renders the group inspector in English', () => {
    inspect({ groupIds: ['g-1'] });
    expect(screen.getByText('Direction')).toBeTruthy();
    expect(screen.getByLabelText('Arrange in a row')).toBeTruthy();
  });
});

describe('LocaleProvider', () => {
  it('hands the locale to react-aria-components and follows changes', () => {
    const store = storeOf('en');
    const { rerender } = render(probed(store));
    expect(screen.getByTestId('rac-locale').textContent).toBe('en');
    store.set(localeAtom, 'ja');
    rerender(probed(store));
    expect(screen.getByTestId('rac-locale').textContent).toBe('ja');
  });
});
