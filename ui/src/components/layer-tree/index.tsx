import { useRef, type Dispatch } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Button, DropIndicator, Tree, TreeItem, TreeItemContent, useDragAndDrop, type Key } from 'react-aria-components';
import { collapsedGroupsAtom, toggleCollapsedAtom } from '../../atoms/layers';
import type { Action } from '../../editor/reducer';
import type { Selection } from '../../editor/state';
import { isGroupNode } from '../../model/layers';
import type { Group, LayerNode, Mapping, Surface } from '../../model/mapping';
import { hiddenByAncestor } from '../../model/visibility';
import { EyeIcon, EyeOffIcon } from '../icons';
import { chevronCls, eyeButtonCls, dragHandleCls, chevronSpacerCls, dropLineCls, metaCls, nameCls, rowCls, treeCls } from './styles.css';
import { selectionOfKeys } from './selection';
import { dropActionFor, dropOperationFor, toIdSet } from './tree-dnd';

type Props = { mapping: Mapping; selection: Selection; dispatch: Dispatch<Action> };

type Entry = { name: string; visible: boolean; meta: string; toggle: Action };

const surfaceEntry = (s: Surface): Entry => ({
  name: s.name,
  visible: s.visible,
  meta: s.source === '' ? '未割当' : s.source,
  toggle: { type: 'patchSurface', surfaceId: s.id, patch: { visible: !s.visible } },
});

const groupEntry = (g: Group, count: number): Entry => ({
  name: g.name,
  visible: g.visible,
  meta: `${String(count)} 個`,
  toggle: { type: 'patchGroup', groupId: g.id, patch: { visible: !g.visible } },
});

const VisibilityToggle = ({ entry, dispatch }: { entry: Entry; dispatch: Dispatch<Action> }) => (
  <Button className={eyeButtonCls} aria-pressed={entry.visible} aria-label={entry.visible ? `${entry.name} を非表示にする` : `${entry.name} を表示する`} onPress={() => dispatch(entry.toggle)}>
    {entry.visible ? <EyeIcon /> : <EyeOffIcon />}
  </Button>
);

const Chevron = ({ expandable, isExpanded }: { expandable: boolean; isExpanded: boolean }) =>
  expandable ? (
    <Button slot="chevron" className={chevronCls}>
      {isExpanded ? '▾' : '▸'}
    </Button>
  ) : (
    <span className={chevronSpacerCls} />
  );

type RowProps = { entry: Entry; hasChildren: boolean; dimmed: boolean; dispatch: Dispatch<Action> };

const Row = ({ entry, hasChildren, dimmed, dispatch }: RowProps) => (
  <TreeItemContent>
    {({ isExpanded }) => (
      <>
        <Button slot="drag" aria-label={`${entry.name} を並べ替える`} className={dragHandleCls}>
          ⠿
        </Button>
        <Chevron expandable={hasChildren} isExpanded={isExpanded} />
        <VisibilityToggle entry={entry} dispatch={dispatch} />
        <span className={nameCls}>{entry.name}</span>
        <span className={metaCls}>{dimmed ? 'グループで非表示' : entry.meta}</span>
      </>
    )}
  </TreeItemContent>
);

type View = { mapping: Mapping; hidden: ReadonlySet<string>; dispatch: Dispatch<Action> };

const entryOf = (node: LayerNode, mapping: Mapping): { id: string; entry: Entry } | null => {
  if (isGroupNode(node)) {
    const g = mapping.groups.find((x) => x.id === node.group);
    return g === undefined ? null : { id: g.id, entry: groupEntry(g, node.children.length) };
  }
  const s = mapping.surfaces.find((x) => x.id === node.surface);
  return s === undefined ? null : { id: s.id, entry: surfaceEntry(s) };
};

const NodeItem = ({ node, view }: { node: LayerNode; view: View }) => {
  const found = entryOf(node, view.mapping);
  if (found === null) return null;
  const { id, entry } = found;
  return (
    <TreeItem id={id} textValue={entry.name} className={rowCls} data-dimmed={view.hidden.has(id)}>
      <Row entry={entry} hasChildren={isGroupNode(node) && node.children.length > 0} dimmed={view.hidden.has(id)} dispatch={view.dispatch} />
      {isGroupNode(node) ? node.children.map((child) => <NodeItem key={nodeKey(child)} node={child} view={view} />) : null}
    </TreeItem>
  );
};

const nodeKey = (n: LayerNode): string => (isGroupNode(n) ? n.group : n.surface);

const useLayerDnd = (mapping: Mapping, dispatch: Dispatch<Action>) => {
  const dragged = useRef<ReadonlySet<string>>(new Set());
  return useDragAndDrop({
    getItems: (keys) => [...keys].map((k) => ({ 'text/plain': String(k) })),
    onDragStart: (e) => {
      dragged.current = toIdSet(e.keys);
    },
    onDragEnd: () => {
      dragged.current = new Set();
    },
    getDropOperation: (target) => dropOperationFor(mapping, dragged.current, target),
    onMove: (e) => {
      const action = dropActionFor(mapping, e.keys, e.target);
      if (action !== null) dispatch(action);
    },
    renderDropIndicator: (target) => <DropIndicator target={target} className={dropLineCls} />,
  });
};

const expandedOf = (mapping: Mapping, collapsed: ReadonlySet<string>): Set<Key> => new Set(mapping.groups.map((g) => g.id).filter((id) => !collapsed.has(id)));

const selectedOf = (selection: Selection): Set<Key> => new Set([...selection.surfaceIds, ...selection.groupIds]);

/** Surfaces and groups as a nested tree: select, collapse, toggle visibility, drag to move. */
export const LayerTree = ({ mapping, selection, dispatch }: Props) => {
  const collapsed = useAtomValue(collapsedGroupsAtom);
  const toggleCollapsed = useSetAtom(toggleCollapsedAtom);
  const { dragAndDropHooks } = useLayerDnd(mapping, dispatch);
  const view: View = { mapping, hidden: hiddenByAncestor(mapping), dispatch };
  const expanded = expandedOf(mapping, collapsed);

  return (
    <Tree
      aria-label="レイヤー"
      className={treeCls}
      selectionMode="multiple"
      selectionBehavior="replace"
      selectedKeys={selectedOf(selection)}
      onSelectionChange={(keys) => dispatch({ type: 'select', selection: selectionOfKeys(mapping, keys) })}
      expandedKeys={expanded}
      onExpandedChange={(next) => mapping.groups.filter((g) => next.has(g.id) !== expanded.has(g.id)).forEach((g) => toggleCollapsed(g.id))}
      dragAndDropHooks={dragAndDropHooks}
    >
      {mapping.layers.map((node) => (
        <NodeItem key={nodeKey(node)} node={node} view={view} />
      ))}
    </Tree>
  );
};
