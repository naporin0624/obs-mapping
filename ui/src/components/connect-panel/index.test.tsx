// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
