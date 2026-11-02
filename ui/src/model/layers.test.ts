import { describe, expect, it } from 'vitest';
import { gn, mapOf, sn, surf } from '../geometry/fixtures';
import { depthOf, subtreeHeight, dfsSurfaceIds, findParent, flatLayers, insertAfterNode, isGroupNode, moveWithinParent, nodeId, removeNodes, sortSurfacesByLayers, subtreeIds } from './layers';

const tree = () => [gn('g1', sn('s1'), gn('g2', sn('s2'))), sn('s3')];

describe('layers', () => {
  it('tells nodes apart and reads their id', () => {
    expect(isGroupNode(gn('g1'))).toBe(true);
    expect(isGroupNode(sn('s1'))).toBe(false);
    expect([nodeId(gn('g1')), nodeId(sn('s1'))]).toEqual(['g1', 's1']);
  });

  it('flatLayers lists every surface at the top level', () => {
    expect(flatLayers([surf('a', 0, 0), surf('b', 0, 0)])).toEqual([sn('a'), sn('b')]);
  });

  it('dfsSurfaceIds walks depth first', () => {
    expect(dfsSurfaceIds(tree())).toEqual(['s1', 's2', 's3']);
  });

  it('sortSurfacesByLayers orders surfaces like the tree', () => {
    const m = { ...mapOf(surf('s3', 0, 0), surf('s1', 0, 0), surf('s2', 0, 0)), layers: tree() };
    expect(sortSurfacesByLayers(m).surfaces.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });

  it('removeNodes drops a whole subtree', () => {
    expect(removeNodes(tree(), new Set(['g2']))).toEqual([gn('g1', sn('s1')), sn('s3')]);
  });

  it('insertAfterNode inserts as the next sibling inside a group', () => {
    expect(insertAfterNode(tree(), 's1', sn('x'))).toEqual([gn('g1', sn('s1'), sn('x'), gn('g2', sn('s2'))), sn('s3')]);
  });

  it('moveWithinParent reorders only inside the parent', () => {
    expect(moveWithinParent([sn('s1'), sn('s2'), sn('s3')], 's1', 1)).toEqual([sn('s2'), sn('s1'), sn('s3')]);
    expect(moveWithinParent(tree(), 's1', 1)).toEqual([gn('g1', gn('g2', sn('s2')), sn('s1')), sn('s3')]);
  });

  it('findParent returns the parent id and index', () => {
    expect(findParent(tree(), 's2')).toEqual({ parentId: 'g2', index: 0 });
    expect(findParent(tree(), 's3')).toEqual({ parentId: null, index: 1 });
    expect(findParent(tree(), 'nope')).toBeNull();
  });

  it('subtreeIds includes the node itself', () => {
    expect(subtreeIds(tree(), 'g1')).toEqual({ surfaceIds: ['s1', 's2'], groupIds: ['g1', 'g2'] });
    expect(subtreeIds(tree(), 's3')).toEqual({ surfaceIds: ['s3'], groupIds: [] });
  });

  it('never mutates its input', () => {
    const t = tree();
    const before = JSON.stringify(t);
    removeNodes(t, new Set(['g2']));
    insertAfterNode(t, 's1', sn('x'));
    moveWithinParent(t, 's1', 1);
    expect(JSON.stringify(t)).toBe(before);
  });
});

describe('depth helpers', () => {
  const layers = [gn('g1', gn('g2', sn('a')), sn('b')), sn('c')];
  it('depthOf counts the top level as 1', () => {
    expect(depthOf(layers, 'c')).toBe(1);
    expect(depthOf(layers, 'a')).toBe(3);
    expect(depthOf(layers, 'nope')).toBeNull();
  });
  it('subtreeHeight counts the node itself', () => {
    expect(subtreeHeight(layers, 'c')).toBe(1);
    expect(subtreeHeight(layers, 'g1')).toBe(3);
    expect(subtreeHeight(layers, 'nope')).toBe(0);
  });
});
