import type { CommandResult } from "../core/result.js";

/**
 * Respuestas de infraestructura, no del contrato observado.
 * El 200 de GET /health solo cumple el requisito de entrega de “listo”.
 * Su cuerpo vacío, el 200 de POST /__reset y los errores de este módulo
 * son supuestos: todavía no hay experimentos que los confirmen.
 */

export function provisionalHealth(): CommandResult {
  return { status: 200, payload: { kind: "empty" } };
}

export function provisionalReset(): CommandResult {
  return { status: 200, payload: { kind: "empty" } };
}

export function provisionalUnknown(method: string, path: string): CommandResult {
  return {
    status: 404,
    payload: {
      kind: "json",
      value: { provisional: true, method, path },
    },
  };
}

export function provisionalInvalidJson(): CommandResult {
  return {
    status: 400,
    payload: {
      kind: "json",
      value: { provisional: true, reason: "invalid-json" },
    },
  };
}

export function provisionalUnhandled(): CommandResult {
  return {
    status: 500,
    payload: {
      kind: "json",
      value: { provisional: true, reason: "unhandled" },
    },
  };
}
