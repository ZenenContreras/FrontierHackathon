// SIMULADO. El transporte es falso. No contacta el servicio original.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { executeProbe } from "../tools/client.js";
import { readRecords } from "../tools/record.js";
import { executeSequence } from "../tools/sequence.js";
import type { LabContext, ProbeInput, Transport, TransportRequest } from "../tools/types.js";

const TOKEN = "super-secret-token";

function paths() {
  const dir = mkdtempSync(path.join(tmpdir(), "lab-client-"));
  return {
    log: path.join(dir, "experimentos.jsonl"),
    quota: path.join(dir, "quota.json"),
    ledger: path.join(dir, "ledger.json"),
  };
}

function context(transport: Transport, overrides: Partial<LabContext> = {}): LabContext {
  let now = new Date("2026-10-10T12:00:00.000Z");
  return {
    transport,
    now: () => now,
    sleep: async (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
    paths: paths(),
    token: TOKEN,
    baseUrl: "https://original.test",
    minIntervalMs: 100,
    dailyLimit: 8000,
    timeoutMs: 5000,
    maxBodyBytes: 1_000_000,
    ...overrides,
  };
}

function probe(overrides: Partial<ProbeInput> = {}): ProbeInput {
  return {
    seq: "s1",
    hipotesis: "PING responde",
    method: "POST",
    path: "/msg",
    body: { m: "PING;64" },
    rawBody: false,
    headers: {},
    attemptKey: "attempt-1",
    ...overrides,
  };
}

test("simulado: un error de conexión se registra sin inventar status ni X-Req", async () => {
  const calls: string[] = [];
  const lab = context(async () => {
    calls.push("send");
    throw new Error(`connect failed Bearer ${TOKEN}`);
  });

  const result = await executeProbe(probe(), lab);
  const text = readFileSync(lab.paths.log, "utf8");

  assert.equal(calls.length, 1);
  assert.equal(result.sent, true);
  assert.equal(result.usableAsEvidence, false);
  assert.equal(result.record?.status, null);
  assert.equal(result.record?.x_req, null);
  assert.equal(result.record?.response, null);
  assert.match(result.record?.conclusion ?? "", /error de conexión/);
  assert.equal(result.message.includes(TOKEN), false);
  assert.equal(text.includes(TOKEN), false);
  assert.equal(text.includes("Authorization"), false);
});

test("simulado: un tiempo de espera no se reintenta", async () => {
  let calls = 0;
  const lab = context(async () => {
    calls += 1;
    const error = new Error("timed out");
    error.name = "TimeoutError";
    throw error;
  });

  const result = await executeProbe(probe(), lab);

  assert.equal(calls, 1);
  assert.match(result.record?.conclusion ?? "", /tiempo de espera/);
  assert.equal(result.usableAsEvidence, false);
});

test("simulado: reintentar el mismo intento no reenvía ni duplica la línea", async () => {
  let calls = 0;
  const lab = context(async () => {
    calls += 1;
    return { status: 200, body: "{\"pong\":true}", headers: { "content-type": "application/json", "x-req": "1" } };
  });

  const first = await executeProbe(probe(), lab);
  const second = await executeProbe(probe(), lab);

  assert.equal(calls, 1);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.sent, false);
  assert.equal(readRecords(lab.paths.log).length, 1);
  assert.equal(second.record?.id, 1);
});

