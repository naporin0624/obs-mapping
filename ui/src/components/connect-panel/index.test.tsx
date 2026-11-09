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
    const button = screen.getByRole('button', { name: '接続' });
    button.focus();
    rerender(panel('ws://b:4455', 'secret'));
    expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe('ws://b:4455');
    expect((screen.getByLabelText('パスワード') as HTMLInputElement).value).toBe('secret');
    expect(screen.getByRole('button', { name: '接続' })).toBe(button);
    expect(document.activeElement).toBe(button);
  });
});

describe('ConnectPanel password reveal', () => {
  afterEach(cleanup);

  const withState = (state: ConnState, onConnect: () => void = noop) => <ConnectPanel initial={{ url: 'ws://a:4455', password: 'hunter2' }} state={state} onConnect={onConnect} onDisconnect={noop} />;
  const input = () => screen.getByLabelText('パスワード') as HTMLInputElement;
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

describe('ConnectPanel icon controls', () => {
  afterEach(cleanup);

  const withState = (state: ConnState, onConnect: () => void = noop, onDisconnect: () => void = noop) => (
    <ConnectPanel initial={{ url: 'ws://a:4455', password: 'pw' }} state={state} onConnect={onConnect} onDisconnect={onDisconnect} />
  );
  const glyph = (name: string) => screen.getByRole('button', { name }).querySelector('svg')?.getAttribute('data-icon');

  it('shows an eye while hidden and a crossed eye while revealed, with no visible text', async () => {
    render(withState({ kind: 'idle' }));
    expect(screen.getByRole('button', { name: '表示' }).textContent).toBe('');
    expect(glyph('表示')).toBe('eye');
    await userEvent.click(screen.getByRole('button', { name: '表示' }));
    expect(glyph('隠す')).toBe('eye-off');
  });

  it('connects from an icon-only submit button showing a plug', async () => {
    const onConnect = vi.fn();
    render(withState({ kind: 'idle' }, onConnect));
    const button = screen.getByRole('button', { name: '接続' });
    expect(button.getAttribute('type')).toBe('submit');
    expect(button.textContent).toBe('');
    expect(glyph('接続')).toBe('plug');
    await userEvent.click(button);
    expect(onConnect).toHaveBeenCalledWith({ url: 'ws://a:4455', password: 'pw' });
  });

  it('disconnects from the same submit button showing an unplugged plug', async () => {
    const onDisconnect = vi.fn();
    render(withState({ kind: 'open' }, noop, onDisconnect));
    const button = screen.getByRole('button', { name: '切断' });
    expect(button.getAttribute('type')).toBe('submit');
    expect(glyph('切断')).toBe('unplug');
    await userEvent.click(button);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('shows the current label as a tooltip on keyboard focus', async () => {
    render(withState({ kind: 'open' }));
    screen.getByRole('button', { name: '切断' }).focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}');
    expect(screen.getByRole('tooltip').textContent).toBe('切断');
  });
});
