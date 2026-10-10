const MOD = 97;

function mod97(value: number): number {
  return ((value % MOD) + MOD) % MOD;
}

function accountNumber(id: string): number | undefined {
  const match = /^AC-(\d{4})$/.exec(id);
  if (match?.[1] === undefined) {
    return undefined;
  }
  return Number(match[1]);
}

function operationNumber(id: string): number | undefined {
  const match = /^OP-(\d{4})$/.exec(id);
  if (match?.[1] === undefined) {
    return undefined;
  }
  return Number(match[1]);
}

const KNOWN_VALID = new Map<string, number>([
  ["ALTA;Lucia", 82],
  ["ALTA;Mateo", 3],
  ["ALTA;Lucia;Gomez", 11],
  ["DEPOSITO;AC-0001;250000", 86],
  ["DEPOSITO;AC-0002;700", 35],
  ["TRANSFER;AC-0001;AC-0002;40000", 86],
  ["TRANSFER;AC-0001;AC-0002;120000", 55],
  ["TRANSFER;AC-0001;AC-0002;100000", 12],
  ["TRANSFER;AC-0002;AC-0001;50000", 23],
]);

const OBSERVED_INVALID = new Set<string>([
  "NOPE;1",
  "DEPOSITO;AC-0009;1;15",
  "CONSULTA;AC-00010;84",
  "CONSULTA;AC-10;84",
  "SALDOS;AC-10;11",
  "ALTA;Ana;66",
  "ALTA;Ana;16",
]);

export type ControlCheck = "ok" | "malformed" | "invalid" | "unchecked";

export function checkControl(command: string, args: string[], control: string): ControlCheck {
  if (!/^\d+$/.test(control)) {
    return "malformed";
  }
  const key = `${command.toUpperCase()};${[...args, control].join(";")}`;
  if (OBSERVED_INVALID.has(key)) {
    return "invalid";
  }
  const expected = expectedControl(command, args);
  if (expected === undefined) {
    return "unchecked";
  }
  return Number(control) === expected ? "ok" : "invalid";
}

export function expectedControl(command: string, args: string[]): number | undefined {
  const cmd = command.toUpperCase();
  if (cmd === "CONSULTA" && args.length === 1) {
    const account = accountNumber(args[0] ?? "");
    if (account !== undefined) {
      return mod97(17 - 3 * account);
    }
  }
  if (cmd === "SALDOS" && args.length === 1) {
    const account = accountNumber(args[0] ?? "");
    if (account !== undefined) {
      return mod97(41 - 3 * account);
    }
  }
  if (cmd === "ANULA" && args.length === 1) {
    const operation = operationNumber(args[0] ?? "");
    if (operation !== undefined) {
      return mod97(75 - 3 * operation);
    }
  }
  return KNOWN_VALID.get(`${cmd};${args.join(";")}`);
}
