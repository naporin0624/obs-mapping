import { useId, type ReactNode } from 'react';
import { Button, ToggleButton, Tooltip, TooltipTrigger } from 'react-aria-components';
import { tooltipCls } from '../styles.css';
import { iconBtnCls, iconBtnSolidCls, iconToggleCls, wrapCls } from './styles.css';

/** Present means the button is disabled; reason explains why. */
export type Unavailable = { reason?: string };

type Props = {
  unavailable?: Unavailable;
  label: string;
  icon: ReactNode;
  /** Omitted when a wrapping trigger (e.g. DialogTrigger) handles the press. */
  onClick?: () => void;
  type?: 'button' | 'submit';
  /** id of the element this button changes, e.g. a password input it reveals. */
  controls?: string;
  /** Filled look for the primary action. */
  solid?: boolean;
};

type ButtonProps = Omit<Props, 'unavailable'>;

const LabelTooltip = ({ label }: { label: string }) => (
  <Tooltip className={tooltipCls} placement="bottom" offset={6}>
    {label}
  </Tooltip>
);

const EnabledButton = ({ label, icon, onClick, type = 'button', controls, solid = false }: ButtonProps) => (
  <TooltipTrigger delay={300} closeDelay={0}>
    <Button className={solid ? iconBtnSolidCls : iconBtnCls} type={type} aria-label={label} aria-controls={controls} onPress={onClick}>
      {icon}
    </Button>
    <LabelTooltip label={label} />
  </TooltipTrigger>
);

const tooltipOf = (label: string, reason: string | undefined): string => (reason === undefined ? label : `${label} (${reason})`);

/** Disabled buttons cannot take focus, so the hint is a hover-only title on the wrapper. */
const DisabledButton = ({ label, icon, onClick, type = 'button', controls, solid = false, reason }: ButtonProps & Unavailable) => {
  const reasonId = useId();
  return (
    <span className={wrapCls} title={tooltipOf(label, reason)}>
      <Button
        className={solid ? iconBtnSolidCls : iconBtnCls}
        type={type}
        aria-label={label}
        aria-controls={controls}
        aria-describedby={reason === undefined ? undefined : reasonId}
        isDisabled
        onPress={onClick}
      >
        {icon}
      </Button>
      {reason !== undefined && (
        <span id={reasonId} hidden>
          {reason}
        </span>
      )}
    </span>
  );
};

/** Icon-only button named by its label; enabled ones show the name as a tooltip on hover and focus. */
export const IconButton = ({ unavailable, ...rest }: Props) => (unavailable === undefined ? <EnabledButton {...rest} /> : <DisabledButton {...rest} reason={unavailable.reason} />);

type ToggleProps = { label: string; icon: ReactNode; isSelected: boolean; onChange: (selected: boolean) => void };

/** Icon-only on/off switch: same glyph in both states, a filled face and aria-pressed mark "on". */
export const IconToggleButton = ({ label, icon, isSelected, onChange }: ToggleProps) => (
  <TooltipTrigger delay={300} closeDelay={0}>
    <ToggleButton className={iconToggleCls} aria-label={label} isSelected={isSelected} onChange={onChange}>
      {icon}
    </ToggleButton>
    <LabelTooltip label={label} />
  </TooltipTrigger>
);
