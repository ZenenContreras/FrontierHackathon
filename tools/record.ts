import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { containsSecret } from "./redact.js";
import type { ExperimentRecord } from "./types.js";

interface LedgerEntry {
  state: "inflight" | "recorded";
  id: number;
}

interface Ledger {
  attempts: Record<string, LedgerEntry>;
}

export function serializeExperiment(record: ExperimentRecord): string {
  const line: Record<string, unknown> = {
    id: record.id,
    seq: record.seq,
    x_req: record.x_req,
    hipotesis: record.hipotesis,
    request: record.request,
    status: record.status,
    response: record.response,
  };
  if (record.conclusion !== undefined) {
    line.conclusion = record.conclusion;
  }
  return JSON.stringify(line);
}

export function loadLedger(ledgerPath: string): Ledger {
  if (!existsSync(ledgerPath)) {
    return { attempts: {} };
  }
  const parsed = JSON.parse(readFileSync(ledgerPath, "utf8")) as unknown;
  if (typeof parsed !== "object" || parsed === null || !("attempts" in parsed)) {
    throw new Error("ledger de intentos ilegible");
  }
  const attempts = parsed.attempts;
  if (typeof attempts !== "object" || attempts === null) {
    throw new Error("ledger de intentos ilegible");
  }
  return { attempts: attempts as Record<string, LedgerEntry> };
}

export function lookupAttempt(ledgerPath: string, attemptKey: string): LedgerEntry | undefined {
  return loadLedger(ledgerPath).attempts[attemptKey];
}

export function maxAssignedId(logPath: string, ledgerPath: string): number {
  return Math.max(maxLogId(logPath), maxLedgerId(ledgerPath));
}

export function reserveAttempt(ledgerPath: string, logPath: string, attemptKey: string): number {
  const ledger = loadLedger(ledgerPath);
  if (ledger.attempts[attemptKey] !== undefined) {
    throw new Error("el intento ya está reservado");
  }
  const id = Math.max(maxLogId(logPath), maxLedgerIdFrom(ledger)) + 1;
  ledger.attempts[attemptKey] = { state: "inflight", id };
  saveLedger(ledgerPath, ledger);
  return id;
}

export function markRecorded(ledgerPath: string, attemptKey: string): void {
  const ledger = loadLedger(ledgerPath);
  const entry = ledger.attempts[attemptKey];
  if (entry === undefined) {
    throw new Error("no hay intento reservado");
  }
  entry.state = "recorded";
  saveLedger(ledgerPath, ledger);
}

export function appendRecord(logPath: string, record: ExperimentRecord, secret: string): void {
  const line = serializeExperiment(record);
  if (containsSecret(JSON.parse(line) as unknown, secret) || line.includes(secret)) {
    throw new Error("el registro contiene el token y no se escribe");
  }
  mkdirSync(path.dirname(logPath), { recursive: true });
  let prefix = "";
  if (existsSync(logPath) && readFileSync(logPath).length > 0) {
    const raw = readFileSync(logPath);
    if (raw[raw.length - 1] !== 0x0a) {
      prefix = "\n";
    }
  }
  appendFileSync(logPath, `${prefix}${line}\n`, "utf8");
}

export function readRecordById(logPath: string, id: number): ExperimentRecord | null {
  for (const record of readRecords(logPath)) {
    if (record.id === id) {
      return record;
    }
  }
  return null;
}

export function readRecords(logPath: string): ExperimentRecord[] {
  if (!existsSync(logPath)) {
    return [];
  }
  const text = readFileSync(logPath, "utf8");
  if (text.length === 0) {
    return [];
  }
  const lines = text.split("\n").filter((line) => line.length > 0);
  return lines.map((line, index) => parseRecord(line, index + 1));
}

function parseRecord(line: string, lineNumber: number): ExperimentRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch {
    throw new Error(`línea ${lineNumber} de experimentos no es JSON`);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`línea ${lineNumber} de experimentos no es un objeto`);
  }
  const record = parsed as Partial<ExperimentRecord>;
  if (typeof record.id !== "number" || typeof record.seq !== "string" || typeof record.hipotesis !== "string") {
    throw new Error(`línea ${lineNumber} de experimentos no tiene los campos obligatorios`);
  }
  if (!("x_req" in record) || !("request" in record) || !("status" in record) || !("response" in record)) {
    throw new Error(`línea ${lineNumber} de experimentos no tiene los campos obligatorios`);
  }
  return {
    id: record.id,
    seq: record.seq,
    x_req: record.x_req ?? null,
    hipotesis: record.hipotesis,
    request: record.request,
    status: record.status ?? null,
    response: record.response,
    ...(record.conclusion !== undefined ? { conclusion: record.conclusion } : {}),
  };
}

function maxLogId(logPath: string): number {
  return readRecords(logPath).reduce((max, record) => Math.max(max, record.id), 0);
}

function maxLedgerId(ledgerPath: string): number {
  return maxLedgerIdFrom(loadLedger(ledgerPath));
}

function maxLedgerIdFrom(ledger: Ledger): number {
  return Object.values(ledger.attempts).reduce((max, entry) => Math.max(max, entry.id), 0);
}

function saveLedger(ledgerPath: string, ledger: Ledger): void {
  mkdirSync(path.dirname(ledgerPath), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify(ledger), "utf8");
}
