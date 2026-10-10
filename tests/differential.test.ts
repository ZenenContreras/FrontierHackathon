// Comparación local de status y cuerpo. No contacta el original.
// El log no guarda método, ruta ni Authorization. s6b no tiene archivo y no se reenvía.
// El Bearer válido del test es un token ficticio de la lista local, no el token del participante.
// Una coincidencia aquí no es una captura de la petición.
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { EJEMPLO_OVERRIDES, replacementOracle } from "./v2-oracle.js";

const TOKEN = "differential-token";
const INVALID = "invalid-token";

type Auth = "bearer" | "omit" | "invalid";

interface Experiment {
  id: number;
  seq: string;
  x_req: number | string | null;
  status: number | null;
  response: unknown;
  request: unknown;
  hipotesis: string;
  conclusion?: string;
}

interface Step {
  method: string;
  path: string;
  hipotesis?: string;
  body?: unknown;
  rawBody?: boolean;
  contentType?: string;
}

interface Probe {
  id: number;
  seq: string;
  auth: Auth;
  step: Step;
  expected: Experiment;
}

function loadExperiments(): Experiment[] {
  return readFileSync("experimentos.jsonl", "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Experiment);
}

function loadSequences(): Map<string, Step[]> {
  const sequences = new Map<string, Step[]>();
  for (const file of readdirSync("tools/sequences")) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const parsed = JSON.parse(readFileSync(path.join("tools/sequences", file), "utf8")) as {
      seq: string;
      steps: Step[];
    };
    sequences.set(parsed.seq, parsed.steps);
  }
  return sequences;
}

function authFor(seq: string): Auth {
  if (seq === "s4") {
    return "omit";
  }
  if (seq === "s5") {
    return "invalid";
  }
  return "bearer";
}

function sameRequest(step: Step, request: unknown): boolean {
  if (step.rawBody) {
    return request === step.body;
  }
  if (step.body === undefined) {
    return request === null;
  }
  return JSON.stringify(step.body) === JSON.stringify(request);
}

function pairExperiments(rows: Experiment[], sequences: Map<string, Step[]>): { probes: Probe[]; unpaired: string[] } {
  const bySeq = new Map<string, Experiment[]>();
  for (const row of rows) {
    const list = bySeq.get(row.seq) ?? [];
    list.push(row);
    bySeq.set(row.seq, list);
  }
  const probes: Probe[] = [];
  const unpaired: string[] = [];
  for (const [seq, recorded] of bySeq) {
    const steps = sequences.get(seq);
    if (steps === undefined) {
      unpaired.push(`${seq} sin archivo de secuencia; no se reconstruye la petición`);
      continue;
    }
    let cursor = 0;
    for (const row of recorded) {
      let found = -1;
      for (let index = cursor; index < steps.length; index += 1) {
        const step = steps[index];
        if (step !== undefined && step.hipotesis === row.hipotesis && sameRequest(step, row.request)) {
          found = index;
          break;
        }
      }
      if (found < 0) {
        unpaired.push(`${seq} id ${row.id} sin paso equivalente; no se fabrica la petición`);
        continue;
      }
      const step = steps[found];
      if (step === undefined) {
        continue;
      }
      probes.push({ id: row.id, seq, auth: authFor(seq), step, expected: row });
      cursor = found + 1;
    }
    for (let index = cursor; index < steps.length; index += 1) {
      unpaired.push(`${seq} paso ${index + 1} sin registro`);
    }
  }
  return { probes, unpaired };
}

