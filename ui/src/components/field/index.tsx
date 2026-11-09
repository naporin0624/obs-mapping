import { useContext, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from 'react';
import { Focusable, Group, Tooltip, TooltipTrigger, TooltipTriggerStateContext } from 'react-aria-components';
import { css } from '../../../styled-system/css';
import { inputCls, tooltipCls } from '../styles.css';
import { fieldCls, glyphCls, hoverAreaCls, numberCls, srOnlyCls } from './styles.css';

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

/** Hovering anywhere on the glyph + input opens the shared tooltip state; the input's own trigger only reacts to focus. */
const HoverArea = ({ areaRef, children }: { areaRef: RefObject<HTMLDivElement | null>; children: ReactNode }) => {
  const state = useContext(TooltipTriggerStateContext);
  return (
    <Group ref={areaRef} role="presentation" className={hoverAreaCls} onHoverStart={() => state?.open()} onHoverEnd={() => state?.close()}>
      {children}
    </Group>
  );
};

const GlyphField = ({ label, icon, input }: { label: string; icon: ReactNode; input: ComponentProps<typeof Focusable>['children'] }) => {
  const areaRef = useRef<HTMLDivElement>(null);
  return (
    <TooltipTrigger delay={300} closeDelay={0} trigger="focus">
      <HoverArea areaRef={areaRef}>
        <label className={fieldCls}>
          <GlyphLabel label={label} icon={icon} />
          <Focusable>{input}</Focusable>
        </label>
      </HoverArea>
      <Tooltip className={tooltipCls} triggerRef={areaRef} placement="bottom" offset={6}>
        {label}
      </Tooltip>
    </TooltipTrigger>
  );
};

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
    <GlyphField label={label} icon={icon} input={input} />
  );
};
