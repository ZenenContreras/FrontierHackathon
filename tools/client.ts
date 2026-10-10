import { computeGap, headerValue, interpretResponseBody, interpretXReq } from "./interpret.js";
import { readQuota, reserveQuota } from "./quota.js";
import { containsSecret, redact } from "./redact.js";
import {
  appendRecord,
  lookupAttempt,
  markRecorded,
  readRecordById,
  reserveAttempt,
} from "./record.js";
import type { ExperimentRecord, LabContext, ProbeInput, ProbeResult, TransportResponse } from "./types.js";

const CONNECTION_CONCLUSION =
  "error de conexión; la solicitud se intentó una sola vez y no se reintenta; no es una respuesta funcional del servicio";
const TIMEOUT_CONCLUSION =
  "tiempo de espera agotado; la solicitud puede haber llegado y no se reintenta; no es una respuesta funcional del servicio";
const INFRA_CONCLUSION =
  "respuesta de infraestructura con X-Frontier-Infra; no es comportamiento del servicio";

export async function executeProbe(input: ProbeInput, ctx: LabContext): Promise<ProbeResult> {
  const usage = validateProbe(input, ctx);
  if (usage !== null) {
    return blocked(input, usage);
  }

  const existing = lookupAttempt(ctx.paths.ledger, input.attemptKey);
  if (existing?.state === "recorded") {
    const record = readRecordById(ctx.paths.log, existing.id);
    return {
      sent: false,
      duplicate: true,
      classification: record === null ? "blocked" : classificationOf(record),
      usableAsEvidence: record !== null && record.status !== null && !isInfraConclusion(record.conclusion),
      record,
      method: input.method,
      path: input.path,
      message: "intento ya registrado; no se reenvía",
    };
  }
  if (existing?.state === "inflight") {
    const record = readRecordById(ctx.paths.log, existing.id);
    if (record !== null) {
      markRecorded(ctx.paths.ledger, input.attemptKey);
      return {
        sent: false,
        duplicate: true,
        classification: classificationOf(record),
        usableAsEvidence: record.status !== null && !isInfraConclusion(record.conclusion),
        record,
        method: input.method,
        path: input.path,
        message: "intento ya registrado; no se reenvía",
      };
    }
    return blocked(input, "intento interrumpido tras enviarse; no se reenvía ni se inventa respuesta");
  }

  const quota = readQuota(ctx.paths.quota, ctx.now());
  if (quota.sent >= ctx.dailyLimit) {
    return blocked(input, "límite local de 8000 solicitudes por día UTC; no se envió");
  }

  const gap = computeGap(quota.lastSentAt, ctx.now().getTime(), ctx.minIntervalMs);
  if (gap > 0) {
    await ctx.sleep(gap);
  }

  const reserved = reserveQuota(ctx.paths.quota, ctx.now(), ctx.dailyLimit);
  if (!reserved.ok) {
    return blocked(input, "límite local de 8000 solicitudes por día UTC; no se envió");
  }
  const id = reserveAttempt(ctx.paths.ledger, ctx.paths.log, input.attemptKey);
  const wire = wireBody(input);
  const url = resolveLabUrl(ctx.baseUrl, input.path);
  const timeoutMs = input.timeoutMs ?? ctx.timeoutMs;
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    const response = await ctx.transport(
      {
        method: input.method,
        url,
        headers: requestHeaders(input, ctx, wire.contentType),
        ...(wire.body !== undefined ? { body: wire.body } : {}),
      },
      signal,
    );
    return finishHttp(input, ctx, id, response);
  } catch (err: unknown) {
    const timeout = signal.aborted || (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"));
    const record = baseRecord(input, id, {
      x_req: null,
      status: null,
      response: null,
      conclusion: mergeConclusion(input.conclusion, timeout ? TIMEOUT_CONCLUSION : CONNECTION_CONCLUSION),
    });
    return writeAndReturn(input, ctx, record, {
      classification: "transport",
      usableAsEvidence: false,
      message: redact(err instanceof Error ? err.message : "error de conexión", ctx.token),
    });
  }
}

