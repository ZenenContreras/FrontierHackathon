// Traduce respuestas históricas de V1 a lo que el reemplazo debe devolver
// tras las dos diferencias confirmadas en V2. No es una captura nueva.
// "cascada-local" es una consecuencia del rechazo de 100000, no una medición de V2.

export type OracleNote = "historico-v1" | "captura-v2" | "v2-confirmado" | "cascada-local";

export interface OracleExpectation {
  status: number;
  response: unknown;
  note: OracleNote;
}

export function formatSaldo(balance: number): string {
  const negative = balance < 0;
  const absolute = Math.abs(balance);
  const units = Math.trunc(absolute / 100);
  const cents = absolute % 100;
  const text = `${units}.${String(cents).padStart(2, "0")}`;
  return negative ? `-${text}` : text;
}

function isSaldoNumber(response: unknown): response is { saldo: number } & Record<string, unknown> {
  return typeof response === "object"
    && response !== null
    && "saldo" in response
    && typeof response.saldo === "number";
}

export function replacementOracle(id: number, status: number, response: unknown): OracleExpectation {
  if (id === 75) {
    return {
      status: 422,
      response: { error: "E506", mensaje: "límite excedido" },
      note: "v2-confirmado",
    };
  }
  if (id === 76 || id === 77) {
    return {
      status: 404,
      response: { error: "E402", mensaje: "operación inexistente" },
      note: "cascada-local",
    };
  }
  if (isSaldoNumber(response)) {
    return {
      status,
      response: { ...response, saldo: formatSaldo(response.saldo) },
      note: id === 78 ? "cascada-local" : "v2-confirmado",
    };
  }
  return { status, response, note: "historico-v1" };
}

export const EJEMPLO_OVERRIDES: Record<number, OracleExpectation> = {
  5: {
    status: 200,
    response: { cuenta_id: "AC-0001", saldo: "0.00" },
    note: "v2-confirmado",
  },
  8: {
    status: 200,
    response: { cuenta_id: "AC-0002", saldo: "400.00" },
    note: "v2-confirmado",
  },
  10: {
    status: 422,
    response: { error: "E506", mensaje: "límite excedido" },
    note: "v2-confirmado",
  },
  11: {
    status: 200,
    response: { cuenta_id: "AC-0001", saldo: "2100.00" },
    note: "cascada-local",
  },
  13: {
    status: 404,
    response: { error: "E402", mensaje: "operación inexistente" },
    note: "cascada-local",
  },
  14: {
    status: 404,
    response: { error: "E402", mensaje: "operación inexistente" },
    note: "cascada-local",
  },
  18: {
    status: 200,
    response: { status: "recieved", operacionId: "OP-0003" },
    note: "cascada-local",
  },
  19: {
    status: 200,
    response: { cuenta_id: "AC-0002", saldo: "407.00" },
    note: "cascada-local",
  },
};
