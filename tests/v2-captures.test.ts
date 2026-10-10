// Reejecuta las capturas V2 tal como se guardaron. No llama al original.
// No usa el oráculo: un E506 o un saldo distinto del archivo es un fallo.
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApp } from "../src/app.js";

const TOKEN = "v2-capture-token";

interface Capture {
  id: number;
  seq: string;
  method: string;
  path: string;
  auth_mode: "bearer" | "omit" | "invalid";
  body_sent: unknown;
  status: number;
  response: unknown;
  request_headers_redacted?: Record<string, string>;
}

function loadCaptures(): Capture[] {
  return readFileSync("docs/fr-0153-capturas.jsonl", "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Capture);
}

async function listen(): Promise<{ server: Server; base: string }> {
  const server = createApp({ tokens: [TOKEN] }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test("cada captura V2 se compara literalmente, incluida las que no tienen archivo de secuencia", async () => {
  const captures = loadCaptures();
  const experiments = readFileSync("experimentos.jsonl", "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { id: number; seq: string; status: number; response: unknown });
  const byId = new Map(experiments.map((row) => [row.id, row]));
  const failures: string[] = [];
  const compared: number[] = [];
  const bySeq = new Map<string, Capture[]>();
  for (const capture of captures) {
    const list = bySeq.get(capture.seq) ?? [];
    list.push(capture);
    bySeq.set(capture.seq, list);
  }

  for (const group of bySeq.values()) {
    group.sort((left, right) => left.id - right.id);
    const { server, base } = await listen();
    try {
      for (const capture of group) {
        const logged = byId.get(capture.id);
        if (logged === undefined || logged.seq !== capture.seq || logged.status !== capture.status) {
          failures.push(`id ${capture.id} la captura no coincide con experimentos.jsonl`);
          continue;
        }
        try {
          assert.deepEqual(logged.response, capture.response);
        } catch {
          failures.push(`id ${capture.id} el cuerpo del log no coincide con la captura`);
          continue;
        }
        const headers: Record<string, string> = {};
        if (capture.auth_mode === "bearer") {
          headers.Authorization = `Bearer ${TOKEN}`;
        } else if (capture.auth_mode === "invalid") {
          headers.Authorization = "Bearer invalid-token";
        }
        let body: string | undefined;
        if (capture.body_sent !== null && capture.body_sent !== undefined) {
          body = JSON.stringify(capture.body_sent);
          const contentType = capture.request_headers_redacted?.["Content-Type"];
          if (contentType !== undefined) {
            headers["Content-Type"] = contentType;
          }
        }
        const response = await fetch(`${base}${capture.path}`, {
          method: capture.method,
          headers,
          ...(body !== undefined ? { body } : {}),
        });
        const text = await response.text();
        const actual = text.length === 0 ? "" : JSON.parse(text) as unknown;
        compared.push(capture.id);
        let bodyMatches = response.status === capture.status;
        try {
          assert.deepEqual(actual, capture.response);
        } catch {
          bodyMatches = false;
        }
        if (!bodyMatches) {
          failures.push(
            `id ${capture.id} ${capture.seq} ${capture.method} ${capture.path} ` +
              `esperado ${capture.status} ${JSON.stringify(capture.response)} ` +
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

  const expectedIds = experiments.filter((row) => row.id >= 128).map((row) => row.id);
  assert.deepEqual(failures, []);
  assert.deepEqual(compared, expectedIds);
  assert.equal(compared.length, 49);
  assert.equal(captures.length, 49);
  assert.ok(!compared.includes(31));
});
