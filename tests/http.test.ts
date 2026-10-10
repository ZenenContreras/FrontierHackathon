import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStateStore } from "../src/state/store.js";

const TOKEN = "alpha-token";

async function listen(app: ReturnType<typeof createApp>): Promise<Server> {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server;
}

function baseUrl(server: Server): string {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("el servidor de prueba no expuso un puerto");
  }
  return `http://127.0.0.1:${(address as AddressInfo).port}`;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function app() {
  return createApp({ tokens: [TOKEN, "beta-token"] });
}

test("GET /health con token responde 200 y ok", async () => {
  const server = await listen(app());
  try {
    const response = await fetch(`${baseUrl(server)}/health`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  } finally {
    await close(server);
  }
});

test("GET /health sin token responde 401", async () => {
  const server = await listen(app());
  try {
    const response = await fetch(`${baseUrl(server)}/health`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "E001", mensaje: "no autorizado" });
  } finally {
    await close(server);
  }
});

test("POST /__reset reinicia solo el token indicado", async () => {
  const store = createStateStore();
  const beforeA = store.get(TOKEN);
  const beforeB = store.get("beta-token");
  const server = await listen(createApp({ store, tokens: [TOKEN, "beta-token"] }));

  try {
    const response = await fetch(`${baseUrl(server)}/__reset`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.notEqual(store.get(TOKEN), beforeA);
    assert.equal(store.get("beta-token"), beforeB);
  } finally {
    await close(server);
  }
});

test("POST /__reset sin token no borra el estado", async () => {
  const store = createStateStore();
  const named = store.get(TOKEN);
  const server = await listen(createApp({ store, tokens: [TOKEN] }));

  try {
    const response = await fetch(`${baseUrl(server)}/__reset`, { method: "POST" });
    assert.equal(response.status, 401);
    assert.equal(store.get(TOKEN), named);
  } finally {
    await close(server);
  }
});

test("POST /msg PING responde pong y no crea cuentas", async () => {
  const store = createStateStore();
  const before = store.get(TOKEN);
  const server = await listen(createApp({ store, tokens: [TOKEN] }));

  try {
    const response = await fetch(`${baseUrl(server)}/msg`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ m: "PING;64" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { pong: true });
    assert.equal(store.get(TOKEN), before);
    assert.equal(store.get(TOKEN).accounts.length, 0);
  } finally {
    await close(server);
  }
});

test("una ruta desconocida responde E404 antes de la autenticacion", async () => {
  const server = await listen(app());
  try {
    const response = await fetch(`${baseUrl(server)}/no-existe`, { method: "PUT" });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "E404", mensaje: "ruta desconocida" });
  } finally {
    await close(server);
  }
});

test("JSON invalido sin token responde 401", async () => {
  const server = await listen(app());
  try {
    const response = await fetch(`${baseUrl(server)}/msg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "E001", mensaje: "no autorizado" });
  } finally {
    await close(server);
  }
});

test("JSON invalido con token responde E100", async () => {
  const server = await listen(app());
  try {
    const response = await fetch(`${baseUrl(server)}/msg`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: "{",
    });
    const text = await response.text();
    assert.equal(response.status, 400);
    assert.equal(text.includes("<html"), false);
    assert.deepEqual(JSON.parse(text), { error: "E100", mensaje: "json inválido" });
  } finally {
    await close(server);
  }
});