async function listen(): Promise<{ server: Server; base: string }> {
  const server = createApp({ tokens: [TOKEN] }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${address.port}` };
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function send(base: string, auth: Auth, step: Step): Promise<{ status: number; body: unknown; xReq: string | null }> {
  const headers: Record<string, string> = {};
  if (auth === "bearer") {
    headers.Authorization = `Bearer ${TOKEN}`;
  } else if (auth === "invalid") {
    headers.Authorization = `Bearer ${INVALID}`;
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
  let parsed: unknown = text;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }
  return { status: response.status, body: parsed, xReq: response.headers.get("x-req") };
}

function sameBody(actual: unknown, expected: unknown): boolean {
  if (typeof expected === "string") {
    return actual === expected;
  }
  try {
    assert.deepEqual(actual, expected);
    return true;
  } catch {
    return false;
  }
}

test("el reemplazo coincide en status y cuerpo con los registros y no llama al original", async () => {
  const rows = loadExperiments();
  const { probes, unpaired } = pairExperiments(rows, loadSequences());
  const bodyDiff: string[] = [];
  let xReqOnReplacement = 0;
  const bySeq = new Map<string, Probe[]>();
  for (const probe of probes) {
    const list = bySeq.get(probe.seq) ?? [];
    list.push(probe);
    bySeq.set(probe.seq, list);
  }

  for (const group of bySeq.values()) {
    const { server, base } = await listen();
    try {
      for (const probe of group) {
        const actual = await send(base, probe.auth, probe.step);
        if (actual.xReq !== null) {
          xReqOnReplacement += 1;
        }
        const oracle = probe.id >= 128
          ? { status: probe.expected.status, response: probe.expected.response, note: "captura-v2" as const }
          : replacementOracle(probe.id, probe.expected.status ?? 0, probe.expected.response);
        if (probe.expected.status === null || oracle.status === 0 || !sameBody(actual.body, oracle.response) || actual.status !== oracle.status) {
          bodyDiff.push(
            `id ${probe.id} ${probe.seq} nota=${oracle.note} ${probe.step.method} ${probe.step.path} ` +
              `esperado ${String(oracle.status)} ${JSON.stringify(oracle.response)} ` +
              `obtuvo ${actual.status} ${JSON.stringify(actual.body)}`,
          );
        }
      }
    } finally {
      await close(server);
    }
  }

  const ejemplos = readFileSync("pruebas/ejemplos.jsonl", "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { status: number; response: unknown; request: { m: string } });
  const ejemplosDiff: string[] = [];
  const ejemplosServer = await listen();
  try {
    const reset = await send(ejemplosServer.base, "bearer", { method: "POST", path: "/__reset" });
    assert.deepEqual(reset.body, { ok: true });
    for (const [index, row] of ejemplos.entries()) {
      const actual = await send(ejemplosServer.base, "bearer", {
        method: "POST",
        path: "/msg",
        body: row.request,
      });
      const override = EJEMPLO_OVERRIDES[index + 1];
      const expectedStatus = override?.status ?? row.status;
      const expectedBody = override?.response ?? row.response;
      if (actual.status !== expectedStatus || !sameBody(actual.body, expectedBody)) {
        ejemplosDiff.push(
          `ejemplo ${index + 1} nota=${override?.note ?? "historico-v1"} esperado ${expectedStatus} obtuvo ${actual.status}`,
        );
      }
      if (actual.xReq !== null) {
        xReqOnReplacement += 1;
      }
    }
  } finally {
    await close(ejemplosServer.server);
  }

  const infra = rows.filter((row) => {
    const text = `${row.conclusion ?? ""} ${JSON.stringify(row.response)}`;
    return row.status === null || text.includes("X-Frontier") || text.includes("rate-limit");
  });
  const recordedXReq = rows.filter((row) => row.x_req !== null).length;

  const historicalIds = new Set(rows.filter((row) => row.id <= 127).map((row) => row.id));
  const pairedHistorical = probes.filter((probe) => probe.id <= 127).map((probe) => probe.id);
  for (const id of historicalIds) {
    if (id !== 31 && !pairedHistorical.includes(id)) {
      unpaired.push(`id ${id} histórico sin pareja; no se omite`);
    }
  }
  assert.deepEqual(unpaired.filter((item) => item.includes("histórico sin pareja") || item.includes("sin registro")), []);
  assert.ok(unpaired.includes("s6b sin archivo de secuencia; no se reconstruye la petición"));
  assert.deepEqual(bodyDiff, []);
  assert.deepEqual(ejemplosDiff, []);
  assert.deepEqual(infra, []);
  assert.equal(pairedHistorical.length, 126);
  assert.equal(rows.length, 176);
  assert.equal(new Set(rows.map((row) => row.id)).size, 176);
  assert.equal(ejemplos.length, 20);
  assert.equal(rows.filter((row) => row.id <= 127 && row.x_req !== null).length, 87);
  assert.equal(recordedXReq, rows.filter((row) => row.x_req !== null).length);
  assert.equal(xReqOnReplacement, 0);
});
