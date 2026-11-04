import { useState, type ReactNode } from 'react';
import { Provider, createStore } from 'jotai';
import { Link } from 'react-aria-components';
import {
  AlignBottomIcon,
  AlignCenterHIcon,
  AlignCenterVIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignTopIcon,
  DistributeHIcon,
  DistributeVIcon,
  ExportIcon,
  EyeIcon,
  EyeOffIcon,
  GroupIcon,
  ImportIcon,
  PlusIcon,
  RedoIcon,
  TileIcon,
  TrashIcon,
  UndoIcon,
  UngroupIcon,
} from '../../components/icons';
import { IconButton } from '../../components/icon-button';
import { BulkSourceFields } from '../../components/bulk-source-fields';
import { GroupInspector } from '../../components/group-inspector';
import { Inspector } from '../../components/inspector';
import { MaskFields } from '../../components/mask-fields';
import { LayerTree } from '../../components/layer-tree';
import { SourceSelect, type SourceOption } from '../../components/source-select';
import { StageGroupFrame } from '../../components/stage-group-frame';
import { StageMaskHandles } from '../../components/stage-mask-handles';
import { Segmented } from '../../components/segmented';
import { TilePopover } from '../../components/tile-popover';
import { UnderlayImage } from '../../components/stage-underlay';
import { UnderlayControlsView, type UnderlayView } from '../../components/underlay-controls';
import { initialMask } from '../../editor/mask-edit';
import { emptySelection } from '../../editor/state';
import { gn, groupOf, mapOf, sn, surf } from '../../geometry/fixtures';
import { rectCorners } from '../../geometry/rect';
import type { Direction, Mapping, Mask, Surface } from '../../model/mapping';
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

const maskCorners = rectCorners({ x: 60, y: 20, width: 280, height: 120 });

const MaskHandlesCase = ({ mask, vertex }: { mask: Mask; vertex: number | null }) => (
  <svg viewBox="0 0 400 160" width="100%" role="img" aria-label="StageMaskHandles sample">
    <StageMaskHandles corners={maskCorners} mask={mask} vertex={vertex} scale={1} onHandleDown={noop} onEdgeDown={noop} />
  </svg>
);

