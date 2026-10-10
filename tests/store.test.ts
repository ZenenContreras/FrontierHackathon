import assert from "node:assert/strict";
import test from "node:test";
import { createStateStore } from "../src/state/store.js";

test("el estado de un token se reutiliza hasta el reset", () => {
  const store = createStateStore();

  const first = store.get("token-a");
  const second = store.get("token-a");

  assert.equal(first, second);
  assert.deepEqual(first, {});
});

test("el reset reemplaza solo el estado de ese token", () => {
  const store = createStateStore();
  const tokenA = store.get("token-a");
  const tokenB = store.get("token-b");

  store.reset("token-a");

  assert.notEqual(store.get("token-a"), tokenA);
  assert.equal(store.get("token-b"), tokenB);
  assert.deepEqual(store.get("token-a"), {});
});

test("dos almacenes no comparten estado", () => {
  const left = createStateStore();
  const right = createStateStore();

  assert.notEqual(left.get("token-a"), right.get("token-a"));
});
