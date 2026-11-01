import { useAtomValue } from 'jotai';
import { currentUnderlayAtom } from '../../atoms/underlay';
import { underlayCls } from './styles.css';

/** Stretched to fill its positioned parent; the aspect ratio is deliberately not preserved. */
export const UnderlayImage = ({ url, opacity }: { url: string; opacity: number }) => <img className={underlayCls} src={url} alt="下地画像" draggable={false} style={{ opacity }} />;

/** Editor-only reference image beneath the surfaces. Never sent to OBS. */
export const StageUnderlay = () => {
  const underlay = useAtomValue(currentUnderlayAtom);
  if (underlay?.kind !== 'image' || !underlay.visible) return null;
  return <UnderlayImage url={underlay.url} opacity={underlay.opacity} />;
};
