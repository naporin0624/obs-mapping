import '../index.css';
import { Provider, createStore } from 'jotai';
import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../App';
import { createInstances, instancesAtom } from '../atoms/instances';
import { buttonCls, rowCls } from '../components/styles.css';
import { debugCls, debugTitleCls, logCls, logPanelCls } from './styles.css';
import { createFakeConnection, createMockLog } from './fake-connection';

const params = new URLSearchParams(location.search);
const log = createMockLog(params.get('failLoad') === '1');

const memory = new Map<string, string>();
const store = createStore();
store.set(
  instancesAtom,
  createInstances({
    connection: createFakeConnection(log, Number(params.get('delay') ?? 800)),
    storage: { read: (key, fallback) => memory.get(key) ?? fallback, write: (key, value) => void memory.set(key, value) },
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  }),
);

const Debug = () => {
  useSyncExternalStore(log.subscribe, log.count);
  return (
    <section aria-label="Mock debug" className={debugCls}>
      <h2 className={debugTitleCls}>Mock debug</h2>
      <div className={rowCls}>
        <button type="button" className={buttonCls} onClick={log.armGet}>
          Fail next GetMapping
        </button>
        <button type="button" className={buttonCls} onClick={log.drop}>
          Drop connection
        </button>
        <button type="button" className={buttonCls} onClick={log.armSet}>
          Refuse next SetMapping
        </button>
      </div>
      <section aria-labelledby="mock-log-title" className={logPanelCls}>
        <h3 id="mock-log-title" className={debugTitleCls}>
          Request log
        </h3>
        <pre data-testid="mock-log" className={logCls}>
          {log.recent().join('\n')}
        </pre>
      </section>
    </section>
  );
};

const root = document.getElementById('root');
if (root === null) throw new Error('#root not found');
createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <App />
      <Debug />
    </Provider>
  </StrictMode>,
);
