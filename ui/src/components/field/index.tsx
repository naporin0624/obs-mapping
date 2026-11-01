import { useState } from 'react';
import { css } from '../../../styled-system/css';
import { inputCls } from '../styles.css';
import { fieldCls, numberCls } from './styles.css';

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

type NumProps = { label: string; value: number; onCommit: (v: number) => void; step?: number; disabled?: boolean };

const shown = (v: number): string => String(Math.round(v * 1000) / 1000);

/** Number input that commits on blur / Enter; ignores non-numeric text. */
export const NumField = ({ label, value, onCommit, step = 1, disabled = false }: NumProps) => {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (): void => {
    const n = Number(draft);
    if (draft !== null && draft.trim() !== '' && Number.isFinite(n) && n !== value) onCommit(n);
    setDraft(null);
  };
  return (
    <label className={fieldCls}>
      <span>{label}</span>
      <input
        className={`${inputCls} ${numberCls}`}
        type="number"
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
    </label>
  );
};
