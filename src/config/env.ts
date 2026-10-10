export interface AppConfig {
  port: number;
  host: string;
  tokens: string[];
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
