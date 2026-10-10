import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig, loadEnvFile } from "../src/config/env.js";

const TOKEN = "local-bearer-token";

test("loadEnvFile rellena PARTICIPANT_TOKEN vacío y loadConfig lo acepta", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "caja-env-"));
  const file = path.join(dir, ".env");
  writeFileSync(file, `PORT=3000\nPARTICIPANT_TOKEN=${TOKEN}\n`);
  const env: NodeJS.ProcessEnv = {};

  const loaded = loadEnvFile(env, file);
  const config = loadConfig(env);

  assert.deepEqual(loaded, ["PORT", "PARTICIPANT_TOKEN"]);
  assert.equal(config.tokens.length, 1);
  assert.equal(config.tokens[0], TOKEN);
  assert.equal(loaded.join(",").includes(TOKEN), false);
});

test("loadEnvFile no pisa un PARTICIPANT_TOKEN ya definido", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "caja-env-"));
  const file = path.join(dir, ".env");
  writeFileSync(file, `PARTICIPANT_TOKEN=${TOKEN}\n`);
  const env: NodeJS.ProcessEnv = { PARTICIPANT_TOKEN: "from-platform" };

  assert.deepEqual(loadEnvFile(env, file), []);
  assert.deepEqual(loadConfig(env).tokens, ["from-platform"]);
});

test("sin .env, loadConfig deja tokens vacío", () => {
  const missing = path.join(tmpdir(), "caja-env-missing", ".env");
  const env: NodeJS.ProcessEnv = {};

  assert.deepEqual(loadEnvFile(env, missing), []);
  assert.deepEqual(loadConfig(env).tokens, []);
});
