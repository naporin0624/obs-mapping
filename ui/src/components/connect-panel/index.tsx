import { useId, useState } from 'react';
import type { Messages } from '../../i18n/messages';
import { useT } from '../../i18n/use-t';
import type { ConnState } from '../../obs/connection';
import type { ConnSettings } from '../../app/obs-session';
import { IconButton } from '../icon-button';
import { EyeIcon, EyeOffIcon, PlugIcon, UnplugIcon } from '../icons';
import { barCls, inputCls, labelCls, rowCls } from '../styles.css';
import { statusCls } from './styles.css';

const label = (t: Messages, s: ConnState): string => {
  switch (s.kind) {
    case 'idle':
      return t.connectIdle;
    case 'connecting':
      return t.connectConnecting(s.attempt);
    case 'open':
      return t.connectOpen;
    case 'waiting':
      return t.connectWaiting(Math.ceil(s.retryInMs / 100) / 10, s.attempt);
    case 'auth_failed':
      return t.connectAuthFailed;
  }
};

const useRevealUntilOpen = (open: boolean) => {
  const [revealed, setRevealed] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setRevealed(false);
  }
  return [revealed, () => setRevealed((r) => !r)] as const;
};

type Props = {
  initial: ConnSettings;
  state: ConnState;
  onConnect: (s: ConnSettings) => void;
  onDisconnect: () => void;
};

export const ConnectPanel = ({ initial, state, onConnect, onDisconnect }: Props) => {
  const t = useT();
  const [url, setUrl] = useState(initial.url);
  const [password, setPassword] = useState(initial.password);
  const [adopted, setAdopted] = useState(initial);
  if (adopted.url !== initial.url || adopted.password !== initial.password) {
    setAdopted(initial);
    setUrl(initial.url);
    setPassword(initial.password);
  }
  const passwordId = useId();
  const [revealed, toggleReveal] = useRevealUntilOpen(state.kind === 'open');
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
        {t.connectUrl} <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} disabled={active} />
      </label>
      <span className={labelCls}>
        <label htmlFor={passwordId}>{t.connectPassword}</label>
        <input id={passwordId} className={inputCls} type={revealed ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} disabled={active} autoComplete="off" />
        <IconButton label={revealed ? t.connectHide : t.connectReveal} icon={revealed ? <EyeOffIcon /> : <EyeIcon />} controls={passwordId} onClick={toggleReveal} />
      </span>
      <IconButton type="submit" label={active ? t.connectDisconnect : t.connectConnect} icon={active ? <UnplugIcon /> : <PlugIcon />} solid={!active} />
      <span role="status" className={statusCls} data-kind={state.kind}>
        {label(t, state)}
      </span>
    </form>
  );
};