const MaskHandlesCases = () => (
  <>
    <Case title="StageMaskHandles / 円">
      <MaskHandlesCase mask={{ type: 'ellipse', x: 0.1, y: 0.1, width: 0.8, height: 0.8 }} vertex={null} />
    </Case>
    <Case title="StageMaskHandles / 多角形（頂点 1 を選択）">
      <MaskHandlesCase
        mask={{
          type: 'polygon',
          points: [
            [0, 0.2],
            [0.6, 0],
            [1, 0.7],
            [0.3, 1],
          ],
        }}
        vertex={1}
      />
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

const bulkLayer = (id: string, name: string, source: string): Surface => ({ ...surf(id, 0, 0), name, source });
const bulkInputs = ['cam-A', 'cam-B', 'Mapping'];
const bulkCounts: ReadonlyMap<string, number> = new Map([
  ['cam-A', 2],
  ['cam-B', 1],
]);
const bulkMixed = [bulkLayer('a', 'Left wall', 'cam-A'), bulkLayer('b', 'Floor 3', ''), bulkLayer('c', 'Right wall', 'cam-B'), bulkLayer('d', longName, 'cam-A')];
const bulkUniform = [bulkLayer('a', 'Left wall', 'cam-A'), bulkLayer('b', 'Right wall', 'cam-A')];

const IconCases = () => (
  <>
    <Case title="Icons / Eye, EyeOff, Plus, Trash">
      <div>
        <EyeIcon /> <EyeOffIcon /> <PlusIcon /> <TrashIcon />
      </div>
    </Case>
    <Case title="Icons / Toolbar">
      <div>
        <UndoIcon /> <RedoIcon /> <AlignLeftIcon /> <AlignCenterHIcon /> <AlignRightIcon /> <AlignTopIcon /> <AlignCenterVIcon /> <AlignBottomIcon /> <DistributeHIcon /> <DistributeVIcon />{' '}
        <TileIcon /> <GroupIcon /> <UngroupIcon /> <ImportIcon /> <ExportIcon />
      </div>
    </Case>
    <Case title="IconButton / enabled, disabled with reason">
      <div>
        <IconButton label="Undo" icon={<UndoIcon />} onClick={noop} />
        <IconButton label="Distribute horizontally" icon={<DistributeHIcon />} unavailable={{ reason: 'Select 3 or more surfaces' }} onClick={noop} />
      </div>
    </Case>
  </>
);

const SegmentedCase = () => {
  const [direction, setDirection] = useState<Direction>('row');
  return (
    <Case title="Segmented / one row or one column (interactive)">
      <Segmented
        legend="Direction"
        options={[
          { value: 'row', label: 'One row' },
          { value: 'column', label: 'One column' },
        ]}
        value={direction}
        onChange={setDirection}
      />
    </Case>
  );
};

const TileCases = () => (
  <>
    <Case title="TilePopover / 3 surfaces (interactive)">
      <TilePopover subject={{ kind: 'surfaces', count: 3, onApply: noop }} canvas={{ width: 1920, height: 1080 }} />
    </Case>
    <Case title="TilePopover / group of 2 in a column (interactive)">
      <TilePopover subject={{ kind: 'group', count: 2, direction: 'column', onApply: noop }} canvas={{ width: 1920, height: 1080 }} />
    </Case>
    <Case title="TilePopover / disabled with reason">
      <TilePopover subject={{ kind: 'surfaces', count: 0, onApply: noop }} canvas={{ width: 1920, height: 1080 }} unavailable={{ reason: 'Select a surface' }} />
    </Case>
    <Case title="TilePopover / group holding a group">
      <TilePopover subject={{ kind: 'surfaces', count: 0, onApply: noop }} canvas={{ width: 1920, height: 1080 }} unavailable={{ reason: 'A group that holds a group cannot be tiled' }} />
    </Case>
    <SegmentedCase />
  </>
);

const InspectorCases = () => (
  <>
    <Case title="GroupInspector / row">{sampleGroup === undefined ? null : <GroupInspector group={sampleGroup} dispatch={noop} />}</Case>
    <Case title="Inspector / グループが位置を決めています">
      <Inspector mapping={inspectorSample} selection={{ surfaceIds: ['a'], groupIds: [], corner: null }} shapeEdit={null} inputs={['src']} dispatch={noop} />
    </Case>
    <Case title="BulkSourceFields / 混在">
      <BulkSourceFields targets={bulkMixed} inputs={bulkInputs} counts={bulkCounts} dispatch={noop} />
    </Case>
    <Case title="BulkSourceFields / すべて同じソース">
      <BulkSourceFields targets={bulkUniform} inputs={bulkInputs} counts={bulkCounts} dispatch={noop} />
    </Case>
    <Case title="BulkSourceFields / 対象なし">
      <BulkSourceFields targets={[]} inputs={bulkInputs} counts={bulkCounts} dispatch={noop} />
    </Case>
    <Case title="MaskFields / なし">
      <MaskFields surface={surf('a', 0, 0, 500, 300)} shapeEdit={null} dispatch={noop} />
    </Case>
    <Case title="MaskFields / 円">
      <MaskFields surface={{ ...surf('a', 0, 0, 500, 300), mask: { type: 'ellipse', x: 0.1, y: 0.1, width: 0.8, height: 0.8 } }} shapeEdit={null} dispatch={noop} />
    </Case>
    <Case title="MaskFields / 多角形（頂点 2 を選択）">
      <MaskFields surface={{ ...surf('a', 0, 0, 500, 300), mask: initialMask('polygon') }} shapeEdit={{ surfaceId: 'a', vertex: 1 }} dispatch={noop} />
    </Case>
  </>
);

const LayerTreeCases = () => (
  <>
    <Case title="LayerTree / 入れ子と折りたたみ">
      <LayerTreeCase hideGroup={false} />
    </Case>
    <Case title="LayerTree / 非表示のグループ">
      <LayerTreeCase hideGroup />
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
      <Link href="https://react-spectrum.adobe.com/react-aria/Popover.html" className={linkCls} onClick={(e) => e.preventDefault()}>
        TilePopover is built on react-aria-components DialogTrigger + Popover
      </Link>
      <LayerTreeCases />
      <FrameCases />
      <MaskHandlesCases />
      <InspectorCases />
      <IconCases />
      <TileCases />
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
