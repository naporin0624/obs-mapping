// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeObs, mapping } from '../../test/fake-obs';
import { buildStore } from '../../test/store-harness';
import { SourcePicker } from '.';

afterEach(cleanup);

describe('SourcePicker reload', () => {
  it('reloads sources from an icon-only button named 再読み込み', async () => {
    const { store, instances } = buildStore(fakeObs(mapping(10)));
    const reload = vi.spyOn(instances.session, 'reloadSources').mockResolvedValue(undefined);
    render(
      <Provider store={store}>
        <SourcePicker />
      </Provider>,
    );
    const button = screen.getByRole('button', { name: '再読み込み' });
    expect(button.textContent).toBe('');
    expect(button.querySelector('svg[data-icon="reload"]')).not.toBeNull();
    await userEvent.click(button);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