function relevantResponseHeaders(headers: Record<string, string>): Record<string, string> {
  const selected: Record<string, string> = {};
  for (const name of ["content-type", "date", "x-req", "x-frontier-infra"]) {
    const value = headerValue(headers, name);
    if (value !== undefined) {
      selected[name] = value;
    }
  }
  return selected;
}

export function resolveLabUrl(baseUrl: string, requestPath: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new Error("URL base inválida");
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error("la URL base debe ser http o https");
  }
  const url = new URL(requestPath, base);
  if (url.origin !== base.origin) {
    throw new Error("la ruta escapa del origen configurado");
  }
  return url.toString();
}

export function validateProbe(input: ProbeInput, ctx: Pick<LabContext, "token" | "baseUrl">): string | null {
  if (input.seq.trim().length === 0) {
    return "seq vacía";
  }
  if (input.hipotesis.trim().length === 0) {
    return "hipotesis vacía; no se envía una solicitud sin hipótesis";
  }
  if (input.method.trim().length === 0 || /\s/.test(input.method)) {
    return "método inválido";
  }
  if (!input.path.startsWith("/") || input.path.startsWith("//")) {
    return "la ruta debe empezar por / y no puede ser un URL absoluto";
  }
  if (input.attemptKey.trim().length === 0) {
    return "attemptKey vacío";
  }
  if (input.rawBody && typeof input.body !== "string") {
    return "rawBody requiere un cuerpo string";
  }
  if (input.timeoutMs !== undefined && (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1)) {
    return "timeout inválido";
  }
  if (ctx.token.length < 8) {
    return "PARTICIPANT_TOKEN ausente o demasiado corto";
  }
  const sensitive = [input.seq, input.hipotesis, input.path, input.conclusion, input.attemptKey, input.body];
  if (sensitive.some((value) => containsSecret(value, ctx.token)) || containsSecret(input.headers, ctx.token)) {
    return "un argumento contiene el token; no se envía ni se registra";
  }
  for (const [key, value] of Object.entries(input.headers)) {
    const lower = key.toLowerCase();
    if (lower === "authorization" || lower === "cookie" || lower === "proxy-authorization") {
      return "no se aceptan encabezados de credenciales; el token sale solo de PARTICIPANT_TOKEN";
    }
    if (value.includes(ctx.token)) {
      return "un encabezado contiene el token; no se envía ni se registra";
    }
  }
  try {
    resolveLabUrl(ctx.baseUrl, input.path);
  } catch (err: unknown) {
    return err instanceof Error ? err.message : "ruta inválida";
  }
  return null;
}

function finishHttp(input: ProbeInput, ctx: LabContext, id: number, response: TransportResponse): ProbeResult {
  if (response.body.length > ctx.maxBodyBytes) {
    const record = baseRecord(input, id, {
      x_req: interpretXReq(headerValue(response.headers, "x-req")),
      status: response.status,
      response: null,
      conclusion: mergeConclusion(
        input.conclusion,
        `cuerpo de ${response.body.length} bytes descartado por el límite del laboratorio; no es un cuerpo vacío del servicio`,
      ),
    });
    return writeAndReturn(input, ctx, record, {
      classification: "http",
      usableAsEvidence: false,
      message: "cuerpo demasiado grande; no se registró truncado",
      relevantResponseHeaders: relevantResponseHeaders(response.headers),
    });
  }

  const interpreted = interpretResponseBody(response.body, headerValue(response.headers, "content-type"));
  const infra = headerValue(response.headers, "x-frontier-infra");
  const conclusion = infra === undefined
    ? input.conclusion
    : mergeConclusion(input.conclusion, infraNote(infra, ctx.token));
  const record = baseRecord(input, id, {
    x_req: interpretXReq(headerValue(response.headers, "x-req")),
    status: response.status,
    response: interpreted,
    ...(conclusion !== undefined ? { conclusion } : {}),
  });
  if (containsSecret(record, ctx.token)) {
    return {
      sent: true,
      duplicate: false,
      classification: "blocked",
      usableAsEvidence: false,
      record: null,
      method: input.method,
      path: input.path,
      message: "la respuesta no se registró porque contiene el token",
    };
  }
  return writeAndReturn(input, ctx, record, {
    classification: infra === undefined ? "http" : "infra",
    usableAsEvidence: infra === undefined,
    message: infra === undefined ? "respuesta HTTP registrada" : "respuesta de infraestructura registrada; no es evidencia funcional",
    relevantResponseHeaders: relevantResponseHeaders(response.headers),
  });
}

