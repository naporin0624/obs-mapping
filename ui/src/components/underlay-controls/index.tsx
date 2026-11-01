import { useEffect, useId, useRef, type ChangeEvent } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Button, Label, Slider, SliderOutput, SliderThumb, SliderTrack, ToggleButton } from 'react-aria-components';
import { selectedSourceAtom } from '../../atoms/session';
import { chooseUnderlayAtom, currentUnderlayAtom, loadUnderlayAtom, commitUnderlayOpacityAtom, removeUnderlayAtom, setUnderlayOpacityAtom, toggleUnderlayAtom } from '../../atoms/underlay';
import { buttonCls, buttonSolidCls } from '../styles.css';
import { groupCls, tagCls } from '../toolbar/styles.css';
import { hiddenInputCls, outputCls, sliderCls, thumbCls, trackCls } from './styles.css';

export type UnderlayView = { visible: boolean; opacity: number };

type ViewProps = {
  /** null until an image is chosen; the toggle, slider and remove button appear with it. */
  underlay: UnderlayView | null;
  onFile: (file: File) => void;
  onToggle: () => void;
  onOpacity: (opacity: number) => void;
  onOpacityEnd: (opacity: number) => void;
  onRemove: () => void;
};

const OpacitySlider = ({ opacity, onChange, onChangeEnd }: { opacity: number; onChange: (v: number) => void; onChangeEnd: (v: number) => void }) => (
  <Slider className={sliderCls} value={opacity} minValue={0} maxValue={1} step={0.01} formatOptions={{ style: 'percent' }} onChange={onChange} onChangeEnd={onChangeEnd}>
    <Label>濃さ</Label>
    <SliderTrack className={trackCls}>
      <SliderThumb className={thumbCls} />
    </SliderTrack>
    <SliderOutput className={outputCls} />
  </Slider>
);

const ImageControls = ({ underlay, onToggle, onOpacity, onOpacityEnd, onRemove }: Omit<ViewProps, 'underlay' | 'onFile'> & { underlay: UnderlayView }) => (
  <>
    <ToggleButton className={underlay.visible ? buttonSolidCls : buttonCls} aria-label="下地を表示" isSelected={underlay.visible} onChange={onToggle}>
      表示{underlay.visible ? <span aria-hidden="true"> ✓</span> : null}
    </ToggleButton>
    <OpacitySlider opacity={underlay.opacity} onChange={onOpacity} onChangeEnd={onOpacityEnd} />
    <Button className={buttonCls} aria-label="下地を削除" onPress={onRemove}>
      ×
    </Button>
  </>
);

/** The picker is a file input because keyboard paste and the Clipboard API fail in OBS docks. */
export const UnderlayControlsView = ({ underlay, onFile, ...handlers }: ViewProps) => {
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const onChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (file !== undefined) onFile(file);
  };
  return (
    <div className={groupCls} role="group" aria-labelledby={labelId}>
      <span id={labelId} className={tagCls}>
        下地
      </span>
      <Button className={buttonCls} aria-haspopup="dialog" onPress={() => inputRef.current?.click()}>
        画像…
      </Button>
      <input ref={inputRef} className={hiddenInputCls} type="file" accept="image/*" aria-label="下地画像ファイル" onChange={onChange} />
      {underlay === null ? null : <ImageControls underlay={underlay} {...handlers} />}
    </div>
  );
};

const useLoadOnSourceChange = (source: string | null): void => {
  const load = useSetAtom(loadUnderlayAtom);
  useEffect(() => {
    // USEEFFECT_JUSTIFICATION: reading IndexedDB is a command, so it must not run in a getter.
    void load(source);
  }, [source, load]);
};

/** Toolbar group for the editor-only underlay image of the selected source. */
export const UnderlayControls = () => {
  const source = useAtomValue(selectedSourceAtom);
  const current = useAtomValue(currentUnderlayAtom);
  const choose = useSetAtom(chooseUnderlayAtom);
  const toggle = useSetAtom(toggleUnderlayAtom);
  const setOpacity = useSetAtom(setUnderlayOpacityAtom);
  const commit = useSetAtom(commitUnderlayOpacityAtom);
  const remove = useSetAtom(removeUnderlayAtom);
  useLoadOnSourceChange(source);

  return (
    <UnderlayControlsView
      underlay={current?.kind === 'image' ? current : null}
      onFile={(file) => source !== null && void choose(source, file)}
      onToggle={() => void toggle()}
      onOpacity={setOpacity}
      onOpacityEnd={(opacity) => void commit(opacity)}
      onRemove={() => void remove()}
    />
  );
};
