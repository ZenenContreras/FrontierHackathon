import assert from "node:assert/strict";
import test from "node:test";
import { checkControl, expectedControl } from "../src/core/control.js";
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

test("la formula reproduce los controles observados y las formas cerradas", () => {
  const valid: Array<[string, string[], number]> = [
    ["ALTA", ["Lucia"], 82],
    ["ALTA", ["Mateo"], 3],
    ["ALTA", ["Lucia", "Gomez"], 11],
    ["alta", ["Lucia"], 82],
    ["DEPOSITO", ["AC-0001", "250000"], 86],
    ["DEPOSITO", ["AC-0002", "700"], 35],
    ["TRANSFER", ["AC-0001", "AC-0002", "40000"], 86],
    ["TRANSFER", ["AC-0001", "AC-0002", "120000"], 55],
    ["TRANSFER", ["AC-0001", "AC-0002", "100000"], 12],
    ["TRANSFER", ["AC-0002", "AC-0001", "50000"], 23],
    ["CONSULTA", ["AC-0001"], 14],
    ["CONSULTA", ["AC-0002"], 11],
    ["CONSULTA", ["AC-0003"], 8],
    ["CONSULTA", ["AC-0009"], 87],
    ["CONSULTA", ["AC-0010"], 84],
    ["SALDOS", ["AC-0001"], 38],
    ["SALDOS", ["AC-0002"], 35],
    ["ANULA", ["OP-0001"], 72],
    ["ANULA", ["OP-0003"], 66],
  ];
  for (const [command, args, control] of valid) {
    assert.equal(expectedControl(command, args), control, `${command};${args.join(";")}`);
    assert.equal(checkControl(command, args, String(control)), "ok");
  }

  const invalid: Array<[string, string[], string]> = [
    ["ALTA", ["Ana"], "66"],
    ["ALTA", ["Ana"], "16"],
    ["ALTA", ["Lucia"], "83"],
    ["DEPOSITO", ["AC-0009", "1"], "15"],
    ["CONSULTA", ["AC-0003"], "9"],
    ["CONSULTA", ["AC-00010"], "84"],
    ["CONSULTA", ["AC-10"], "84"],
    ["CONSULTA", ["AC-0010"], "85"],
    ["SALDOS", ["AC-10"], "11"],
    ["NOPE", [], "1"],
  ];
  for (const [command, args, control] of invalid) {
    assert.equal(checkControl(command, args, control), "invalid", `${command};${args.join(";")};${control}`);
  }

  for (let account = 1; account <= 200; account += 1) {
    const id = `AC-${String(account).padStart(4, "0")}`;
    const op = `OP-${String(account).padStart(4, "0")}`;
    assert.equal(expectedControl("CONSULTA", [id]), ((17 - 3 * account) % 97 + 97) % 97);
    assert.equal(expectedControl("SALDOS", [id]), ((41 - 3 * account) % 97 + 97) % 97);
    assert.equal(expectedControl("ANULA", [op]), ((75 - 3 * account) % 97 + 97) % 97);
  }
});

test("m ausente, nulo o no string responde E102", () => {
  const state = createInitialState();
  for (const body of [{}, { m: null }, { m: 64 }, { m: true }, { x: "PING;64" }]) {
    const result = handleMessage({ token: "t", body, state });
    assert.equal(result.status, 400);
    assert.deepEqual(result.payload, { kind: "json", value: { error: "E102", mensaje: "falta m" } });
  }
});
