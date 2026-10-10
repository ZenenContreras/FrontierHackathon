import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { applyEnvFile } from "./env.js";
import { redact } from "./redact.js";
import { executeSequence } from "./sequence.js";
import { fetchTransport } from "./transport.js";
import {
  DAILY_LIMIT,
  DEFAULT_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  MIN_INTERVAL_MS,
  MIN_TOKEN_LENGTH,
  type LabContext,
  type ProbeInput,
  type ProbeResult,
  type Transport,
} from "./types.js";

export interface CliIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export interface CliOptions {
  env?: NodeJS.ProcessEnv;
  io?: CliIo;
  transport?: Transport;
  allowNetwork?: boolean;
  logPath?: string;
  quotaPath?: string;
  ledgerPath?: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  envFilePath?: string | null;
}

const HELP = `Laboratorio local. No forma parte del servidor desplegable.

Uso:
  npm run lab -- probe --seq <seq> --hipotesis <texto> --method <METODO> --path <ruta>
  npm run lab -- sequence --file <archivo.json>
  npm run lab -- --help

Opciones de probe:
  --body <json>         Cuerpo JSON. Se registra como valor, no como texto.
  --raw-body <texto>    Cuerpo exacto. Excluyente con --body.
  --header <Nombre: v>  Encabezado adicional. No acepta Authorization.
  --content-type <tipo>
  --conclusion <texto>  Conclusión opcional del esquema oficial.
  --attempt <id>        Reintenta ese intento sin reenviar.
  --attempt-prefix <id> En una secuencia, los pasos usan <id>:1, <id>:2...
  --timeout-ms <n>
  --dry-run             Valida y no envía ni escribe experimentos.jsonl.

El token se lee de PARTICIPANT_TOKEN. No lo pongas en argumentos.
Cada invocación nueva envía solicitudes reales salvo --dry-run o un --attempt ya usado.
No hay reintentos automáticos. El ritmo local es de al menos 120 ms y el tope es 8000 por día UTC.
`;

export async function runCli(argv: string[], options: CliOptions = {}): Promise<number> {
  const io = options.io ?? { stdout: console.log, stderr: console.error };
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    io.stdout(HELP.trim());
    return argv.length === 0 ? 2 : 0;
  }
  if (argv.includes("--token")) {
    io.stderr("el token solo se acepta por PARTICIPANT_TOKEN");
    return 2;
  }

  const envFilePath = options.envFilePath === undefined ? ".env" : options.envFilePath;
  let env = { ...(options.env ?? process.env) };
  if (envFilePath !== null) {
    try {
      const loaded = applyEnvFile(env, envFilePath);
      env = loaded.env;
    } catch (err: unknown) {
      io.stderr(err instanceof Error ? err.message : "no se pudo leer .env");
      return 2;
    }
  }
  const token = env.PARTICIPANT_TOKEN ?? "";
  const out = redactingIo(io, token);
  const parsed = parseArgs(argv);
  if (parsed.error !== undefined) {
    out.stderr(parsed.error);
    return 2;
  }

  if (parsed.dryRun) {
    out.stdout("dry-run: no se envió ninguna solicitud y no se escribió experimentos.jsonl");
    for (const step of parsed.steps) {
      out.stdout(`plan seq=${step.seq} ${step.method} ${step.path} hipotesis=${step.hipotesis}`);
    }
    return 0;
  }

  if (token.length < MIN_TOKEN_LENGTH) {
    out.stderr("PARTICIPANT_TOKEN ausente o demasiado corto; no se envió nada");
    return 2;
  }
  if (options.allowNetwork !== true && options.logPath === undefined) {
    out.stderr("falta logPath para una ejecución que no es de red real");
    return 2;
  }

  const ctx: LabContext = {
    transport: options.transport ?? (options.allowNetwork ? fetchTransport : deniedTransport),
    now: options.now ?? (() => new Date()),
    sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    paths: {
      log: options.logPath ?? path.resolve("experimentos.jsonl"),
      quota: options.quotaPath ?? path.resolve("tools/state/quota.json"),
      ledger: options.ledgerPath ?? path.resolve("tools/state/append-ledger.json"),
    },
    token,
    baseUrl: env.ORIGINAL_BASE_URL || "https://caja-negra-production-c64f.up.railway.app",
    minIntervalMs: readInterval(env),
    dailyLimit: readDailyLimit(env),
    timeoutMs: readTimeout(env),
    maxBodyBytes: 1_000_000,
    authMode: readAuthMode(env),
  };

  out.stdout(`attempt-prefix: ${parsed.attemptPrefix}`);
  const sequence = await executeSequence({ seq: parsed.seq, steps: parsed.steps }, ctx);
  for (const result of sequence.results) {
    out.stdout(formatResult(result));
  }
  if (sequence.stopped) {
    out.stderr(sequence.message);
    return sequence.results.some((result) => result.sent) ? 3 : 2;
  }
  return 0;
}

