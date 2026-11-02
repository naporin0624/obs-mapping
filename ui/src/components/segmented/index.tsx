import { useId } from 'react';
import { fieldsetCls, legendCls, radioCls, segmentCls, segmentsCls } from './styles.css';

export type Option<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = { legend: string; options: readonly Option<T>[]; value: T; onChange: (v: T) => void };

/** One choice out of a few, as native radios styled like a segmented button. */
export const Segmented = <T extends string>({ legend, options, value, onChange }: SegmentedProps<T>) => {
  const name = useId();
  return (
    <fieldset className={fieldsetCls}>
      <legend className={legendCls}>{legend}</legend>
      <div className={segmentsCls}>
        {options.map((o) => (
          <label key={o.value} className={segmentCls}>
            <input type="radio" className={radioCls} name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
};
