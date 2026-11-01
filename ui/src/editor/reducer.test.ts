import { describe, expect, it } from 'vitest';
import { surf } from '../geometry/fixtures';
import type { Mapping } from '../model/mapping';
import { reducer, type Action } from './reducer';
import { canonicalJson, initialEditorState, type EditorState } from './state';

const mk = (...ss: ReturnType<typeof surf>[]): Mapping => ({ version: 1, canvas: { width: 1920, height: 1080 }, grid: { size: 10 }, surfaces: ss });
const run = (s: EditorState, ...as: Action[]): EditorState => as.reduce(reducer, s);
const sel = (ids: string[], corner: EditorState['selection']['corner'] = null) => ({ type: 'select', selection: { surfaceIds: ids, corner } }) as const;
const base = () => initialEditorState(mk(surf('a', 0, 0), surf('b', 100, 0)));

describe('drag history', () => {
  it('undoes a whole drag in one step', () => {
    const s = run(
      base(),
      { type: 'dragStart' },
      { type: 'dragCorner', surfaceId: 'a', index: 0, to: [1, 1] },
      { type: 'dragCorner', surfaceId: 'a', index: 0, to: [2, 2] },
      { type: 'dragCorner', surfaceId: 'a', index: 0, to: [3, 3] },
      { type: 'dragEnd' },
    );
    expect(s.mapping.surfaces[0]?.corners[0]).toEqual([3, 3]);
    expect(s.past).toHaveLength(1);
    expect(run(s, { type: 'undo' }).mapping).toEqual(base().mapping);
  });
  it('dragSurface moves live and a no-op drag leaves no history', () => {
    const moved = run(base(), { type: 'dragStart' }, { type: 'dragSurface', surfaceId: 'a', dx: 5, dy: 0 });
    expect(moved.mapping.surfaces[0]?.corners[0]).toEqual([5, 0]);
    expect(run(base(), { type: 'dragStart' }, { type: 'dragEnd' }).past).toHaveLength(0);
  });
});

describe('edits', () => {
  it('nudge moves only the selected corner', () => {
    const s = run(base(), sel(['a'], { surfaceId: 'a', index: 2 }), { type: 'nudge', dx: 1, dy: 2 });
    expect(s.mapping.surfaces[0]?.corners).toEqual([
      [0, 0],
      [10, 0],
      [11, 12],
      [0, 10],
    ]);
  });
  it('nudge moves the whole surface without a corner, and is a no-op with no selection', () => {
    const s = run(base(), sel(['a']), { type: 'nudge', dx: 1, dy: 2 });
    expect(s.mapping.surfaces[0]?.corners[0]).toEqual([1, 2]);
    expect(s.mapping.surfaces[1]?.corners[0]).toEqual([100, 0]);
    const n = base();
    expect(reducer(n, { type: 'nudge', dx: 1, dy: 1 })).toBe(n);
  });
  it('setBounds makes the surface that rectangle', () => {
    const s = run(base(), { type: 'setBounds', surfaceId: 'a', bounds: { x: 5, y: 6, width: 7, height: 8 } });
    expect(s.mapping.surfaces[0]?.corners).toEqual([
      [5, 6],
      [12, 6],
      [12, 14],
      [5, 14],
    ]);
  });
  it('align with no selection is a no-op', () => {
    const n = base();
    expect(reducer(n, { type: 'align', mode: 'left' })).toBe(n);
  });
  it('align pushes history', () => {
    const s = run(base(), sel(['a', 'b']), { type: 'align', mode: 'right' });
    expect(s.mapping.surfaces[0]?.corners[0][0]).toBe(100);
    expect(s.past).toHaveLength(1);
  });
  it('removeSelected clears the selection', () => {
    const s = run(base(), sel(['a']), { type: 'removeSelected' });
    expect(s.mapping.surfaces.map((x) => x.id)).toEqual(['b']);
    expect(s.selection).toEqual({ surfaceIds: [], corner: null });
  });
  it('addSurface numbers ids s-1, s-2 and selects the new one, centred at 1/4 size', () => {
    const s = run(initialEditorState(mk()), { type: 'addSurface', source: 'cam' }, { type: 'addSurface', source: 'cam' });
    expect(s.mapping.surfaces.map((x) => x.id)).toEqual(['s-1', 's-2']);
    expect(s.selection.surfaceIds).toEqual(['s-2']);
    expect(s.mapping.surfaces[0]?.corners[0]).toEqual([720, 405]);
    expect(s.mapping.surfaces[0]?.corners[2]).toEqual([1200, 675]);
  });
  it('duplicateSelected offsets, renames, inserts after, and selects copies', () => {
    const s = run(initialEditorState(mk(surf('s-1', 0, 0), surf('s-2', 50, 0))), sel(['s-1']), { type: 'duplicateSelected' });
    expect(s.mapping.surfaces.map((x) => x.id)).toEqual(['s-1', 's-3', 's-2']);
    expect(s.mapping.surfaces[1]?.name).toBe('s-1 のコピー');
    expect(s.mapping.surfaces[1]?.corners[0]).toEqual([20, 20]);
    expect(s.selection.surfaceIds).toEqual(['s-3']);
  });
  it('reorder, patchSurface and setGrid', () => {
    const s = run(base(), { type: 'reorder', surfaceId: 'a', toIndex: 1 }, { type: 'patchSurface', surfaceId: 'a', patch: { visible: false } }, { type: 'setGrid', size: 20 });
    expect(s.mapping.surfaces.map((x) => x.id)).toEqual(['b', 'a']);
    expect(s.mapping.surfaces[1]?.visible).toBe(false);
    expect(s.mapping.grid.size).toBe(20);
    expect(s.past).toHaveLength(3);
  });
  it('setGrid ignores out-of-range sizes', () => {
    const n = base();
    for (const size of [0, -1, 1025, Number.NaN]) expect(reducer(n, { type: 'setGrid', size })).toBe(n);
  });
});