function formatResult(result: ProbeResult): string {
  const id = result.record?.id ?? "-";
  const status = result.record?.status ?? "-";
  const xReq = result.record?.x_req ?? "-";
  const response = result.usableAsEvidence ? ` response=${JSON.stringify(result.record?.response)}` : "";
  return `id=${id} seq=${result.record?.seq ?? "-"} class=${result.classification} status=${status} x_req=${xReq} ${result.method} ${result.path}${response}`;
}

function redactingIo(io: CliIo, secret: string): CliIo {
  return {
    stdout: (line) => io.stdout(redact(line, secret)),
    stderr: (line) => io.stderr(redact(line, secret)),
  };
}

interface ParsedCli {
  error?: string;
  dryRun: boolean;
  seq: string;
  attemptPrefix: string;
  steps: ProbeInput[];
}

function parseArgs(argv: string[]): ParsedCli {
  const command = argv[0];
  const flags = readFlags(argv.slice(1));
  if (flags.error !== undefined) {
    return { error: flags.error, dryRun: false, seq: "", attemptPrefix: "", steps: [] };
  }
  const dryRun = flags.values.has("dry-run");
  const attemptPrefix = flags.values.get("attempt") ?? flags.values.get("attempt-prefix") ?? randomUUID();
  if (command === "probe") {
    const step = probeFromFlags(flags.values, flags.headers, attemptPrefix);
    if (typeof step === "string") {
      return { error: step, dryRun, seq: "", attemptPrefix, steps: [] };
    }
    return { dryRun, seq: step.seq, attemptPrefix, steps: [step] };
  }
  if (command === "sequence") {
    const file = flags.values.get("file");
    if (file === undefined) {
      return { error: "sequence requiere --file", dryRun, seq: "", attemptPrefix, steps: [] };
    }
    const loaded = loadSequenceFile(file, attemptPrefix);
    if (typeof loaded === "string") {
      return { error: loaded, dryRun, seq: "", attemptPrefix, steps: [] };
    }
    return { dryRun, seq: loaded.seq, attemptPrefix, steps: loaded.steps };
  }
  return { error: "comando no reconocido", dryRun, seq: "", attemptPrefix, steps: [] };
}

function probeFromFlags(
  flags: Map<string, string>,
  headerFlags: string[],
  attemptKey: string,
): ProbeInput | string {
  const seq = flags.get("seq");
  const hipotesis = flags.get("hipotesis");
  const method = flags.get("method");
  const requestPath = flags.get("path");
  if (seq === undefined || hipotesis === undefined || method === undefined || requestPath === undefined) {
    return "probe requiere --seq, --hipotesis, --method y --path";
  }
  if (flags.has("body") && flags.has("raw-body")) {
    return "--body y --raw-body son excluyentes";
  }
  let body: unknown = undefined;
  let rawBody = false;
  if (flags.has("raw-body")) {
    body = flags.get("raw-body");
    rawBody = true;
  } else if (flags.has("body")) {
    try {
      body = JSON.parse(flags.get("body") ?? "") as unknown;
    } catch {
      return "--body no es JSON; usa --raw-body para texto exacto";
    }
  }
  const headers = parseHeaderFlags(headerFlags);
  if (typeof headers === "string") {
    return headers;
  }
  return {
    seq,
    hipotesis,
    method,
    path: requestPath,
    body,
    rawBody,
    headers,
    ...(flags.has("content-type") ? { contentType: flags.get("content-type") } : {}),
    ...(flags.has("conclusion") ? { conclusion: flags.get("conclusion") } : {}),
    ...(flags.has("timeout-ms") ? { timeoutMs: Number(flags.get("timeout-ms")) } : {}),
    attemptKey,
  };
}

