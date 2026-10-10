import type { CommandResult } from "./result.js";

export function errorResult(status: number, code: string, mensaje: string): CommandResult {
  return {
    status,
    payload: {
      kind: "json",
      value: { error: code, mensaje },
    },
  };
}

export function jsonResult(status: number, value: unknown): CommandResult {
  return {
    status,
    payload: { kind: "json", value },
  };
}

export const unauthorized = errorResult(401, "E001", "no autorizado");
export const invalidJson = errorResult(400, "E100", "json inválido");
export const missingM = errorResult(400, "E102", "falta m");
export const missingControl = errorResult(400, "E103", "falta control");
export const emptySegment = errorResult(400, "E104", "segmento vacío");
export const malformedControl = errorResult(400, "E201", "control mal formado");
export const invalidControl = errorResult(400, "E202", "control inválido");
export const unknownCommand = errorResult(400, "E301", "comando desconocido ");
export const invalidArity = errorResult(400, "E302", "aridad inválida");
export const missingAccount = errorResult(404, "E401", "cuenta inexistente");
export const missingOperation = errorResult(404, "E402", "operación inexistente");
export const unknownRoute = errorResult(404, "E404", "ruta desconocida");
export const limitExceeded = errorResult(422, "E506", "límite excedido");
export const insufficientFunds = errorResult(422, "E507", "saldo insuficiente");
