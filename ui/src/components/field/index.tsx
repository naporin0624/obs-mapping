import { useState, type ComponentProps, type ReactNode } from 'react';
import { Focusable, Tooltip, TooltipTrigger } from 'react-aria-components';
import { css } from '../../../styled-system/css';
import { inputCls, tooltipCls } from '../styles.css';
import { fieldCls, glyphCls, numberCls, srOnlyCls } from './styles.css';

type TextProps = { label: string; value: string; onCommit: (v: string) => void; disabled?: boolean };

/** Text input that commits on blur / Enter, so one edit is one undo step. */
export const TextField = ({ label, value, onCommit, disabled = false }: TextProps) => {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (): void => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <label className={fieldCls}>
      <span>{label}</span>
      <input
        className={`${inputCls} ${css({ flex: 1 })}`}
        value={draft ?? value}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(null);
        }}
      />
    </label>
  );
};

type NumProps = {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  disabled?: boolean;
  describedBy?: string;
  /** Shown in place of the visible label text; the label stays the accessible name and tooltip. */
  icon?: ReactNode;
};

const shown = (v: number): string => String(Math.round(v * 1000) / 1000);

const GlyphLabel = ({ label, icon }: { label: string; icon: ReactNode }) => (
  <span className={glyphCls}>
    {icon}
    <span className={srOnlyCls}>{label}</span>
  </span>
);

const WithTooltip = ({ label, children }: { label: string; children: ComponentProps<typeof Focusable>['children'] }) => (
  <TooltipTrigger delay={300} closeDelay={0}>
    <Focusable>{children}</Focusable>
    <Tooltip className={tooltipCls} placement="bottom" offset={6}>
      {label}
    </Tooltip>
  </TooltipTrigger>
);

/** Number input that commits on blur / Enter; ignores non-numeric text. */
export const NumField = ({ label, value, onCommit, step = 1, disabled = false, describedBy, icon }: NumProps) => {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (): void => {
    const n = Number(draft);
    if (draft !== null && draft.trim() !== '' && Number.isFinite(n) && n !== value) onCommit(n);
    setDraft(null);
  };
  const input = (
    <input
      className={`${inputCls} ${numberCls}`}
      type="number"
      aria-describedby={describedBy}
      step={step}
      value={draft ?? shown(value)}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(null);
      }}
    />
  );
  return icon === undefined ? (
    <label className={fieldCls}>
      <span>{label}</span>
      {input}
    </label>
  ) : (
    <label className={fieldCls}>
      <GlyphLabel label={label} icon={icon} />
      <WithTooltip label={label}>{input}</WithTooltip>
    </label>
  );
};
