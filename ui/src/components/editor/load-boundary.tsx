import { Component, Suspense, type ReactNode } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { localizeError } from '../../i18n/localize-error';
import { useT } from '../../i18n/use-t';
import { retryLoadAtom } from '../../atoms/mapping';
import { selectedSourceAtom } from '../../atoms/session';
import { reportErrorAtom } from '../../atoms/toast';
import { buttonCls } from '../styles.css';
import { noteCls } from './styles.css';

type BoundaryProps = { children: ReactNode; onError: (error: Error) => void; fallback: (error: Error, reset: () => void) => ReactNode };
type BoundaryState = { error: Error | null };

class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    return error === null ? this.props.children : this.props.fallback(error, this.reset);
  }
}

/** First-load Suspense fallback plus the load-failure message (and one toast) with Retry; resets per source. */
export const LoadBoundary = ({ children }: { children: ReactNode }) => {
  const t = useT();
  const retry = useSetAtom(retryLoadAtom);
  const report = useSetAtom(reportErrorAtom);
  const selected = useAtomValue(selectedSourceAtom);
  const failed = (error: Error, reset: () => void): ReactNode => (
    <div className={noteCls}>
      {t.editorLoadFailed(localizeError(t, error.message))}
      <button
        type="button"
        className={buttonCls}
        onClick={() => {
          retry();
          reset();
        }}
      >
        {t.editorRetry}
      </button>
    </div>
  );
  return (
    <ErrorBoundary key={selected} fallback={failed} onError={(error) => report(error.message)}>
      <Suspense fallback={<div className={noteCls}>{t.editorLoading}</div>}>{children}</Suspense>
    </ErrorBoundary>
  );
};
