import { useState } from 'react';
import { ConnectPanel } from './components/ConnectPanel';
import { SourcePicker } from './components/SourcePicker';
import { useObsConnection } from './obs/use-obs-connection';
import { DEFAULT_URL, readStored, STORAGE_KEYS, writeStored } from './storage';

// read once at load; the app auto-connects with these on mount
const initialSettings = { url: readStored(STORAGE_KEYS.url, DEFAULT_URL), password: readStored(STORAGE_KEYS.password, '') };

export const App = () => {
  const { state, client, connect, disconnect } = useObsConnection(initialSettings);
  const [source, setSource] = useState(() => readStored(STORAGE_KEYS.source, ''));

  return (
    <main>
      <ConnectPanel
        initial={initialSettings}
        state={state}
        onConnect={(s) => {
          writeStored(STORAGE_KEYS.url, s.url);
          writeStored(STORAGE_KEYS.password, s.password);
          connect(s);
        }}
        onDisconnect={disconnect}
      />
      {state.kind === 'open' ? (
        <SourcePicker
          client={client}
          selected={source}
          onSelect={(name) => {
            writeStored(STORAGE_KEYS.source, name);
            setSource(name);
          }}
        />
      ) : null}
    </main>
  );
};
