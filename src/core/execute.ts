import {
  insufficientFunds,
  invalidArity,
  invalidControl,
  jsonResult,
  limitExceeded,
  malformedControl,
  missingAccount,
  missingOperation,
  unknownCommand,
} from "./errors.js";
import { checkControl } from "./control.js";
import type { ParsedMessage } from "./parseMessage.js";
import { isPing } from "./parseMessage.js";
import type { CommandResult } from "./result.js";
import {
  formatAccountId,
  formatOperationId,
  type Account,
  type Operation,
  type TokenState,
} from "../state/store.js";

const ARITY: Record<string, number> = {
  PING: 0,
  ALTA: 1,
  CONSULTA: 1,
  DEPOSITO: 2,
  TRANSFER: 3,
  ANULA: 1,
};

// V2 rechazó 100000 y 120000, y aceptó 40000. El umbral intermedio no está medido.
const TRANSFER_LIMIT = 100000;

export function executeMessage(parsed: ParsedMessage, state: TokenState): CommandResult {
  const command = parsed.command.toUpperCase();
  if (!isPing(parsed.command)) {
    const control = checkControl(parsed.command, parsed.args, parsed.control);
    if (control === "malformed") {
      return malformedControl;
    }
    if (control === "invalid") {
      return invalidControl;
    }
  }

  if (!(command in ARITY)) {
    return unknownCommand;
  }
  if (parsed.args.length !== ARITY[command]) {
    return invalidArity;
  }

  switch (command) {
    case "PING":
      return jsonResult(200, { pong: true });
    case "ALTA":
      return alta(parsed.args[0] ?? "", state);
    case "CONSULTA":
      return consulta(parsed.args[0] ?? "", state);
    case "DEPOSITO":
      return deposito(parsed.args[0] ?? "", parsed.args[1] ?? "", state);
    case "TRANSFER":
      return transfer(parsed.args[0] ?? "", parsed.args[1] ?? "", parsed.args[2] ?? "", state);
    case "ANULA":
      return anula(parsed.args[0] ?? "", state);
    default:
      return unknownCommand;
  }
}

function alta(name: string, state: TokenState): CommandResult {
  const id = formatAccountId(state.nextAccount);
  state.nextAccount += 1;
  state.accounts.push({ id, name, balance: 0 });
  return jsonResult(201, { cuentaId: id });
}

function consulta(accountId: string, state: TokenState): CommandResult {
  const account = findAccount(state, accountId);
  if (account === undefined) {
    return missingAccount;
  }
  return jsonResult(200, { cuenta_id: account.id, saldo: formatSaldo(account.balance) });
}

function deposito(accountId: string, rawAmount: string, state: TokenState): CommandResult {
  const amount = parseAmount(rawAmount);
  if (amount === undefined) {
    return invalidArity;
  }
  const account = findAccount(state, accountId);
  if (account === undefined) {
    return missingAccount;
  }
  account.balance += amount;
  return accepted(state, {
    kind: "deposito",
    amount,
    accountId,
    fromId: "",
    toId: accountId,
    anulada: false,
    id: "",
  });
}

function transfer(fromId: string, toId: string, rawAmount: string, state: TokenState): CommandResult {
  const amount = parseAmount(rawAmount);
  if (amount === undefined) {
    return invalidArity;
  }
  const from = findAccount(state, fromId);
  const to = findAccount(state, toId);
  if (from === undefined || to === undefined) {
    return missingAccount;
  }
  if (amount >= TRANSFER_LIMIT) {
    return limitExceeded;
  }
  if (amount > from.balance) {
    return insufficientFunds;
  }
  from.balance -= amount;
  to.balance += amount;
  return accepted(state, {
    kind: "transfer",
    amount,
    accountId: "",
    fromId,
    toId,
    anulada: false,
    id: "",
  });
}

function anula(operationId: string, state: TokenState): CommandResult {
  const operation = state.operations.find((item) => item.id === operationId);
  if (operation === undefined) {
    return missingOperation;
  }
  if (operation.anulada) {
    return jsonResult(200, { ok: false, motivo: "ya anulada" });
  }
  reverse(operation, state);
  operation.anulada = true;
  return jsonResult(200, { ok: true, anulada: operation.id });
}

function reverse(operation: Operation, state: TokenState): void {
  if (operation.kind === "deposito") {
    const account = findAccount(state, operation.accountId);
    if (account !== undefined) {
      account.balance -= operation.amount;
    }
    return;
  }
  const from = findAccount(state, operation.fromId);
  const to = findAccount(state, operation.toId);
  if (from !== undefined) {
    from.balance += operation.amount;
  }
  if (to !== undefined && to !== from) {
    to.balance -= operation.amount;
  }
}

function accepted(state: TokenState, draft: Operation): CommandResult {
  const id = formatOperationId(state.nextOperation);
  state.nextOperation += 1;
  state.operations.push({ ...draft, id });
  return jsonResult(200, { status: "recieved", operacionId: id });
}

function findAccount(state: TokenState, id: string): Account | undefined {
  return state.accounts.find((account) => account.id === id);
}

function formatSaldo(balance: number): string {
  const negative = balance < 0;
  const absolute = Math.abs(balance);
  const units = Math.trunc(absolute / 100);
  const cents = absolute % 100;
  const text = `${units}.${String(cents).padStart(2, "0")}`;
  return negative ? `-${text}` : text;
}

function parseAmount(raw: string): number | undefined {
  if (!/^\d+$/.test(raw)) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    return undefined;
  }
  return value;
}
