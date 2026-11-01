import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, Text } from 'react-aria-components';
import { css } from '../../styled-system/css';
import { focusRing } from './styles';

export type SourceOption = { id: string; label: string; detail: string };

type Props = {
  items: readonly SourceOption[];
  value: string | null;
  onChange: (id: string) => void;
  placeholder: string;
  label?: string;
  ariaLabel?: string;
  isDisabled?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  className?: string;
};

const labelCls = css({ color: 'fg.muted', fontWeight: 700 });
const selectCls = css({ display: 'flex', alignItems: 'center', gap: '1.5', minWidth: 0 });
const triggerCls = css(focusRing, {
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  flex: 1,
  minWidth: 0,
  minHeight: 'target-min',
  px: '1.5',
  bg: 'bg.subtle',
  color: 'fg.default',
  fontFamily: 'body',
  fontSize: '12px',
  textAlign: 'left',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.default',
  cursor: 'pointer',
  _disabled: { opacity: 'disabled', cursor: 'default' },
  '&[data-pressed]': { bg: 'bg.muted' },
});
const valueCls = css({ flex: 1, minWidth: 0, display: 'flex', '&[data-placeholder]': { color: 'fg.muted' } });
const chevronCls = css({ color: 'fg.muted', flexShrink: 0 });
const popoverCls = css({
  width: 'var(--trigger-width)',
  bg: 'bg.subtle',
  color: 'fg.default',
  borderWidth: 'default',
  borderStyle: 'solid',
  borderColor: 'border.default',
});
const listCls = css({ maxHeight: '240px', overflowY: 'auto', outline: 'none' });
const itemCls = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: 'target-min',
  px: '1.5',
  cursor: 'pointer',
  outline: 'none',
  '&[data-hovered], &[data-focused]': { bg: 'bg.emphasis' },
  '&[data-selected]': { boxShadow: 'inset 3px 0 0 token(colors.accent.solid)' },
});
const rowCls = css({ display: 'flex', alignItems: 'baseline', gap: '3', width: '100%', minWidth: 0 });
const nameCls = css({ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const detailCls = css({ flexShrink: 0, whiteSpace: 'nowrap', color: 'fg.muted', fontSize: '11px' });

const OptionBody = ({ label, detail }: Pick<SourceOption, 'label' | 'detail'>) => (
  <span className={rowCls}>
    <Text slot="label" className={nameCls}>
      {label}
    </Text>
    <Text slot="description" className={detailCls}>
      {detail}
    </Text>
  </span>
);

/** Single-choice picker whose options carry a name and a muted detail column. */
export const SourceSelect = ({ items, value, onChange, placeholder, label, ariaLabel, isDisabled = false, onOpenChange, className }: Props) => (
  <Select
    className={`${selectCls} ${className ?? ''}`}
    aria-label={label === undefined ? ariaLabel : undefined}
    placeholder={placeholder}
    value={value}
    isDisabled={isDisabled}
    onOpenChange={onOpenChange}
    onChange={(key) => {
      if (key !== null) onChange(String(key));
    }}
  >
    {label === undefined ? null : <Label className={labelCls}>{label}</Label>}
    <Button className={triggerCls}>
      <SelectValue className={valueCls} />
      <span aria-hidden="true" className={chevronCls}>
        ▾
      </span>
    </Button>
    <Popover className={popoverCls} offset={4}>
      <ListBox className={listCls} items={items}>
        {(item) => (
          <ListBoxItem id={item.id} textValue={item.label} className={itemCls}>
            <OptionBody label={item.label} detail={item.detail} />
          </ListBoxItem>
        )}
      </ListBox>
    </Popover>
  </Select>
);
