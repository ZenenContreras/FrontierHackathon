// Regresion local contra experimentos.jsonl. No contacta el original.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const TOKEN = "replay-token";

interface Step {
  method: string;
  path: string;
  body?: unknown;
  rawBody?: boolean;
  contentType?: string;
}

interface Experiment {
  seq: string;
  status: number;
  response: unknown;
}

async function listen(tokens: string[]): Promise<{ server: Server; base: string }> {
  const server = createApp({ tokens }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test("las secuencias registradas reproducen status y cuerpo, con el auth de s4 y s5", async () => {
  const experiments = readFileSync("experimentos.jsonl", "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Experiment & { seq: string });
  const bySeq = new Map<string, Experiment[]>();
  for (const row of experiments) {
    const list = bySeq.get(row.seq) ?? [];
    list.push(row);
    bySeq.set(row.seq, list);
  }

  const files = readdirSync("tools/sequences").filter((name) => name.endsWith(".json")).sort();
  const failures: string[] = [];
  for (const file of files) {
    const sequence = JSON.parse(readFileSync(path.join("tools/sequences", file), "utf8")) as {
      seq: string;
      steps: Step[];
    };
    const expected = bySeq.get(sequence.seq) ?? [];
    const { server, base } = await listen([TOKEN]);
    try {
      for (let index = 0; index < sequence.steps.length; index += 1) {
        const step = sequence.steps[index];
        const want = expected[index];
        if (step === undefined || want === undefined) {
          failures.push(`${sequence.seq} paso ${index + 1} sin par`);
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
        if (response.status !== want.status || JSON.stringify(actual) !== JSON.stringify(want.response)) {
          failures.push(
            `${sequence.seq}#${index + 1} ${step.method} ${step.path} ${JSON.stringify(step.body)} ` +
              `esperado ${want.status} ${JSON.stringify(want.response)} ` +
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
  assert.deepEqual(failures, []);
});
