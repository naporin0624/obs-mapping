import { isGroupNode } from './layers';
import type { LayerNode, Mapping } from './mapping';

const collectVisible = (nodes: readonly LayerNode[], surfaceVisible: ReadonlyMap<string, boolean>, groupVisible: ReadonlyMap<string, boolean>, ancestorsVisible: boolean): string[] =>
  nodes.flatMap((n) => {
    if (isGroupNode(n)) return collectVisible(n.children, surfaceVisible, groupVisible, ancestorsVisible && groupVisible.get(n.group) === true);
    return ancestorsVisible && surfaceVisible.get(n.surface) === true ? [n.surface] : [];
  });

/** Surfaces that are visible themselves and under only visible groups; a hidden one is not drawn, nothing more. */
export const effectiveVisibleIds = (m: Mapping): ReadonlySet<string> =>
  new Set(collectVisible(m.layers, new Map(m.surfaces.map((s) => [s.id, s.visible])), new Map(m.groups.map((g) => [g.id, g.visible])), true));