function loadSequenceFile(file: string, attemptPrefix: string): { seq: string; steps: ProbeInput[] } | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
  } catch {
    return "no se pudo leer la secuencia";
  }
  if (typeof parsed !== "object" || parsed === null || !("seq" in parsed) || !("steps" in parsed)) {
    return "la secuencia requiere seq y steps";
  }
  const seq = parsed.seq;
  const steps = parsed.steps;
  if (typeof seq !== "string" || !Array.isArray(steps)) {
    return "la secuencia requiere seq y steps";
  }
  const probes: ProbeInput[] = [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (typeof step !== "object" || step === null) {
      return `paso ${index + 1} inválido`;
    }
    const record = step as Record<string, unknown>;
    const allowed = new Set(["method", "path", "hipotesis", "body", "rawBody", "headers", "contentType", "conclusion"]);
    for (const key of Object.keys(record)) {
      if (!allowed.has(key)) {
        return `paso ${index + 1} tiene un campo no admitido`;
      }
    }
    if (typeof record.method !== "string" || typeof record.path !== "string" || typeof record.hipotesis !== "string") {
      return `paso ${index + 1} requiere method, path e hipotesis`;
    }
    const rawBody = record.rawBody === true;
    if (record.rawBody !== undefined && typeof record.rawBody !== "boolean") {
      return `paso ${index + 1} tiene rawBody inválido`;
    }
    if (rawBody && typeof record.body !== "string") {
      return `paso ${index + 1} con rawBody requiere body string`;
    }
    const headers = record.headers === undefined ? {} : record.headers;
    if (typeof headers !== "object" || headers === null || Array.isArray(headers)) {
      return `paso ${index + 1} tiene headers inválidos`;
    }
    const headerMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value !== "string") {
        return `paso ${index + 1} tiene headers inválidos`;
      }
      headerMap[key] = value;
    }
    probes.push({
      seq,
      hipotesis: record.hipotesis,
      method: record.method,
      path: record.path,
      body: record.body,
      rawBody,
      headers: headerMap,
      ...(typeof record.contentType === "string" ? { contentType: record.contentType } : {}),
      ...(typeof record.conclusion === "string" ? { conclusion: record.conclusion } : {}),
      attemptKey: `${attemptPrefix}:${index + 1}`,
    });
  }
  return { seq, steps: probes };
}

function parseHeaderFlags(values: string[]): Record<string, string> | string {
  const headers: Record<string, string> = {};
  for (const value of values) {
    const separator = value.indexOf(":");
    if (separator <= 0) {
      return "--header debe tener el formato Nombre: valor";
    }
    headers[value.slice(0, separator).trim()] = value.slice(separator + 1).trim();
  }
  return headers;
}

function readFlags(argv: string[]): { values: Map<string, string>; headers: string[]; error?: string } {
  const values = new Map<string, string>();
  const headers: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined || !token.startsWith("--")) {
      return { values, headers, error: "argumento no reconocido" };
    }
    const name = token.slice(2);
    if (name === "dry-run") {
      values.set(name, "true");
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return { values, headers, error: `--${name} requiere un valor` };
    }
    if (name === "header") {
      headers.push(value);
    } else {
      values.set(name, value);
    }
    index += 1;
  }
  return { values, headers };
}

const deniedTransport: Transport = async () => {
  throw new Error("red de laboratorio no habilitada");
};

function readAuthMode(env: NodeJS.ProcessEnv): "bearer" | "omit" | "invalid" {
  const raw = env.LAB_AUTH_MODE;
  if (raw === undefined || raw.length === 0 || raw === "bearer") {
    return "bearer";
  }
  if (raw === "omit" || raw === "invalid") {
    return raw;
  }
  throw new Error("LAB_AUTH_MODE debe ser bearer, omit o invalid");
}

function readInterval(env: NodeJS.ProcessEnv): number {
  return readBounded(env.LAB_MIN_INTERVAL_MS, DEFAULT_INTERVAL_MS, MIN_INTERVAL_MS, 60_000);
}

function readDailyLimit(env: NodeJS.ProcessEnv): number {
  return readBounded(env.LAB_DAILY_LIMIT, DAILY_LIMIT, 1, DAILY_LIMIT);
}

function readTimeout(env: NodeJS.ProcessEnv): number {
  return readBounded(env.LAB_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1, MAX_TIMEOUT_MS);
}

function readBounded(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.length === 0) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  runCli(process.argv.slice(2), { allowNetwork: true })
    .then((code) => {
      process.exit(code);
    })
    .catch((err: unknown) => {
      const secret = process.env.PARTICIPANT_TOKEN;
      const message = err instanceof Error ? err.message : "error del laboratorio";
      console.error(redact(message, secret));
      process.exit(1);
    });
}
