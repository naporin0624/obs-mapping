import { useState, type CSSProperties } from 'react';
import { Button, Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components';
import type { Bounds } from '../../geometry/rect';
import { lineGrid, tileCells, type LineTile, type TileGrid } from '../../geometry/tile';
import type { Messages } from '../../i18n/messages';
import { useT } from '../../i18n/use-t';
import type { Direction } from '../../model/mapping';
import { NumField } from '../field';
import { IconButton, type Unavailable } from '../icon-button';
import { TileIcon } from '../icons';
import { Segmented, type Option } from '../segmented';
import { buttonSolidCls } from '../styles.css';
import { actionsCls, cellCls, dialogCls, fieldsCls, filledCellCls, hintCls, noteCls, popoverCls, previewCls, titleCls } from './styles.css';

type Canvas = { width: number; height: number };

export type TileSubject = { kind: 'surfaces'; count: number; onApply: (grid: TileGrid) => void } | { kind: 'group'; count: number; direction: Direction; onApply: (line: LineTile) => void };

const wholeCount = (v: number): number => Math.max(1, Math.round(v));

const cellStyle = (cell: Bounds, canvas: Canvas): CSSProperties => ({
  left: `${(cell.x / canvas.width) * 100}%`,
  top: `${(cell.y / canvas.height) * 100}%`,
  width: `${(cell.width / canvas.width) * 100}%`,
  height: `${(cell.height / canvas.height) * 100}%`,
});

type PreviewProps = { cells: readonly Bounds[]; count: number; canvas: Canvas; label: string };

/** The canvas in miniature; a cell shows the number of the surface that will fill it. */
const Preview = ({ cells, count, canvas, label }: PreviewProps) => (
  <div role="img" aria-label={label} className={previewCls} style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}>
    {cells.map((cell, i) => (
      <span key={`${cell.x}-${cell.y}`} className={i < count ? filledCellCls : cellCls} style={cellStyle(cell, canvas)}>
        {i < count ? String(i + 1) : ''}
      </span>
    ))}
  </div>
);

type ApplyRowProps = { noRoom: boolean; onApply: () => void };

const ApplyRow = ({ noRoom, onApply }: ApplyRowProps) => {
  const t = useT();
  return (
    <>
      {noRoom && <p className={noteCls}>{t.tileNoRoom}</p>}
      <div className={actionsCls}>
        <Button className={buttonSolidCls} isDisabled={noRoom} onPress={onApply}>
          {t.tileApply}
        </Button>
      </div>
    </>
  );
};

type GridFormProps = { count: number; canvas: Canvas; onApply: (grid: TileGrid) => void };

const GridForm = ({ count, canvas, onApply }: GridFormProps) => {
  const t = useT();
  const [grid, setGrid] = useState<TileGrid>({ cols: Math.max(1, count), rows: 1, gap: 0 });
  const cells = tileCells({ x: 0, y: 0, ...canvas }, grid);
  const overflow = cells.length === 0 ? 0 : count - cells.length;
  return (
    <>
      <div className={fieldsCls}>
        <NumField label={t.tileColumns} value={grid.cols} onCommit={(v) => setGrid({ ...grid, cols: wholeCount(v) })} />
        <NumField label={t.tileRows} value={grid.rows} onCommit={(v) => setGrid({ ...grid, rows: wholeCount(v) })} />
        <NumField label={t.tileGap} value={grid.gap} onCommit={(v) => setGrid({ ...grid, gap: Math.max(0, v) })} />
      </div>
      <Preview cells={cells} count={count} canvas={canvas} label={t.tilePreview(grid.cols, grid.rows)} />
      {overflow > 0 && <p className={noteCls}>{t.tileOverflow(overflow)}</p>}
      <ApplyRow noRoom={cells.length === 0} onApply={() => onApply(grid)} />
    </>
  );
};

const linesOf = (t: Messages): readonly Option<Direction>[] => [
  { value: 'row', label: t.tileLineRow },
  { value: 'column', label: t.tileLineColumn },
];

type LineFormProps = { count: number; direction: Direction; canvas: Canvas; onApply: (line: LineTile) => void };

/** A group flows one way only, so it is split into a single row or column. */
const LineForm = ({ count, direction, canvas, onApply }: LineFormProps) => {
  const t = useT();
  const [line, setLine] = useState<LineTile>({ direction, gap: 0 });
  const grid = lineGrid(count, line);
  const cells = tileCells({ x: 0, y: 0, ...canvas }, grid);
  return (
    <>
      <Segmented legend={t.tileDirection} options={linesOf(t)} value={line.direction} onChange={(d) => setLine({ ...line, direction: d })} />
      <div className={fieldsCls}>
        <NumField label={t.tileGap} value={line.gap} onCommit={(v) => setLine({ ...line, gap: Math.max(0, v) })} />
      </div>
      <Preview cells={cells} count={count} canvas={canvas} label={t.tilePreview(grid.cols, grid.rows)} />
      <ApplyRow noRoom={cells.length === 0} onApply={() => onApply(line)} />
    </>
  );
};

type BodyProps = { subject: TileSubject; canvas: Canvas; close: () => void };

const TileBody = ({ subject, canvas, close }: BodyProps) => {
  const t = useT();
  switch (subject.kind) {
    case 'surfaces':
      return (
        <>
          <p className={hintCls}>{t.tileHint}</p>
          <GridForm
            count={subject.count}
            canvas={canvas}
            onApply={(grid) => {
              subject.onApply(grid);
              close();
            }}
          />
        </>
      );
    case 'group':
      return (
        <>
          <p className={hintCls}>{t.tileGroupHint}</p>
          <LineForm
            count={subject.count}
            direction={subject.direction}
            canvas={canvas}
            onApply={(line) => {
              subject.onApply(line);
              close();
            }}
          />
        </>
      );
  }
};

type Props = { subject: TileSubject; canvas: Canvas; unavailable?: Unavailable };

/** Toolbar button whose popover splits the canvas into equal cells and fits the selected surfaces or group into them. */
export const TilePopover = ({ subject, canvas, unavailable }: Props) => {
  const t = useT();
  return (
    <DialogTrigger>
      <IconButton label={t.tileAction} icon={<TileIcon />} unavailable={unavailable} />
      <Popover className={popoverCls} placement="bottom start" offset={6}>
        <Dialog className={dialogCls}>
          {({ close }) => (
            <>
              <Heading slot="title" className={titleCls}>
                {t.tileAction}
              </Heading>
              <TileBody subject={subject} canvas={canvas} close={close} />
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};
