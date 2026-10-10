export type TokenState = Record<string, never>;

export interface StateStore {
  get(stateKey: string): TokenState;
  reset(stateKey: string): void;
}

export function createInitialState(): TokenState {
  return {};
}

export function createStateStore(): StateStore {
  const states = new Map<string, TokenState>();

  return {
    get(stateKey: string): TokenState {
      const existing = states.get(stateKey);
      if (existing) {
        return existing;
      }
      const created = createInitialState();
      states.set(stateKey, created);
      return created;
    },
    reset(stateKey: string): void {
      states.set(stateKey, createInitialState());
    },
  };
}