function writeAndReturn(
  input: ProbeInput,
  ctx: LabContext,
  record: ExperimentRecord,
  meta: {
    classification: ProbeResult["classification"];
    usableAsEvidence: boolean;
    message: string;
    relevantResponseHeaders?: Record<string, string>;
  },
): ProbeResult {
  appendRecord(ctx.paths.log, record, ctx.token);
  markRecorded(ctx.paths.ledger, input.attemptKey);
  return {
    sent: true,
    duplicate: false,
    classification: meta.classification,
    usableAsEvidence: meta.usableAsEvidence,
    record,
    method: input.method,
    path: input.path,
    message: redact(meta.message, ctx.token),
    ...(meta.relevantResponseHeaders !== undefined ? { relevantResponseHeaders: meta.relevantResponseHeaders } : {}),
  };
}

function baseRecord(
  input: ProbeInput,
  id: number,
  fields: Pick<ExperimentRecord, "x_req" | "status" | "response" | "conclusion">,
): ExperimentRecord {
  return {
    id,
    seq: input.seq,
    x_req: fields.x_req,
    hipotesis: input.hipotesis,
    request: input.rawBody ? input.body : input.body === undefined ? null : input.body,
    status: fields.status,
    response: fields.response,
    ...(fields.conclusion !== undefined ? { conclusion: fields.conclusion } : {}),
  };
}

function wireBody(input: ProbeInput): { body?: string; contentType?: string } {
  if (input.rawBody) {
    if (typeof input.body !== "string") {
      throw new Error("rawBody requiere un cuerpo string");
    }
    return {
      body: input.body,
      ...(input.contentType !== undefined ? { contentType: input.contentType } : {}),
    };
  }
  if (input.body === undefined) {
    return input.contentType !== undefined ? { contentType: input.contentType } : {};
  }
  return {
    body: JSON.stringify(input.body),
    contentType: input.contentType ?? "application/json",
  };
}

function requestHeaders(
  input: ProbeInput,
  ctx: Pick<LabContext, "token" | "authMode">,
  contentType: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = { ...input.headers };
  const mode = ctx.authMode ?? "bearer";
  if (mode === "bearer") {
    headers.Authorization = `Bearer ${ctx.token}`;
  } else if (mode === "invalid") {
    headers.Authorization = "Bearer invalid-token";
  }
  if (contentType !== undefined) {
    headers["Content-Type"] = contentType;
  }
  return headers;
}

function mergeConclusion(user: string | undefined, system: string | undefined): string | undefined {
  if (user === undefined || user.trim().length === 0) {
    return system;
  }
  if (system === undefined) {
    return user;
  }
  return `${user} | ${system}`;
}

function infraNote(value: string, secret: string): string {
  if (value.includes(secret) || value.length > 80) {
    return INFRA_CONCLUSION;
  }
  return `${INFRA_CONCLUSION}: ${value}`;
}

function classificationOf(record: ExperimentRecord): ProbeResult["classification"] {
  if (record.status === null) {
    return "transport";
  }
  if (isInfraConclusion(record.conclusion)) {
    return "infra";
  }
  return "http";
}

function isInfraConclusion(conclusion: string | undefined): boolean {
  return conclusion !== undefined && conclusion.includes("X-Frontier-Infra");
}

function blocked(input: ProbeInput, message: string): ProbeResult {
  return {
    sent: false,
    duplicate: false,
    classification: "blocked",
    usableAsEvidence: false,
    record: null,
    method: input.method,
    path: input.path,
    message,
  };
}
