import assert from "node:assert/strict";
import test from "node:test";
import { checkControl } from "../src/core/control.js";
import { handleMessage } from "../src/core/handleMessage.js";
import { parseMessage } from "../src/core/parseMessage.js";
import { createInitialState } from "../src/state/store.js";

test("separa comando, argumentos y control sin normalizar el nombre", () => {
  assert.deepEqual(parseMessage("ALTA;Lucia;82"), {
    command: "ALTA",
    args: ["Lucia"],
    control: "82",
  });
  assert.deepEqual(parseMessage("TRANSFER;AC-0001;AC-0002;40000;86"), {
    command: "TRANSFER",
    args: ["AC-0001", "AC-0002", "40000"],
    control: "86",
  });
});

test("un segmento vacio es E104 y la falta de control es E103", () => {
  assert.equal(parseMessage("PING;"), "E104");
  assert.equal(parseMessage("PING;;64"), "E104");
  assert.equal(parseMessage("ALTA;;82"), "E104");
  assert.equal(parseMessage("PING"), "E103");
});

test("el control de CONSULTA y ANULA usa el entero de cuatro digitos", () => {
  assert.equal(checkControl("CONSULTA", ["AC-0001"], "14"), "ok");
  assert.equal(checkControl("CONSULTA", ["AC-0003"], "8"), "ok");
  assert.equal(checkControl("CONSULTA", ["AC-0003"], "9"), "invalid");
  assert.equal(checkControl("consulta", ["AC-0010"], "84"), "ok");
  assert.equal(checkControl("ANULA", ["OP-0001"], "72"), "ok");
  assert.equal(checkControl("SALDOS", ["AC-0002"], "35"), "ok");
  assert.equal(checkControl("PING", ["64"], "5X"), "malformed");
});

test("m ausente, nulo o no string responde E102", () => {
  const state = createInitialState();
  for (const body of [{}, { m: null }, { m: 64 }, { m: true }, { x: "PING;64" }]) {
    const result = handleMessage({ token: "t", body, state });
    assert.equal(result.status, 400);
    assert.deepEqual(result.payload, { kind: "json", value: { error: "E102", mensaje: "falta m" } });
  }
});