describe('history', () => {
  it('undo then redo round-trips and a new edit clears future', () => {
    const edited = run(base(), sel(['a']), { type: 'nudge', dx: 1, dy: 0 });
    const undone = run(edited, { type: 'undo' });
    expect(undone.mapping).toEqual(base().mapping);
    expect(undone.future).toHaveLength(1);
    expect(run(undone, { type: 'redo' }).mapping).toEqual(edited.mapping);
    expect(run(undone, { type: 'nudge', dx: 2, dy: 0 }).future).toHaveLength(0);
  });
  it('caps past at 100', () => {
    const s = Array.from({ length: 105 }, () => ({ type: 'nudge', dx: 1, dy: 0 }) as const).reduce(reducer, run(base(), sel(['a'])));
    expect(s.past).toHaveLength(100);
  });
  it('selection-only, sent and remote echo never push', () => {
    const s = run(base(), sel(['a']), { type: 'sent', requestId: 'x', json: 'x' });
    expect(s.past).toHaveLength(0);
  });
});

describe('remote sync', () => {
  it('replaces the mapping when idle, keeping history and pruning selection', () => {
    const edited = run(base(), sel(['a', 'b']), { type: 'nudge', dx: 1, dy: 0 });
    const s = reducer(edited, { type: 'remote', mapping: mk(surf('b', 0, 0)), requestId: null });
    expect(s.mapping.surfaces.map((x) => x.id)).toEqual(['b']);
    expect(s.selection.surfaceIds).toEqual(['b']);
    expect(s.past).toEqual(edited.past);
  });
  it('holds remote while dragging and discards it on dragEnd', () => {
    const dragging = run(base(), { type: 'dragStart' }, { type: 'dragSurface', surfaceId: 'a', dx: 5, dy: 0 });
    const held = reducer(dragging, { type: 'remote', mapping: mk(surf('z', 0, 0)), requestId: null });
    expect(held.mapping).toBe(dragging.mapping);
    expect(held.pendingRemote).not.toBeNull();
    const ended = reducer(held, { type: 'dragEnd' });
    expect(ended.pendingRemote).toBeNull();
    expect(ended.mapping.surfaces.map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('ignores an echo of a sent mapping even with reordered keys and number formats', () => {
    const s = run(base(), { type: 'sent', requestId: 'r0', json: canonicalJson(base().mapping) });
    const echo = JSON.parse(
      '{"surfaces":[{"visible":true,"corners":[[0.0,0],[10,0],[10,10],[-0,10]],"crop":{"height":1,"width":1,"y":0,"x":0},"source":"src","type":"quad","name":"a","id":"a"},' +
        '{"visible":true,"corners":[[100,0],[110,0],[110,10],[100,10]],"crop":{"x":0,"y":0,"width":1,"height":1},"source":"src","type":"quad","name":"b","id":"b"}],' +
        '"grid":{"size":10.0},"canvas":{"height":1080,"width":1920},"version":1}',
    ) as Mapping;
    const after = reducer(s, { type: 'remote', mapping: echo, requestId: 'r0' });
    expect(after.mapping).toBe(s.mapping);
    expect(after.inFlight).toEqual([]);
  });
  const sendNudge = (s: EditorState, dx: number): EditorState => {
    const n = reducer(s, { type: 'nudge', dx, dy: 0 });
    return reducer(n, { type: 'sent', requestId: `r${String(s.inFlight.length + 1)}`, json: canonicalJson(n.mapping) });
  };
  const z = () => mk(surf('z', 0, 0));
  it('an own echo never replaces the local mapping, even if local edits diverged during the round trip', () => {
    const sent = sendNudge(run(base(), sel(['a'])), 1);
    const sentMapping = sent.mapping;
    const edited = reducer(sent, { type: 'nudge', dx: 5, dy: 0 }); // local edit not yet sent
    const after = reducer(edited, { type: 'remote', mapping: sentMapping, requestId: 'r1' });
    expect(after.mapping).toBe(edited.mapping);
    expect(after.inFlight).toEqual([]);
  });
  it('a foreign remote still replaces the local mapping and keeps inFlight', () => {
    const a = sendNudge(run(base(), sel(['a'])), 1);
    const atZ = reducer(a, { type: 'remote', mapping: z(), requestId: null });
    expect(atZ.mapping.surfaces.map((x) => x.id)).toEqual(['z']);
    expect(atZ.inFlight).toEqual(a.inFlight);
  });
  it('an echo consumes the entries up to and including its id', () => {
    const a = sendNudge(run(base(), sel(['a'])), 1);
    const dup = reducer(a, { type: 'sent', requestId: 'r2', json: 'dup' });
    const mid = reducer(dup, { type: 'sent', requestId: 'r3', json: 'other' });
    const after = reducer(mid, { type: 'remote', mapping: a.mapping, requestId: 'r2' });
    expect(after.inFlight.map((e) => e.requestId)).toEqual(['r3']);
  });
  it('send A, send B, echo A is ignored, echo B no-ops', () => {
    const a = sendNudge(run(base(), sel(['a'])), 1);
    const mapA = a.mapping;
    const b = sendNudge(a, 1);
    const e1 = reducer(b, { type: 'remote', mapping: mapA, requestId: 'r1' });
    expect(e1.mapping).toBe(b.mapping);
    const e2 = reducer(e1, { type: 'remote', mapping: b.mapping, requestId: 'r2' });
    expect(e2.mapping).toBe(b.mapping);
    expect(e2.inFlight).toEqual([]);
  });
  it('A, B, echoes, then external Z ends on Z', () => {
    const a = sendNudge(run(base(), sel(['a'])), 1);
    const mapA = a.mapping;
    const b = sendNudge(a, 1);
    const end = run(b, { type: 'remote', mapping: mapA, requestId: 'r1' }, { type: 'remote', mapping: b.mapping, requestId: 'r2' }, { type: 'remote', mapping: z(), requestId: null });
    expect(end.mapping).toEqual(z());
  });
  describe('needsResync', () => {
    const azb = () => {
      const a = sendNudge(run(base(), sel(['a'])), 1);
      const mapA = a.mapping;
      const b = sendNudge(a, 1);
      return { mapA, b, atZ: reducer(b, { type: 'remote', mapping: z(), requestId: null }) };
    };
    it('is set by a foreign remote while own sends are in flight', () => {
      const { atZ } = azb();
      expect(atZ.needsResync).toBe(true);
      expect(atZ.mapping).toEqual(z());
    });
    it('stays set while own echoes drain inFlight; the reducer does not clear it', () => {
      const { mapA, b, atZ } = azb();
      const e1 = reducer(atZ, { type: 'remote', mapping: mapA, requestId: 'r1' });
      expect(e1.needsResync).toBe(true);
      expect(e1.mapping).toBe(atZ.mapping);
      const e2 = reducer(e1, { type: 'remote', mapping: b.mapping, requestId: 'r2' });
      expect(e2.inFlight).toEqual([]);
      expect(e2.needsResync).toBe(true);
    });
    it('is cleared by a remote applied with inFlight empty', () => {
      const { mapA, b, atZ } = azb();
      const drained = run(atZ, { type: 'remote', mapping: mapA, requestId: 'r1' }, { type: 'remote', mapping: b.mapping, requestId: 'r2' });
      expect(reducer(drained, { type: 'remote', mapping: b.mapping, requestId: null }).needsResync).toBe(false);
    });
    it('is cleared by load', () => {
      expect(reducer(azb().atZ, { type: 'load', mapping: base().mapping }).needsResync).toBe(false);
    });
    it('stays false for a foreign remote with inFlight empty', () => {
      expect(reducer(base(), { type: 'remote', mapping: z(), requestId: null }).needsResync).toBe(false);
    });
  });
  it('caps inFlight at 32', () => {
    const s = Array.from({ length: 40 }, (_, i) => ({ type: 'sent', requestId: String(i), json: String(i) }) as const).reduce(reducer, base());
    expect(s.inFlight).toHaveLength(32);
    expect(s.inFlight[0]?.requestId).toBe('8');
  });
  it('ignores mapping-changing edits while dragging', () => {
    const d = run(base(), sel(['a']), { type: 'dragStart' });
    for (const a of [{ type: 'nudge', dx: 1, dy: 0 }, { type: 'removeSelected' }, { type: 'setGrid', size: 20 }, { type: 'undo' }] as const) {
      expect(reducer(d, a)).toBe(d);
    }
  });
  it('load resets everything', () => {
    const s = run(base(), sel(['a']), { type: 'nudge', dx: 1, dy: 0 }, { type: 'load', mapping: mk() });
    expect(s).toEqual(initialEditorState(mk()));
  });
});

describe('canonicalJson', () => {
  it('sorts keys and normalises numbers but keeps array order', () => {
    expect(canonicalJson({ ...mk(), grid: { size: 1.0 } })).toBe(canonicalJson(JSON.parse('{"grid":{"size":1},"surfaces":[],"canvas":{"height":1080,"width":1920},"version":1}')));
    expect(canonicalJson(mk(surf('a', 0, 0), surf('b', 1, 1)))).not.toBe(canonicalJson(mk(surf('b', 1, 1), surf('a', 0, 0))));
  });
});

describe('request-id echo (#4)', () => {
  const sendCurrent = (s: EditorState, requestId: string): EditorState => reducer(s, { type: 'sent', requestId, json: canonicalJson(s.mapping) });
  const echo = (s: EditorState, mapping: Mapping, requestId: string | null): EditorState => reducer(s, { type: 'remote', mapping, requestId });

  it('A, B, A sent then echoed in order never flashes the local mapping to B', () => {
    const start = run(base(), sel(['a']), { type: 'nudge', dx: 1, dy: 0 });
    const mapA = start.mapping;
    const sentA = sendCurrent(start, 'r1');
    const sentB = sendCurrent(reducer(sentA, { type: 'nudge', dx: 1, dy: 0 }), 'r2');
    const mapB = sentB.mapping;
    const sentA2 = sendCurrent(reducer(sentB, { type: 'undo' }), 'r3');
    expect(sentA2.mapping).toBe(mapA);
    const e1 = echo(sentA2, mapA, 'r1');
    const e2 = echo(e1, mapB, 'r2');
    const e3 = echo(e2, mapA, 'r3');
    expect([e1.mapping, e2.mapping, e3.mapping]).toEqual([mapA, mapA, mapA]);
    expect(e3.inFlight).toEqual([]);
    expect(e3.needsResync).toBe(false);
  });
  it('an unknown id is foreign: it replaces local and flags a resync', () => {
    const sent = sendCurrent(run(base(), sel(['a']), { type: 'nudge', dx: 1, dy: 0 }), 'r1');
    const after = echo(sent, mk(surf('z', 0, 0)), 'other-dock-7');
    expect(after.mapping.surfaces.map((x) => x.id)).toEqual(['z']);
    expect(after.inFlight).toEqual(sent.inFlight);
    expect(after.needsResync).toBe(true);
  });
  it('an echo with an id but unchanged content is still an acknowledgement', () => {
    const sent = sendCurrent(base(), 'r1');
    const after = echo(sent, base().mapping, 'r1');
    expect(after.mapping).toBe(sent.mapping);
    expect(after.inFlight).toEqual([]);
  });
  describe('plugin without requestId', () => {
    it('matches by content against the oldest entry only (FIFO), consuming one', () => {
      const start = run(base(), sel(['a']), { type: 'nudge', dx: 1, dy: 0 });
      const mapA = start.mapping;
      const sentA = sendCurrent(start, 'r1');
      const sentB = sendCurrent(reducer(sentA, { type: 'nudge', dx: 1, dy: 0 }), 'r2');
      const mapB = sentB.mapping;
      const sentA2 = sendCurrent(reducer(sentB, { type: 'undo' }), 'r3');
      const e1 = echo(sentA2, mapA, null);
      expect(e1.inFlight.map((e) => e.requestId)).toEqual(['r2', 'r3']);
      const e2 = echo(e1, mapB, null);
      const e3 = echo(e2, mapA, null);
      expect([e1.mapping, e2.mapping, e3.mapping]).toEqual([mapA, mapA, mapA]);
      expect(e3.inFlight).toEqual([]);
    });
    it('content that is not the oldest entry is foreign', () => {
      const sent = sendCurrent(run(base(), sel(['a']), { type: 'nudge', dx: 1, dy: 0 }), 'r1');
      const after = echo(sent, mk(surf('z', 0, 0)), null);
      expect(after.mapping.surfaces.map((x) => x.id)).toEqual(['z']);
      expect(after.needsResync).toBe(true);
    });
  });
});

describe('resync snapshots and late echoes (#4 review)', () => {
  const sentTwice = (): EditorState => {
    const a = run(base(), sel(['a']), { type: 'nudge', dx: 1, dy: 0 });
    const s1 = reducer(a, { type: 'sent', requestId: 'r1', json: canonicalJson(a.mapping) });
    const b = reducer(s1, { type: 'nudge', dx: 1, dy: 0 });
    return reducer(b, { type: 'sent', requestId: 'r2', json: canonicalJson(b.mapping) });
  };

  it('a snapshot equal to local drains inFlight and keeps the mapping reference', () => {
    const s = { ...sentTwice(), needsResync: true };
    const after = reducer(s, { type: 'resynced', mapping: JSON.parse(JSON.stringify(s.mapping)) as Mapping });
    expect(after.mapping).toBe(s.mapping);
    expect(after.inFlight).toEqual([]);
    expect(after.needsResync).toBe(false);
  });
  it('a different snapshot replaces local, drains inFlight and prunes selection', () => {
    const s = sentTwice();
    const after = reducer(s, { type: 'resynced', mapping: mk(surf('z', 0, 0)) });
    expect(after.mapping.surfaces.map((x) => x.id)).toEqual(['z']);
    expect(after.selection.surfaceIds).toEqual([]);
    expect(after.inFlight).toEqual([]);
    expect(after.needsResync).toBe(false);
  });
  it('a snapshot arriving mid-drag is held like a remote', () => {
    const dragging = run(sentTwice(), { type: 'dragStart' });
    const held = reducer(dragging, { type: 'resynced', mapping: mk() });
    expect(held.mapping).toBe(dragging.mapping);
    expect(held.inFlight).toBe(dragging.inFlight);
  });
  it('a late echo of our own keeps local and asks for a resync even with inFlight empty', () => {
    const idle = base();
    const s = reducer(idle, { type: 'staleEcho' });
    expect(s.mapping).toBe(idle.mapping);
    expect(s.needsResync).toBe(true);
  });
});
