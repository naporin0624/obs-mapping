import type { ReactNode } from 'react';
import { Dialog, DialogTrigger, Popover } from 'react-aria-components';
import { IconButton, type Unavailable } from '../icon-button';
import { CaretDownIcon } from '../icons';
import { dialogCls, popoverCls, rowCls, triggerIconCls } from './styles.css';

export type ToolItem = { id: string; label: string; icon: ReactNode; onAction: () => void };

type RowProps = { items: readonly ToolItem[]; close: () => void };

const ToolRow = ({ items, close }: RowProps) => (
  <div className={rowCls}>
    {items.map((item) => (
      <IconButton
        key={item.id}
        label={item.label}
        icon={item.icon}
        onClick={() => {
          item.onAction();
          close();
        }}
      />
    ))}
  </div>
);

type Props = { label: string; icon: ReactNode; rows: readonly (readonly ToolItem[])[]; unavailable?: Unavailable };

/** One toolbar button standing for a family of icon actions; picking one runs it and closes the popover. */
export const ToolPopover = ({ label, icon, rows, unavailable }: Props) => (
  <DialogTrigger>
    <IconButton
      label={label}
      icon={
        <span className={triggerIconCls}>
          {icon}
          <CaretDownIcon />
        </span>
      }
      unavailable={unavailable}
    />
    <Popover className={popoverCls} placement="bottom start" offset={6}>
      <Dialog className={dialogCls} aria-label={label}>
        {({ close }) => rows.map((items) => <ToolRow key={items.map((i) => i.id).join(' ')} items={items} close={close} />)}
      </Dialog>
    </Popover>
  </DialogTrigger>
);
