import { cssMatrix3d } from '../../geometry/homography';
import type { Surface } from '../../model/mapping';
import { cropCls, imgCls } from './styles.css';

// The element is sized in "source units" (1000 per unit of crop); only ratios matter because
// cssMatrix3d maps the element's rectangle onto the quad.
const UNIT = 1000;

type Props = { surface: Surface; image: string | undefined; scale: number; visible: boolean };

/** One surface: the screenshot of its source, cropped, projected onto the quad with CSS matrix3d. */
export const StageSurface = ({ surface, image, scale, visible }: Props) => {
  const { crop, corners } = surface;
  const w = crop.width * UNIT;
  const h = crop.height * UNIT;
  const scaled = corners.map((p) => [p[0] * scale, p[1] * scale] as const) as unknown as Surface['corners'];
  const matrix = cssMatrix3d(w, h, scaled);
  if (matrix === null || image === undefined || !visible) return null;
  return (
    <div className={cropCls} style={{ width: w, height: h, transform: matrix }}>
      <img className={imgCls} src={image} alt="" draggable={false} style={{ width: UNIT, height: UNIT, left: -crop.x * UNIT, top: -crop.y * UNIT }} />
    </div>
  );
};
