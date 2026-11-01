export type Store<S> = { get: () => S; patch: (change: Partial<S>) => S };

export const createStore = <S>(initial: S): Store<S> => {
  let state = initial;
  return {
    get: () => state,
    patch: (change) => {
      state = { ...state, ...change };
      return state;
    },
  };
};
