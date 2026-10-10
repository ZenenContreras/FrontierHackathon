// Secuencias locales. No contactan el original.
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApp } from "../src/app.js";
import { EJEMPLO_OVERRIDES } from "./v2-oracle.js";

const ALICE = "seq-alice";
const BOB = "seq-bob";

async function listen(tokens: string[]): Promise<{ server: Server; base: string }> {
  const server = createApp({ tokens }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${address.port}` };
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function call(
  base: string,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, json: await response.json() };
}

test("crear, consultar, repetir alta y reset reinician ids", async () => {
  const { server, base } = await listen([ALICE]);
  try {
    assert.deepEqual(await call(base, ALICE, "POST", "/__reset"), { status: 200, json: { ok: true } });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 404,
      json: { error: "E401", mensaje: "cuenta inexistente" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "ALTA;Lucia;82" }), {
      status: 201,
      json: { cuentaId: "AC-0001" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 200,
      json: { cuenta_id: "AC-0001", saldo: "0.00" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "ALTA;Lucia;82" }), {
      status: 201,
      json: { cuentaId: "AC-0002" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/__reset"), { status: 200, json: { ok: true } });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 404,
      json: { error: "E401", mensaje: "cuenta inexistente" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "ALTA;Lucia;82" }), {
      status: 201,
      json: { cuentaId: "AC-0001" },
    });
  } finally {
    await close(server);
  }
});

test("deposito fallido no crea cuenta y E507 no mueve saldos", async () => {
  const { server, base } = await listen([ALICE]);
  try {
    await call(base, ALICE, "POST", "/__reset");
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "DEPOSITO;AC-0001;250000;86" }), {
      status: 404,
      json: { error: "E401", mensaje: "cuenta inexistente" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "ALTA;Lucia;82" }), {
      status: 201,
      json: { cuentaId: "AC-0001" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "ALTA;Mateo;3" }), {
      status: 201,
      json: { cuentaId: "AC-0002" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "TRANSFER;AC-0002;AC-0001;50000;23" }), {
      status: 422,
      json: { error: "E507", mensaje: "saldo insuficiente" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 200,
      json: { cuenta_id: "AC-0001", saldo: "0.00" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0002;11" }), {
      status: 200,
      json: { cuenta_id: "AC-0002", saldo: "0.00" },
    });
  } finally {
    await close(server);
  }
});

test("transferencia de 40000 se acepta y 100000 y 120000 devuelven E506", async () => {
  const { server, base } = await listen([ALICE]);
  try {
    await call(base, ALICE, "POST", "/__reset");
    await call(base, ALICE, "POST", "/msg", { m: "ALTA;Lucia;82" });
    await call(base, ALICE, "POST", "/msg", { m: "ALTA;Mateo;3" });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "DEPOSITO;AC-0001;250000;86" }), {
      status: 200,
      json: { status: "recieved", operacionId: "OP-0001" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "TRANSFER;AC-0001;AC-0002;40000;86" }), {
      status: 200,
      json: { status: "recieved", operacionId: "OP-0002" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0002;11" }), {
      status: 200,
      json: { cuenta_id: "AC-0002", saldo: "400.00" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "TRANSFER;AC-0001;AC-0002;120000;55" }), {
      status: 422,
      json: { error: "E506", mensaje: "límite excedido" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "TRANSFER;AC-0001;AC-0002;100000;12" }), {
      status: 422,
      json: { error: "E506", mensaje: "límite excedido" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 200,
      json: { cuenta_id: "AC-0001", saldo: "2100.00" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "ANULA;OP-0009;48" }), {
      status: 404,
      json: { error: "E402", mensaje: "operación inexistente" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 200,
      json: { cuenta_id: "AC-0001", saldo: "2100.00" },
    });
  } finally {
    await close(server);
  }
});

test("anular un deposito sin operaciones posteriores deja el saldo en 0", async () => {
  const { server, base } = await listen([ALICE]);
  try {
    await call(base, ALICE, "POST", "/__reset");
    await call(base, ALICE, "POST", "/msg", { m: "ALTA;Lucia;82" });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "DEPOSITO;AC-0001;250000;86" }), {
      status: 200,
      json: { status: "recieved", operacionId: "OP-0001" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "anula;OP-0001;72" }), {
      status: 200,
      json: { ok: true, anulada: "OP-0001" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 200,
      json: { cuenta_id: "AC-0001", saldo: "0.00" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "ANULA;OP-0001;72" }), {
      status: 200,
      json: { ok: false, motivo: "ya anulada" },
    });
  } finally {
    await close(server);
  }
});

test("el reemplazo aisla dos tokens de prueba; no es una medicion del original", async () => {
  const { server, base } = await listen([ALICE, BOB]);
  try {
    await call(base, ALICE, "POST", "/__reset");
    await call(base, BOB, "POST", "/__reset");
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "ALTA;Lucia;82" }), {
      status: 201,
      json: { cuentaId: "AC-0001" },
    });
    assert.deepEqual(await call(base, BOB, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 404,
      json: { error: "E401", mensaje: "cuenta inexistente" },
    });
    assert.deepEqual(await call(base, BOB, "POST", "/msg", { m: "ALTA;Lucia;82" }), {
      status: 201,
      json: { cuentaId: "AC-0001" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 200,
      json: { cuenta_id: "AC-0001", saldo: "0.00" },
    });
    assert.deepEqual(await call(base, BOB, "POST", "/__reset"), { status: 200, json: { ok: true } });
    assert.deepEqual(await call(base, BOB, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 404,
      json: { error: "E401", mensaje: "cuenta inexistente" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 200,
      json: { cuenta_id: "AC-0001", saldo: "0.00" },
    });
    assert.deepEqual(await call(base, ALICE, "POST", "/__reset"), { status: 200, json: { ok: true } });
    assert.deepEqual(await call(base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 404,
      json: { error: "E401", mensaje: "cuenta inexistente" },
    });
  } finally {
    await close(server);
  }
});

test("reiniciar el proceso local borra la memoria; no equivale al reset de un proceso vivo", async () => {
  const first = await listen([ALICE, BOB]);
  try {
    await call(first.base, ALICE, "POST", "/msg", { m: "ALTA;Lucia;82" });
    await call(first.base, BOB, "POST", "/msg", { m: "ALTA;Mateo;3" });
    assert.deepEqual(await call(first.base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 200,
      json: { cuenta_id: "AC-0001", saldo: "0.00" },
    });
  } finally {
    await close(first.server);
  }

  const second = await listen([ALICE, BOB]);
  try {
    assert.deepEqual(await call(second.base, ALICE, "POST", "/msg", { m: "CONSULTA;AC-0001;14" }), {
      status: 404,
      json: { error: "E401", mensaje: "cuenta inexistente" },
    });
    assert.deepEqual(await call(second.base, BOB, "POST", "/msg", { m: "CONSULTA;AC-0002;11" }), {
      status: 404,
      json: { error: "E401", mensaje: "cuenta inexistente" },
    });
  } finally {
    await close(second.server);
  }
});

test("la secuencia de ejemplos.jsonl aplica el formato de consulta y el E506 de 100000", async () => {
  const lines = readFileSync("pruebas/ejemplos.jsonl", "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { request: { m: string }; status: number; response: unknown });
  const overrides = new Map(
    Object.entries(EJEMPLO_OVERRIDES).map(([n, item]) => [Number(n), { status: item.status, json: item.response }]),
  );
  const { server, base } = await listen([ALICE]);
  try {
    assert.deepEqual(await call(base, ALICE, "POST", "/__reset"), { status: 200, json: { ok: true } });
    for (const [index, step] of lines.entries()) {
      const actual = await call(base, ALICE, "POST", "/msg", step.request);
      const expected = overrides.get(index + 1) ?? { status: step.status, json: step.response };
      assert.deepEqual(actual, expected, `ejemplo ${index + 1}`);
    }
  } finally {
    await close(server);
  }
});
