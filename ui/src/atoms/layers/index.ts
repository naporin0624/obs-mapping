import { atom } from 'jotai';

export const collapsedGroupsAtom = atom<ReadonlySet<string>>(new Set<string>());

export const toggleCollapsedAtom = atom(null, (get, set, groupId: string) => {
  const next = new Set(get(collapsedGroupsAtom));
  if (!next.delete(groupId)) next.add(groupId);
  set(collapsedGroupsAtom, next);
});
