// Regresión local. No contacta el original.
// El log no captura método, ruta ni Authorization. Solo se reenvía un paso si el ledger
// une seq:n con un id, la hipótesis del archivo coincide con la del log y el cuerpo
// a enviar es igual a request. s6b no tiene archivo: no se reconstruye.
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { replacementOracle } from "./v2-oracle.js";

const TOKEN = "replay-token";

interface Step {
  method: string;
  path: string;
  hipotesis?: string;
  body?: unknown;
  rawBody?: boolean;
  contentType?: string;
}

interface Experiment {
  id: number;
  seq: string;
  hipotesis: string;
  request: unknown;
  status: number;
  response: unknown;
}

interface LedgerEntry {
  state: string;
  id: number;
}

function loadExperiments(): Experiment[] {
  return readFileSync("experimentos.jsonl", "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Experiment);
}

function loadLedger(): Record<string, LedgerEntry> {
  const parsed = JSON.parse(readFileSync("tools/state/append-ledger.json", "utf8")) as {
    attempts?: Record<string, LedgerEntry>;
  };
  return parsed.attempts ?? {};
}

function recordedRequest(step: Step): unknown {
  if (step.rawBody) {
    return step.body ?? "";
  }
  if (step.body === undefined) {
    return null;
  }
  return step.body;
}

function sameRecordedRequest(step: Step, request: unknown): boolean {
  const outgoing = recordedRequest(step);
  if (step.rawBody) {
    return request === outgoing;
  }
  return JSON.stringify(outgoing) === JSON.stringify(request);
}

async function listen(): Promise<{ server: Server; base: string }> {
  const server = createApp({ tokens: [TOKEN] }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test("solo reenvía pasos con vínculo de ledger y cuerpo igual a request", async () => {
  const experiments = loadExperiments();
  const byId = new Map(experiments.map((row) => [row.id, row]));
  const ledger = loadLedger();
  const failures: string[] = [];
  const unverifiable: string[] = [];
  let compared = 0;
  const coveredSeq = new Set<string>();

  const files = readdirSync("tools/sequences").filter((name) => name.endsWith(".json")).sort();
  for (const file of files) {
    const sequence = JSON.parse(readFileSync(path.join("tools/sequences", file), "utf8")) as {
      seq: string;
      steps: Step[];
    };
    coveredSeq.add(sequence.seq);
    const { server, base } = await listen();
    try {
      for (let index = 0; index < sequence.steps.length; index += 1) {
        const step = sequence.steps[index];
        const key = `${sequence.seq}:${index + 1}`;
        const link = ledger[key]
          ?? ledger[`fr0153-${sequence.seq}:${index + 1}`]
          ?? ledger[`fr0153-${sequence.seq}-${index + 1}`];
        if (step === undefined || link === undefined || link.state !== "recorded") {
          failures.push(`${sequence.seq} paso ${index + 1} sin vínculo verificable en el ledger`);
          continue;
        }
        const row = byId.get(link.id);
        if (row === undefined || row.seq !== sequence.seq || step.hipotesis !== row.hipotesis) {
          unverifiable.push(`${key} no enlaza con la línea ${link.id} de experimentos.jsonl`);
          continue;
        }
        if (!sameRecordedRequest(step, row.request)) {
          failures.push(`id ${row.id} el cuerpo a enviar no coincide con request`);
          continue;
        }

        const headers: Record<string, string> = {};
        const auth = sequence.seq === "s4" ? "omit" : sequence.seq === "s5" ? "invalid" : "bearer";
        if (auth === "bearer") {
          headers.Authorization = `Bearer ${TOKEN}`;
        } else if (auth === "invalid") {
          headers.Authorization = "Bearer invalid-token";
        }
        let body: string | undefined;
        if (step.rawBody) {
          body = String(step.body ?? "");
          if (step.contentType !== undefined) {
            headers["Content-Type"] = step.contentType;
          }
        } else if (step.body !== undefined) {
          body = JSON.stringify(step.body);
          headers["Content-Type"] = "application/json";
        }
        const response = await fetch(`${base}${step.path}`, {
          method: step.method,
          headers,
          ...(body !== undefined ? { body } : {}),
        });
        const text = await response.text();
        const actual = text.length === 0 ? "" : JSON.parse(text) as unknown;
        compared += 1;
        const oracle = row.id >= 128
          ? { status: row.status, response: row.response, note: "captura-v2" as const }
          : replacementOracle(row.id, row.status, row.response);
        if (response.status !== oracle.status || JSON.stringify(actual) !== JSON.stringify(oracle.response)) {
          failures.push(
            `id ${row.id} ${sequence.seq} nota=${oracle.note} esperado ${oracle.status} ${JSON.stringify(oracle.response)} ` +
              `obtuvo ${response.status} ${JSON.stringify(actual)}`,
          );
        }
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  }

  for (const row of experiments) {
    if (!coveredSeq.has(row.seq)) {
      unverifiable.push(`id ${row.id} ${row.seq} sin archivo de secuencia; no se reconstruye la petición`);
    }
  }

  const expectedUnverifiable = experiments
    .filter((row) => !coveredSeq.has(row.seq))
    .map((row) => `id ${row.id} ${row.seq} sin archivo de secuencia; no se reconstruye la petición`);
  assert.deepEqual(failures, []);
  assert.deepEqual(unverifiable, expectedUnverifiable);
  assert.ok(expectedUnverifiable.includes("id 31 s6b sin archivo de secuencia; no se reconstruye la petición"));
  assert.equal(experiments.filter((row) => row.id <= 127 && !coveredSeq.has(row.seq)).length, 1);
  assert.equal(compared, 146);
  const captureOnly = experiments.filter((row) => row.id >= 128 && !coveredSeq.has(row.seq));
  assert.deepEqual(
    captureOnly.map((row) => row.seq).filter((seq, index, all) => all.indexOf(seq) === index),
    ["v2b", "v2c", "v2f", "v2g", "v2j", "v2k"],
  );
});
