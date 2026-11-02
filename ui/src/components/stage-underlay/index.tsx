import { useAtomValue } from 'jotai';
import { currentUnderlayAtom } from '../../atoms/underlay';
import { useT } from '../../i18n/use-t';
import { underlayCls } from './styles.css';

/** Stretched to fill its positioned parent; the aspect ratio is deliberately not preserved. */
export const UnderlayImage = ({ url, opacity }: { url: string; opacity: number }) => {
  const t = useT();
  return <img className={underlayCls} src={url} alt={t.underlayImageAlt} draggable={false} style={{ opacity }} />;
};

/** Editor-only reference image beneath the surfaces. Never sent to OBS. */
export const StageUnderlay = () => {
  const underlay = useAtomValue(currentUnderlayAtom);
  if (underlay?.kind !== 'image' || !underlay.visible) return null;
  return <UnderlayImage url={underlay.url} opacity={underlay.opacity} />;
};
