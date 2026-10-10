import { existsSync, readFileSync } from "node:fs";

export interface AppConfig {
  port: number;
  host: string;
  tokens: string[];
}

export function loadEnvFile(env: NodeJS.ProcessEnv = process.env, filePath = ".env"): string[] {
  if (!existsSync(filePath)) {
    return [];
  }

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
    if (env[key] !== undefined && env[key] !== "") {
      continue;
    }
    env[key] = unquote(body.slice(separator + 1).trim());
    loadedKeys.push(key);
  }
  return loadedKeys;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawPort = env.PORT ?? "3000";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT inválido: ${rawPort}`);
  }

  const token = env.PARTICIPANT_TOKEN ?? "";
  return {
    port,
    host: "0.0.0.0",
    tokens: token.length > 0 ? [token] : [],
  };
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
