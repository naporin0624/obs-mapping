import { useEffect } from 'react';
import type { ToastMessage } from '../../editor/use-sync';
import { toastCls, titleCls } from './styles.css';

const TOAST_MS = 5000;

type Props = { toast: ToastMessage | null; onDismiss: () => void };

/** Error toast; dismisses itself after 5 s (a new message restarts the timer) or on click. */
export const Toast = ({ toast, onDismiss }: Props) => {
  const id = toast?.id;
  useEffect(() => {
    if (id === undefined) return undefined;
    const t = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(t);
  }, [id, onDismiss]);

  return toast === null ? null : (
    <div role="alert" className={toastCls} onClick={onDismiss}>
      <div className={titleCls}>Error</div>
      <div>{toast.text}</div>
    </div>
  );
};
