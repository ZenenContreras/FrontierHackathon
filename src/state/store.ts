export interface Account {
  id: string;
  name: string;
  balance: number;
}

export interface Operation {
  id: string;
  kind: "deposito" | "transfer";
  amount: number;
  accountId: string;
  fromId: string;
  toId: string;
  anulada: boolean;
}

export interface TokenState {
  accounts: Account[];
  operations: Operation[];
  nextAccount: number;
  nextOperation: number;
}

export interface StateStore {
  get(stateKey: string): TokenState;
  reset(stateKey: string): void;
}

export function createInitialState(): TokenState {
  return {
    accounts: [],
    operations: [],
    nextAccount: 1,
    nextOperation: 1,
  };
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

export function formatAccountId(n: number): string {
  return `AC-${String(n).padStart(4, "0")}`;
}

export function formatOperationId(n: number): string {
  return `OP-${String(n).padStart(4, "0")}`;
}
