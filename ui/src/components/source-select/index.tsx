import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, Text } from 'react-aria-components';
import { labelCls, selectCls, triggerCls, valueCls, chevronCls, popoverCls, listCls, itemCls, rowCls, nameCls, detailCls } from './styles.css';

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
