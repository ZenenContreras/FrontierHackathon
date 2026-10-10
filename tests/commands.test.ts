import assert from "node:assert/strict";
import test from "node:test";
import { handleMessage } from "../src/core/handleMessage.js";
import { createInitialState, type TokenState } from "../src/state/store.js";

function run(state: TokenState, message: string) {
  return handleMessage({ token: "t", body: { m: message }, state });
}

function bodyOf(result: ReturnType<typeof run>): unknown {
  return result.payload.kind === "json" ? result.payload.value : result.payload;
}

test("PING acepta controles no numericos y rechaza aridad de mas", () => {
  const state = createInitialState();
  assert.deepEqual(bodyOf(run(state, "PING;5X")), { pong: true });
  assert.deepEqual(bodyOf(run(state, "ping;64")), { pong: true });
  assert.deepEqual(bodyOf(run(state, "PING;64 ")), { pong: true });
  const extra = run(state, "PING;64;1");
  assert.equal(extra.status, 400);
  assert.deepEqual(bodyOf(extra), { error: "E302", mensaje: "aridad inválida" });
  assert.equal(state.accounts.length, 0);
});

test("ALTA crea ids consecutivos, permite repetir nombre y no crea si el control conocido falla", () => {
  const state = createInitialState();
  assert.equal(run(state, "ALTA;Lucia;83").status, 400);
  assert.equal(state.accounts.length, 0);
  assert.deepEqual(bodyOf(run(state, "ALTA;Lucia;82")), { cuentaId: "AC-0001" });
  assert.deepEqual(bodyOf(run(state, "alta;Lucia;82")), { cuentaId: "AC-0002" });
  assert.equal(run(state, "ALTA;Lucia;Gomez;11").status, 400);
  assert.equal(state.accounts.length, 2);
});

test("CONSULTA usa cuenta_id y saldo 0, y E401 si no existe", () => {
  const state = createInitialState();
  run(state, "ALTA;Lucia;82");
  assert.deepEqual(bodyOf(run(state, "CONSULTA;AC-0001;14")), {
    cuenta_id: "AC-0001",
    saldo: "0.00",
  });
  assert.equal(run(state, "CONSULTA;AC-0009;87").status, 404);
  assert.deepEqual(bodyOf(run(state, "CONSULTA;AC-0009;87")), {
    error: "E401",
    mensaje: "cuenta inexistente",
  });
});

test("deposito, transferencia, limite, saldo y anulacion reproducen los casos observados", () => {
  const state = createInitialState();
  run(state, "ALTA;Lucia;82");
  run(state, "ALTA;Mateo;3");
  assert.deepEqual(bodyOf(run(state, "DEPOSITO;AC-0001;250000;86")), {
    status: "recieved",
    operacionId: "OP-0001",
  });
  assert.deepEqual(bodyOf(run(state, "TRANSFER;AC-0001;AC-0002;40000;86")), {
    status: "recieved",
    operacionId: "OP-0002",
  });
  assert.deepEqual(bodyOf(run(state, "CONSULTA;AC-0002;11")), {
    cuenta_id: "AC-0002",
    saldo: "400.00",
  });
  assert.equal(run(state, "TRANSFER;AC-0001;AC-0002;120000;55").status, 422);
  assert.equal(run(state, "TRANSFER;AC-0001;AC-0002;100000;12").status, 422);
  assert.deepEqual(bodyOf(run(state, "TRANSFER;AC-0001;AC-0002;100000;12")), {
    error: "E506",
    mensaje: "límite excedido",
  });
  assert.equal(state.nextOperation, 3);
  assert.deepEqual(bodyOf(run(state, "CONSULTA;AC-0001;14")), {
    cuenta_id: "AC-0001",
    saldo: "2100.00",
  });
});

test("E507 no mueve saldos y anular un deposito los revierte", () => {
  const state = createInitialState();
  run(state, "ALTA;Lucia;82");
  run(state, "ALTA;Mateo;3");
  assert.equal(run(state, "TRANSFER;AC-0002;AC-0001;50000;23").status, 422);
  assert.equal(state.accounts[0]?.balance, 0);
  assert.equal(state.accounts[1]?.balance, 0);
  run(state, "DEPOSITO;AC-0001;250000;86");
  assert.deepEqual(bodyOf(run(state, "anula;OP-0001;72")), { ok: true, anulada: "OP-0001" });
  assert.equal(state.accounts[0]?.balance, 0);
});

test("SALDOS con control valido sigue siendo comando desconocido con espacio final", () => {
  const state = createInitialState();
  const result = run(state, "SALDOS;AC-0001;38");
  assert.equal(result.status, 400);
  assert.deepEqual(bodyOf(result), { error: "E301", mensaje: "comando desconocido " });
});

test("un control numerico distinto del observado es E202 y no cambia el estado", () => {
  const state = createInitialState();
  const deposit = run(state, "DEPOSITO;AC-0001;100;1");
  assert.equal(deposit.status, 400);
  assert.deepEqual(bodyOf(deposit), { error: "E202", mensaje: "control inválido" });
  const alta = run(state, "ALTA;Ana;66");
  assert.equal(alta.status, 400);
  assert.deepEqual(bodyOf(alta), { error: "E202", mensaje: "control inválido" });
  assert.equal(run(state, "ALTA;Ana;16").status, 400);
  const unknown = run(state, "NOPE;1");
  assert.equal(unknown.status, 400);
  assert.deepEqual(bodyOf(unknown), { error: "E202", mensaje: "control inválido" });
  assert.deepEqual(bodyOf(run(state, "NOPE;2")), { error: "E301", mensaje: "comando desconocido " });
  assert.equal(state.accounts.length, 0);
  assert.equal(state.nextOperation, 1);
  assert.deepEqual(bodyOf(run(state, "ALTA;Ana;50")), { cuentaId: "AC-0001" });
});

test("formatSaldo divide el entero almacenado entre 100; no es una medicion nueva de V2", () => {
  const state = createInitialState();
  run(state, "ALTA;Lucia;82");
  const samples: Array<[string, string, string]> = [
    ["0", "31", "0.00"],
    ["1", "28", "0.01"],
    ["99", "4", "0.99"],
    ["100", "82", "1.00"],
    ["700", "28", "7.00"],
    ["40000", "66", "400.00"],
    ["40700", "3", "407.00"],
    ["210000", "0", "2100.00"],
  ];
  for (const [amount, control, saldo] of samples) {
    const fresh = createInitialState();
    run(fresh, "ALTA;Lucia;82");
    if (amount !== "0") {
      const deposited = run(fresh, `DEPOSITO;AC-0001;${amount};${control}`);
      assert.equal(deposited.status, 200, amount);
    }
    assert.deepEqual(bodyOf(run(fresh, "CONSULTA;AC-0001;14")), {
      cuenta_id: "AC-0001",
      saldo,
    });
  }
  assert.equal(state.accounts[0]?.balance, 0);
});
