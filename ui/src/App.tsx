import { useAtomValue, useSetAtom } from 'jotai';
import { lifecycleAtom } from './atoms/lifecycle';
import { connAtom, connectAtom, disconnectAtom, selectedSourceAtom, settingsAtom } from './atoms/session';
import { ConnectPanel } from './components/connect-panel';
import { Editor } from './components/editor';
import { LocaleProvider } from './i18n/locale-provider';
import { SourcePicker } from './components/source-picker';
import { Toast } from './components/toast';

export const App = () => {
  useAtomValue(lifecycleAtom);
  const conn = useAtomValue(connAtom);
  const settings = useAtomValue(settingsAtom);
  const selected = useAtomValue(selectedSourceAtom);
  const connect = useSetAtom(connectAtom);
  const disconnect = useSetAtom(disconnectAtom);
  const editable = conn.kind === 'open' || conn.kind === 'connecting' || conn.kind === 'waiting';

  return (
    <LocaleProvider>
      <main>
        <ConnectPanel initial={settings} state={conn} onConnect={connect} onDisconnect={disconnect} />
        {conn.kind === 'open' ? <SourcePicker /> : null}
        {selected !== null && editable ? <Editor /> : null}
        <Toast />
      </main>
    </LocaleProvider>
  );
};
