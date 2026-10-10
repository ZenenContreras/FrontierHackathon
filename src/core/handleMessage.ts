import type { CommandResult } from "./result.js";
import type { TokenState } from "../state/store.js";

export interface IncomingMessage {
  token: string | null;
  body: unknown;
  state: TokenState;
}

export function handleMessage(input: IncomingMessage): CommandResult {
  void input.body;
  void input.state;
  void input.token;
  // 501 provisional. No es un error observado del original.
  return {
    status: 501,
    payload: {
      kind: "json",
      value: { provisional: true, route: "POST /msg" },
    },
  };
}
