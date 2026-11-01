import { useState } from 'react';
import { css } from '../../styled-system/css';
import type { ConnState } from '../obs/connection';
import type { ConnSettings } from '../obs/use-obs-connection';
import { buttonCls, inputCls, labelCls, rowCls } from './styles';

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
  color: 'text.dim',
  '&[data-kind=open]': { color: 'accent' },
  '&[data-kind=auth_failed]': { color: 'danger' },
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
      className={`${rowCls} ${css({ px: '8px', py: '6px', bg: 'bg.panel', borderBottom: '1px solid token(colors.line)' })}`}
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
        パスワード <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={active} autoComplete="off" />
      </label>
      <button type="submit" className={buttonCls}>
        {active ? '切断' : '接続'}
      </button>
      <span role="status" className={statusCls} data-kind={state.kind}>
        {label(state)}
      </span>
    </form>
  );
};
