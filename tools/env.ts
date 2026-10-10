import { existsSync, readFileSync } from "node:fs";

export function applyEnvFile(
  env: NodeJS.ProcessEnv,
  filePath: string,
): { env: NodeJS.ProcessEnv; loadedKeys: string[] } {
  if (!existsSync(filePath)) {
    return { env, loadedKeys: [] };
  }
  const next: NodeJS.ProcessEnv = { ...env };
  const loadedKeys: string[] = [];
  const lines = readFileSync(filePath, "utf8").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const body = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const separator = body.indexOf("=");
    if (separator <= 0) {
      throw new Error(`línea ${index + 1} de .env no es válida`);
    }
    const key = body.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`línea ${index + 1} de .env no es válida`);
    }
    if (next[key] !== undefined && next[key] !== "") {
      continue;
    }
    next[key] = unquote(body.slice(separator + 1).trim());
    loadedKeys.push(key);
  }
  return { env: next, loadedKeys };
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1);
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}