test("simulado: una secuencia conserva el orden y la misma seq", async () => {
  const seen: string[] = [];
  const sleeps: number[] = [];
  let now = new Date("2026-10-10T12:00:00.000Z");
  const lab = context(async (request: TransportRequest) => {
    seen.push(`${request.method} ${new URL(request.url).pathname}`);
    return {
      status: 200,
      body: `{"n":${seen.length}}`,
      headers: { "content-type": "application/json", "x-req": String(seen.length) },
    };
  }, {
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now = new Date(now.getTime() + ms);
    },
    now: () => now,
  });
  const steps = ["/health", "/__reset", "/msg"].map((requestPath, index) => probe({
    method: index === 2 ? "POST" : index === 1 ? "POST" : "GET",
    path: requestPath,
    body: index === 2 ? { m: "PING;64" } : undefined,
    attemptKey: `seq-${index + 1}`,
    hipotesis: `paso ${requestPath}`,
  }));

  const result = await executeSequence({ seq: "s1", steps }, lab);
  const records = readRecords(lab.paths.log);

  assert.equal(result.stopped, false);
  assert.deepEqual(seen, ["GET /health", "POST /__reset", "POST /msg"]);
  assert.deepEqual(records.map((record) => record.id), [1, 2, 3]);
  assert.deepEqual(records.map((record) => record.seq), ["s1", "s1", "s1"]);
  assert.deepEqual(records.map((record) => record.x_req), [1, 2, 3]);
  assert.equal(sleeps.length > 0, true);
  assert.equal(sleeps.every((gap) => gap >= 100), true);
});

test("simulado: una respuesta de infraestructura no es evidencia y detiene la secuencia", async () => {
  let calls = 0;
  const lab = context(async () => {
    calls += 1;
    return {
      status: 429,
      body: "slow down",
      headers: { "x-frontier-infra": "rate-limit", "x-req": "8" },
    };
  });

  const result = await executeSequence({
    seq: "s1",
    steps: [
      probe({ path: "/health", method: "GET", body: undefined, attemptKey: "a", hipotesis: "primero" }),
      probe({ path: "/msg", attemptKey: "b", hipotesis: "no debe enviarse" }),
    ],
  }, lab);

  assert.equal(calls, 1);
  assert.equal(result.stopped, true);
  assert.equal(result.results[0]?.usableAsEvidence, false);
  assert.equal(result.results[0]?.record?.status, 429);
  assert.equal(result.results[0]?.record?.response, "slow down");
  assert.match(result.results[0]?.record?.conclusion ?? "", /X-Frontier-Infra/);
  assert.equal(readRecords(lab.paths.log).length, 1);
});

test("simulado: el tope diario local no envía ni registra", async () => {
  let calls = 0;
  const lab = context(async () => {
    calls += 1;
    return { status: 200, body: "", headers: {} };
  }, { dailyLimit: 1 });
  writeFileSync(lab.paths.quota, JSON.stringify({ date: "2026-10-10", sent: 1, lastSentAt: 0 }));

  const result = await executeProbe(probe(), lab);

  assert.equal(calls, 0);
  assert.equal(result.sent, false);
  assert.equal(result.record, null);
  assert.equal(existsSync(lab.paths.log), false);
});

test("simulado: una respuesta que contiene el token no se imprime ni se registra", async () => {
  const lab = context(async () => ({
    status: 200,
    body: `{"token":"${TOKEN}"}`,
    headers: { "content-type": "application/json", "x-req": "1" },
  }));

  const result = await executeProbe(probe(), lab);
  const text = existsSync(lab.paths.log) ? readFileSync(lab.paths.log, "utf8") : "";

  assert.equal(result.record, null);
  assert.equal(result.message.includes(TOKEN), false);
  assert.equal(text.includes(TOKEN), false);
});

test("simulado: omit e invalid no envían el token real", async () => {
  const seen: string[] = [];
  const transport: Transport = async (request) => {
    seen.push(request.headers.Authorization ?? "");
    return { status: 401, body: "", headers: {} };
  };
  const omitted = context(transport);
  omitted.authMode = "omit";
  await executeProbe(probe({ attemptKey: "omit-1", path: "/health", method: "GET", body: undefined }), omitted);
  const invalid = context(transport);
  invalid.authMode = "invalid";
  await executeProbe(probe({ attemptKey: "invalid-1", path: "/health", method: "GET", body: undefined }), invalid);

  assert.deepEqual(seen, ["", "Bearer invalid-token"]);
  assert.equal(seen.some((value) => value.includes(TOKEN)), false);
});

test("simulado: no envía sin hipótesis", async () => {
  let calls = 0;
  const lab = context(async () => {
    calls += 1;
    return { status: 200, body: "", headers: {} };
  });

  const result = await executeProbe(probe({ hipotesis: "   " }), lab);

  assert.equal(calls, 0);
  assert.equal(result.sent, false);
});
