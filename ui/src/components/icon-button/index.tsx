import { useId, type ReactNode } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { iconBtnCls, tooltipCls, wrapCls } from './styles.css';

/** Present means the button is disabled; reason explains why. */
export type Unavailable = { reason?: string };

type Props = {
  unavailable?: Unavailable;
  label: string;
  icon: ReactNode;
  /** Omitted when a wrapping trigger (e.g. DialogTrigger) handles the press. */
  onClick?: () => void;
};

const EnabledButton = ({ label, icon, onClick }: Omit<Props, 'unavailable'>) => (
  <TooltipTrigger delay={300} closeDelay={0}>
    <Button className={iconBtnCls} aria-label={label} onPress={onClick}>
      {icon}
    </Button>
    <Tooltip className={tooltipCls} placement="bottom" offset={6}>
      {label}
    </Tooltip>
  </TooltipTrigger>
);

const tooltipOf = (label: string, reason: string | undefined): string => (reason === undefined ? label : `${label} (${reason})`);

/** Disabled buttons cannot take focus, so the hint is a hover-only title on the wrapper. */
const DisabledButton = ({ label, icon, onClick, reason }: Omit<Props, 'unavailable'> & Unavailable) => {
  const reasonId = useId();
  return (
    <span className={wrapCls} title={tooltipOf(label, reason)}>
      <Button className={iconBtnCls} aria-label={label} aria-describedby={reason === undefined ? undefined : reasonId} isDisabled onPress={onClick}>
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
