import { useEffect } from 'react';
import { css } from '../../styled-system/css';
import type { ToastMessage } from '../editor/use-sync';

const TOAST_MS = 5000;

const toastCls = css({
  position: 'fixed',
  top: '2',
  right: '2',
  maxWidth: '360px',
  bg: 'bg.canvas',
  color: 'fg.default',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'danger.solid',
  px: '3',
  py: '2',
  cursor: 'pointer',
  zIndex: 10,
});
const titleCls = css({ fontWeight: 700, fontSize: '12px', color: 'danger.text' });

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
