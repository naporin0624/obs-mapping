// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConnState } from '../../obs/connection';
import { ConnectPanel } from '.';

const noop = (): void => undefined;
const panel = (url: string, password: string) => <ConnectPanel initial={{ url, password }} state={{ kind: 'idle' }} onConnect={noop} onDisconnect={noop} />;

describe('ConnectPanel', () => {
  afterEach(cleanup);

  it('adopts restored settings and keeps the focused Connect button mounted', () => {
    const { rerender } = render(panel('ws://a:4455', ''));
    const button = screen.getByRole('button', { name: 'Connect' });
    button.focus();
    rerender(panel('ws://b:4455', 'secret'));
    expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe('ws://b:4455');
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('secret');
    expect(screen.getByRole('button', { name: 'Connect' })).toBe(button);
    expect(document.activeElement).toBe(button);
  });
});

describe('ConnectPanel password reveal', () => {
  afterEach(cleanup);

  const withState = (state: ConnState, onConnect: () => void = noop) => <ConnectPanel initial={{ url: 'ws://a:4455', password: 'hunter2' }} state={state} onConnect={onConnect} onDisconnect={noop} />;
  const input = () => screen.getByLabelText('Password') as HTMLInputElement;
  const toggle = () => screen.getByRole('button', { name: /^(表示|隠す)$/ });
  const showBtn = () => screen.getByRole('button', { name: '表示' });
  const hideBtn = () => screen.getByRole('button', { name: '隠す' });

  it('hides the password by default and flips type and accessible name on toggle', async () => {
    render(withState({ kind: 'idle' }));
    expect(input().type).toBe('password');
    expect(showBtn().hasAttribute('aria-pressed')).toBe(false);
    expect(toggle().getAttribute('aria-controls')).toBe(input().id);
    await userEvent.click(toggle());
    expect(input().type).toBe('text');
    expect(input().value).toBe('hunter2');
    expect(hideBtn().hasAttribute('aria-pressed')).toBe(false);
    await userEvent.click(toggle());
    expect(input().type).toBe('password');
  });

  it('does not submit the form and keeps focus on the toggle', async () => {
    const onConnect = vi.fn();
    render(withState({ kind: 'idle' }, onConnect));
    await userEvent.click(toggle());
    expect(onConnect).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(toggle());
  });

  it('re-hides the password when the connection opens', async () => {
    const { rerender } = render(withState({ kind: 'idle' }));
    await userEvent.click(toggle());
    expect(input().type).toBe('text');
    rerender(withState({ kind: 'connecting', attempt: 1 }));
    expect(input().type).toBe('text');
    rerender(withState({ kind: 'open' }));
    expect(input().type).toBe('password');
    expect(showBtn()).toBeTruthy();
  });
});
