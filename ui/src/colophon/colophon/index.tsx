import { useState, type ReactNode } from 'react';
import { Provider, createStore } from 'jotai';
import { Link } from 'react-aria-components';
import { EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from '../../components/icons';
import { GroupInspector } from '../../components/group-inspector';
import { Inspector } from '../../components/inspector';
import { LayerTree } from '../../components/layer-tree';
import { SourceSelect, type SourceOption } from '../../components/source-select';
import { StageGroupFrame } from '../../components/stage-group-frame';
import { UnderlayImage } from '../../components/stage-underlay';
import { UnderlayControlsView, type UnderlayView } from '../../components/underlay-controls';
import { emptySelection } from '../../editor/state';
import { gn, groupOf, mapOf, sn, surf } from '../../geometry/fixtures';
import type { Mapping } from '../../model/mapping';
import { pageCls, headingCls, caseCls, captionCls, linkCls, frameCls } from './styles.css';

const options: readonly SourceOption[] = [
  { id: 'Mapping', label: 'Mapping', detail: '1920x1080' },
  { id: 'Mapping-B', label: 'Mapping-B', detail: '1280x720' },
];
const longName = 'Camera feed from the stage left wide angle lens with a very long name';
const longOptions: readonly SourceOption[] = [{ id: longName, label: longName, detail: '3 surfaces' }, ...options];

const Case = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={caseCls}>
    <div className={captionCls}>{title}</div>
    {children}
  </section>
);

const noop = (): void => undefined;

const sampleUnderlay = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="36"><rect width="64" height="36" fill="#3a6"/><circle cx="32" cy="18" r="12" fill="#fc3"/></svg>')}`;

const InteractiveUnderlay = () => {
  const [underlay, setUnderlay] = useState<UnderlayView | null>({ visible: true, opacity: 0.6 });
  return (
    <UnderlayControlsView
      underlay={underlay}
      onFile={() => setUnderlay({ visible: true, opacity: 0.6 })}
      onToggle={() => setUnderlay((u) => u && { ...u, visible: !u.visible })}
      onOpacity={(opacity) => setUnderlay((u) => u && { ...u, opacity })}
      onOpacityEnd={noop}
      onRemove={() => setUnderlay(null)}
    />
  );
};

const layerSample = (hideGroup: boolean): Mapping => ({
  ...mapOf(surf('a', 0, 0), surf('b', 0, 0), surf('c', 0, 0)),
  groups: [groupOf('g-1', { name: 'Stage', visible: !hideGroup }), groupOf('g-2', { name: 'Back row' })],
  layers: [gn('g-1', sn('a'), gn('g-2', sn('b'))), sn('c')],
});

const FrameCase = ({ frame }: { frame: { x: number; y: number; width: number; height: number } }) => (
  <svg viewBox="0 0 400 160" width="100%" role="img" aria-label="StageGroupFrame sample">
    <StageGroupFrame frame={frame} movable scale={1} onPointerDown={noop} />
  </svg>
);

const FrameCases = () => (
  <>
    <Case title="StageGroupFrame / 選択中">
      <FrameCase frame={{ x: 40, y: 30, width: 320, height: 100 }} />
    </Case>
    <Case title="StageGroupFrame / 空のグループ">
      <FrameCase frame={{ x: 180, y: 70, width: 40, height: 20 }} />
    </Case>
  </>
);

const LayerTreeCase = ({ hideGroup }: { hideGroup: boolean }) => {
  const [store] = useState(createStore);
  return (
    <Provider store={store}>
      <LayerTree mapping={layerSample(hideGroup)} selection={emptySelection()} dispatch={noop} />
    </Provider>
  );
};

const inspectorSample: Mapping = {
  ...mapOf(surf('a', 0, 0), surf('b', 50, 0)),
  groups: [groupOf('g-1', { name: 'パネル列', layout: { direction: 'row', gap: 20, align: 'start', padding: 0 } })],
  layers: [gn('g-1', sn('a')), sn('b')],
};

const sampleGroup = inspectorSample.groups[0];

const InspectorCases = () => (
  <>
    <Case title="GroupInspector / row">{sampleGroup === undefined ? null : <GroupInspector group={sampleGroup} dispatch={noop} />}</Case>
    <Case title="Inspector / グループが位置を決めています">
      <Inspector mapping={inspectorSample} selection={{ surfaceIds: ['a'], groupIds: [], corner: null }} inputs={['src']} dispatch={noop} />
    </Case>
  </>
);

export const Colophon = () => {
  const [picked, setPicked] = useState<string | null>('Mapping');
  return (
    <main className={pageCls}>
      <h1 className={headingCls}>Colophon</h1>
      <Link href="https://react-spectrum.adobe.com/react-aria/Select.html" className={linkCls} onClick={(e) => e.preventDefault()}>
        SourceSelect is built on react-aria-components Select
      </Link>
      <Link href="https://react-spectrum.adobe.com/react-aria/Tree.html" className={linkCls} onClick={(e) => e.preventDefault()}>
        LayerTree is built on react-aria-components Tree
      </Link>
      <Case title="LayerTree / 入れ子と折りたたみ">
        <LayerTreeCase hideGroup={false} />
      </Case>
      <Case title="LayerTree / 非表示のグループ">
        <LayerTreeCase hideGroup />
      </Case>
      <FrameCases />
      <InspectorCases />
      <Case title="Icons / Eye, EyeOff, Plus, Trash">
        <div>
          <EyeIcon /> <EyeOffIcon /> <PlusIcon /> <TrashIcon />
        </div>
      </Case>
      <Case title="SourceSelect / placeholder">
        <SourceSelect label="Source" placeholder="Select a source" items={options} value={null} onChange={noop} />
      </Case>
      <Case title="SourceSelect / selected (interactive)">
        <SourceSelect label="Source" placeholder="Select a source" items={options} value={picked} onChange={setPicked} />
      </Case>
      <Case title="SourceSelect / disabled, no inputs">
        <SourceSelect ariaLabel="Source" placeholder="No inputs" items={[]} value={null} isDisabled onChange={noop} />
      </Case>
      <Case title="SourceSelect / long name truncation">
        <SourceSelect label="Source" placeholder="Select a source" items={longOptions} value={longName} onChange={noop} />
      </Case>
      <Case title="UnderlayControls / before an image is chosen">
        <UnderlayControlsView underlay={null} onFile={noop} onToggle={noop} onOpacity={noop} onOpacityEnd={noop} onRemove={noop} />
      </Case>
      <Case title="UnderlayControls / image chosen (interactive)">
        <InteractiveUnderlay />
      </Case>
      <Case title="UnderlayImage / stretched to a 16:9 frame at 60%">
        <div className={frameCls}>
          <UnderlayImage url={sampleUnderlay} opacity={0.6} />
        </div>
      </Case>
    </main>
  );
};
