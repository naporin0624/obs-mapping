// Error wording matches core/src/layers_json.cpp so both ends report the same text.
export const MAX_TREE_DEPTH = 16;
export const MAX_SPACING = 4096;

/** The tree-related fields of a mapping as they arrive from JSON (nothing is trusted yet). */
export type RawTree = { surfaces: readonly unknown[]; groups?: unknown; layers?: unknown };

class TreeError extends Error {}

const fail = (path: string, message: string): never => {
  throw new TreeError(`${path}: ${message}`);
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const join = (base: string, key: string): string => (base === '' ? key : `${base}.${key}`);

const indexPath = (base: string, key: string, i: number): string => `${join(base, key)}[${String(i)}]`;

const requireKey = (obj: unknown, key: string, path: string): unknown => {
  if (!isRecord(obj)) return fail(path, 'expected object');
  return Object.hasOwn(obj, key) ? obj[key] : fail(join(path, key), 'missing');
};

const asString = (v: unknown, path: string): string => (typeof v === 'string' ? v : fail(path, 'expected string'));

const asNumber = (v: unknown, path: string): number => (typeof v === 'number' && Number.isFinite(v) ? v : fail(path, 'expected number'));

const asArray = (v: unknown, path: string): readonly unknown[] => (Array.isArray(v) ? (v as readonly unknown[]) : fail(path, 'expected array'));

const checkSpacing = (layout: unknown, key: string, path: string): void => {
  const p = join(path, key);
  const v = asNumber(requireKey(layout, key, path), p);
  if (v < 0 || v > MAX_SPACING) fail(p, `must be between 0 and ${String(MAX_SPACING)}`);
};

const checkEnum = (layout: unknown, key: string, allowed: readonly string[], path: string): void => {
  const p = join(path, key);
  const v = asString(requireKey(layout, key, path), p);
  if (!allowed.includes(v)) fail(p, `unknown ${key} "${v}"`);
};

const checkLayout = (group: unknown, path: string): void => {
  const p = join(path, 'layout');
  const layout = requireKey(group, 'layout', path);
  if (!isRecord(layout)) fail(p, 'expected object');
  checkEnum(layout, 'direction', ['row', 'column'], p);
  checkSpacing(layout, 'gap', p);
  checkEnum(layout, 'align', ['start', 'center', 'end'], p);
  checkSpacing(layout, 'padding', p);
};

const checkOrigin = (group: unknown, path: string): void => {
  const p = join(path, 'origin');
  const origin = requireKey(group, 'origin', path);
  if (!Array.isArray(origin) || origin.length !== 2) fail(p, 'expected [x, y]');
  const [x, y] = origin as unknown[];
  asNumber(x, `${p}[0]`);
  asNumber(y, `${p}[1]`);
};

const checkVisible = (group: unknown, path: string): void => {
  if (isRecord(group) && Object.hasOwn(group, 'visible') && typeof group['visible'] !== 'boolean') fail(join(path, 'visible'), 'expected boolean');
};

const checkGroupId = (group: unknown, path: string, ids: Set<string>): string => {
  const p = join(path, 'id');
  const id = asString(requireKey(group, 'id', path), p);
  if (id === '') fail(p, 'must not be empty');
  if (ids.has(id)) fail(p, `duplicate id "${id}"`);
  ids.add(id);
  return id;
};

const checkGroup = (group: unknown, i: number, ids: Set<string>): string => {
  const path = indexPath('', 'groups', i);
  if (!isRecord(group)) fail(path, 'expected object');
  const id = checkGroupId(group, path, ids);
  asString(requireKey(group, 'name', path), join(path, 'name'));
  checkVisible(group, path);
  checkOrigin(group, path);
  checkLayout(group, path);
  return id;
};

type TreeContext = { surfaces: ReadonlySet<string>; groups: ReadonlySet<string>; seen: Set<string> };

const checkReference = (node: Record<string, unknown>, kind: 'surface' | 'group', path: string, ctx: TreeContext): string => {
  const p = join(path, kind);
  const id = asString(node[kind], p);
  if (!(kind === 'surface' ? ctx.surfaces : ctx.groups).has(id)) fail(p, `unknown ${kind} "${id}"`);
  if (ctx.seen.has(id)) fail(p, `${kind} "${id}" appears more than once`);
  ctx.seen.add(id);
  return id;
};

const checkNode = (node: unknown, path: string, depth: number, ctx: TreeContext): void => {
  if (!isRecord(node)) return fail(path, 'expected object');
  if (depth > MAX_TREE_DEPTH) return fail(path, `depth exceeds ${String(MAX_TREE_DEPTH)}`);
  const isSurface = Object.hasOwn(node, 'surface');
  if (isSurface === Object.hasOwn(node, 'group')) return fail(path, 'expected exactly one of "surface" or "group"');
  if (isSurface) return void checkReference(node, 'surface', path, ctx);
  checkReference(node, 'group', path, ctx);
  return checkChildren(node, path, depth, ctx);
};

const checkChildren = (node: Record<string, unknown>, path: string, depth: number, ctx: TreeContext): void => {
  const children = asArray(requireKey(node, 'children', path), join(path, 'children'));
  children.forEach((child, i) => checkNode(child, indexPath(path, 'children', i), depth + 1, ctx));
};

const checkAllInTree = (surfaceIds: readonly string[], groupIds: readonly string[], seen: ReadonlySet<string>): void => {
  surfaceIds.filter((id) => !seen.has(id)).forEach((id) => fail('layers', `surface "${id}" is missing from the tree`));
  groupIds.filter((id) => !seen.has(id)).forEach((id) => fail('layers', `group "${id}" is missing from the tree`));
};

const surfaceIdsOf = (surfaces: readonly unknown[]): string[] => surfaces.flatMap((s) => (isRecord(s) && typeof s['id'] === 'string' ? [s['id']] : []));

const checkSurfaceIds = (surfaces: readonly unknown[]): void => {
  const seen = new Set<string>();
  surfaces.forEach((s, i) => {
    const id = isRecord(s) && typeof s['id'] === 'string' ? s['id'] : null;
    if (id === null) return;
    if (seen.has(id)) fail(indexPath('', 'surfaces', i) + '.id', `duplicate id "${id}"`);
    seen.add(id);
  });
};

const run = (m: RawTree): void => {
  checkSurfaceIds(m.surfaces);
  const surfaceIds = surfaceIdsOf(m.surfaces);
  const ids = new Set(surfaceIds);
  const groupIds = asArray(requireKey(m, 'groups', ''), 'groups').map((g, i) => checkGroup(g, i, ids));
  const layers = asArray(requireKey(m, 'layers', ''), 'layers');
  const ctx: TreeContext = { surfaces: new Set(surfaceIds), groups: new Set(groupIds), seen: new Set() };
  layers.forEach((node, i) => checkNode(node, indexPath('', 'layers', i), 1, ctx));
  checkAllInTree(surfaceIds, groupIds, ctx.seen);
  // A Set keeps insertion order, which is the depth-first visiting order.
  const visited = [...ctx.seen].filter((id) => ctx.surfaces.has(id));
  if (visited.join('\n') !== surfaceIds.join('\n')) fail('surfaces', 'order must match the depth-first order of layers');
};

/** Checks `groups` and `layers` the way the plugin does; surface fields themselves are left to the plugin. */
export const validateTree = (m: RawTree): string | null => {
  try {
    run(m);
    return null;
  } catch (e) {
    if (e instanceof TreeError) return e.message;
    throw e;
  }
};
