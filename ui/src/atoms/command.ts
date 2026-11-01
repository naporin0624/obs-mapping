import { atom } from 'jotai';
import { instancesAtom, type Instances } from './instances';

/** A write-only atom that forwards its arguments to one headless-app method. */
export const commandAtom = <A extends unknown[], R>(run: (instances: Instances, ...args: A) => R) => atom(null, (get, _set, ...args: A): R => run(get(instancesAtom), ...args));
