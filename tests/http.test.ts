import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { createStateStore } from "../src/state/store.js";

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

test("GET /health responde 200 sin cuerpo", async () => {
  const server = await listen(createApp());
  try {
    const response = await fetch(`${baseUrl(server)}/health`);
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.equal(text, "");
  } finally {
    await close(server);
  }
});

test("POST /__reset reinicia solo el token indicado", async () => {
  const store = createStateStore();
  const beforeA = store.get("alpha");
  const beforeB = store.get("beta");
  const server = await listen(createApp({ store }));

  try {
    const response = await fetch(`${baseUrl(server)}/__reset`, {
      method: "POST",
      headers: { Authorization: "Bearer alpha" },
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "");
    assert.notEqual(store.get("alpha"), beforeA);
    assert.equal(store.get("beta"), beforeB);
  } finally {
    await close(server);
  }
});

test("POST /__reset sin token no borra el estado de otro token", async () => {
  const store = createStateStore();
  const named = store.get("alpha");
  const anonymous = store.get("");
  const server = await listen(createApp({ store }));

  try {
    const response = await fetch(`${baseUrl(server)}/__reset`, { method: "POST" });

    assert.equal(response.status, 200);
    assert.equal(store.get("alpha"), named);
    assert.notEqual(store.get(""), anonymous);
  } finally {
    await close(server);
  }
});

test("POST /msg está cableado y no muta el estado", async () => {
  const store = createStateStore();
  const before = store.get("alpha");
  const server = await listen(createApp({ store }));

  try {
    const response = await fetch(`${baseUrl(server)}/msg`, {
      method: "POST",
      headers: {
        Authorization: "Bearer alpha",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ m: "PING;64" }),
    });

    assert.equal(response.status, 501);
    assert.deepEqual(await response.json(), { provisional: true, route: "POST /msg" });
    assert.equal(store.get("alpha"), before);
  } finally {
    await close(server);
  }
});

test("una ruta desconocida no usa el HTML por defecto de Express", async () => {
  const server = await listen(createApp());
  try {
    const response = await fetch(`${baseUrl(server)}/no-existe`, { method: "PUT" });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      provisional: true,
      method: "PUT",
      path: "/no-existe",
    });
  } finally {
    await close(server);
  }
});

test("un JSON inválido no devuelve una página HTML", async () => {
  const server = await listen(createApp());
  try {
    const response = await fetch(`${baseUrl(server)}/msg`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    const text = await response.text();

    assert.equal(response.status, 400);
    assert.equal(text.includes("<html"), false);
    assert.deepEqual(JSON.parse(text), { provisional: true, reason: "invalid-json" });
  } finally {
    await close(server);
  }
});
