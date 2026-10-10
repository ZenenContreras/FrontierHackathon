// SIMULADO. Comprueba el aislamiento del laboratorio sin contactar el original.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "../tools/cli.js";
import { applyEnvFile } from "../tools/env.js";
import { readdirSync, statSync } from "node:fs";

const TOKEN = "super-secret-token";

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    files.push(full);
  }
  return files;
}

test("el servidor desplegable no depende del laboratorio ni del original", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: { start: string } };
  const tsconfig = JSON.parse(readFileSync("tsconfig.json", "utf8")) as { include: string[] };
  const offenders: string[] = [];

  assert.equal(packageJson.scripts.start, "node dist/server.js");
  assert.deepEqual(tsconfig.include, ["src/**/*.ts"]);

  for (const file of walk("src")) {
    const source = readFileSync(file, "utf8");
    for (const needle of ["tools/", "PARTICIPANT_TOKEN", "fetch(", "caja-negra-production", "experimentos.jsonl"]) {
      if (source.includes(needle)) {
        offenders.push(`${file} contiene ${needle}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("simulado: dry-run no envía, no escribe el log y no imprime el token", async () => {
  let calls = 0;
  const dir = mkdtempSync(path.join(tmpdir(), "lab-cli-"));
  const logPath = path.join(dir, "experimentos.jsonl");
  const output: string[] = [];
  const code = await runCli([
    "probe",
    "--dry-run",
    "--seq",
    "s0",
    "--hipotesis",
    `comprobación ${TOKEN}`,
    "--method",
    "GET",
    "--path",
    "/health",
  ], {
    env: { PARTICIPANT_TOKEN: TOKEN },
    envFilePath: null,
    logPath,
    transport: async () => {
      calls += 1;
      throw new Error("no debía enviarse");
    },
    io: {
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line),
    },
  });

  assert.equal(code, 0);
  assert.equal(calls, 0);
  assert.equal(existsSync(logPath), false);
  assert.equal(output.join("\n").includes(TOKEN), false);
  assert.match(output.join("\n"), /no se envió ninguna solicitud/);
});

test("simulado: sin token no se envía nada", async () => {
  let calls = 0;
  const output: string[] = [];
  const code = await runCli([
    "probe",
    "--seq",
    "s0",
    "--hipotesis",
    "no debe salir",
    "--method",
    "GET",
    "--path",
    "/health",
  ], {
    env: {},
    envFilePath: null,
    transport: async () => {
      calls += 1;
      return { status: 200, body: "", headers: {} };
    },
    io: {
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line),
    },
  });

  assert.equal(code, 2);
  assert.equal(calls, 0);
  assert.match(output.join("\n"), /PARTICIPANT_TOKEN/);
});

test("simulado: el cargador de .env no devuelve el valor en el diagnóstico", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lab-env-"));
  const file = path.join(dir, ".env");
  writeFileSync(file, `PARTICIPANT_TOKEN=${TOKEN}\nNO=VALOR\n`);

  const loaded = applyEnvFile({}, file);
  const diagnostic = loaded.loadedKeys.join(",");

  assert.deepEqual(loaded.loadedKeys, ["PARTICIPANT_TOKEN", "NO"]);
  assert.equal(diagnostic.includes(TOKEN), false);
  assert.equal(loaded.env.PARTICIPANT_TOKEN, TOKEN);
});

test("simulado: las pruebas no escriben el experimentos.jsonl del repositorio", () => {
  assert.equal(readFileSync("experimentos.jsonl", "utf8"), "");
});
