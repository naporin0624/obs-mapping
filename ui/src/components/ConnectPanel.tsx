import { useState } from 'react';
import { css } from '../../styled-system/css';
import type { ConnState } from '../obs/connection';
import type { ConnSettings } from '../obs/use-obs-connection';
import { buttonCls, buttonSolidCls, barCls, inputCls, labelCls, rowCls } from './styles';

const label = (s: ConnState): string => {
  switch (s.kind) {
    case 'idle':
      return '未接続';
    case 'connecting':
      return `接続中... (試行 ${String(s.attempt)})`;
    case 'open':
      return '接続済み';
    case 'waiting':
      return `再接続まで ${String(Math.ceil(s.retryInMs / 100) / 10)} 秒 (試行 ${String(s.attempt)})`;
    case 'auth_failed':
      return '認証に失敗しました。パスワードを確認してください';
  }
};

const statusCls = css({
  fontSize: '11px',
  color: 'fg.muted',
  '&[data-kind=open]': { color: 'accent.text' },
  '&[data-kind=auth_failed]': { color: 'danger.text' },
});

type Props = {
  initial: ConnSettings;
  state: ConnState;
  onConnect: (s: ConnSettings) => void;
  onDisconnect: () => void;
};

export const ConnectPanel = ({ initial, state, onConnect, onDisconnect }: Props) => {
  const [url, setUrl] = useState(initial.url);
  const [password, setPassword] = useState(initial.password);
  const active = state.kind === 'open' || state.kind === 'connecting' || state.kind === 'waiting';

  return (
    <form
      className={`${rowCls} ${barCls}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (active) onDisconnect();
        else onConnect({ url, password });
      }}
    >
      <label className={labelCls}>
        URL <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} disabled={active} />
      </label>
      <label className={labelCls}>
        Password <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={active} autoComplete="off" />
      </label>
      <button type="submit" className={active ? buttonCls : buttonSolidCls}>
        {active ? 'Disconnect' : 'Connect'}
      </button>
      <span role="status" className={statusCls} data-kind={state.kind}>
        {label(state)}
      </span>
    </form>
  );
};
