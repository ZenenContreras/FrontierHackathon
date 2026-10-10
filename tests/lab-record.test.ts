// SIMULADO. No contacta el servicio original ni escribe el experimentos.jsonl del repositorio.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { appendRecord, readRecords, serializeExperiment } from "../tools/record.js";
import type { ExperimentRecord } from "../tools/types.js";

const TOKEN = "super-secret-token";

test("simulado: serializa un experimento con el esquema oficial", () => {
  const line = serializeExperiment({
    id: 1,
    seq: "s1",
    x_req: 1,
    hipotesis: "PING responde sin estado",
    request: { m: "PING;XX" },
    status: 200,
    response: { pong: true },
    conclusion: "responde pong aunque el último campo no sea un número",
  });

  assert.equal(line.includes("\n"), false);
  assert.deepEqual(JSON.parse(line), {
    id: 1,
    seq: "s1",
    x_req: 1,
    hipotesis: "PING responde sin estado",
    request: { m: "PING;XX" },
    status: 200,
    response: { pong: true },
    conclusion: "responde pong aunque el último campo no sea un número",
  });
});

test("simulado: omite conclusion cuando no hay conclusión", () => {
  const line = serializeExperiment({
    id: 2,
    seq: "s1",
    x_req: null,
    hipotesis: "sin conclusión",
    request: null,
    status: 200,
    response: "",
  });
  const parsed = JSON.parse(line) as Record<string, unknown>;

  assert.equal("conclusion" in parsed, false);
  assert.deepEqual(Object.keys(parsed), [
    "id",
    "seq",
    "x_req",
    "hipotesis",
    "request",
    "status",
    "response",
  ]);
});

test("simulado: escribe una línea válida en un experimentos.jsonl temporal", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lab-record-"));
  const logPath = path.join(dir, "experimentos.jsonl");
  const record: ExperimentRecord = {
    id: 1,
    seq: "s1",
    x_req: 4,
    hipotesis: "GET /health",
    request: null,
    status: 200,
    response: { status: "ok" },
  };

  appendRecord(logPath, record, TOKEN);
  const text = readFileSync(logPath, "utf8");
  const [line, extra] = text.split("\n");

  assert.equal(extra, "");
  assert.deepEqual(JSON.parse(line ?? ""), record);
  assert.equal(text.includes(TOKEN), false);
  assert.equal(readRecords(logPath).length, 1);
});

test("simulado: no escribe una línea que contiene el token", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lab-record-"));
  const logPath = path.join(dir, "experimentos.jsonl");

  assert.throws(() => {
    appendRecord(logPath, {
      id: 1,
      seq: "s1",
      x_req: 1,
      hipotesis: "no debe guardarse",
      request: { m: TOKEN },
      status: 200,
      response: {},
    }, TOKEN);
  });
  assert.equal(existsSync(logPath) && readFileSync(logPath, "utf8").includes(TOKEN), false);
});
