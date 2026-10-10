import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

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

test("el código desplegable no referencia el servicio original", () => {
  const srcDir = path.resolve("src");
  const forbidden = ["caja-negra-production", "up.railway.app", "node-fetch", "axios", "fetch("];
  const offenders: string[] = [];

  for (const file of walk(srcDir)) {
    const source = readFileSync(file, "utf8");
    for (const needle of forbidden) {
      if (source.includes(needle)) {
        offenders.push(`${file} contiene ${needle}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});
