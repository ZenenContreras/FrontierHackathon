import {
  emptySegment,
  invalidJson,
  missingControl,
  missingM,
} from "./errors.js";
import { executeMessage } from "./execute.js";
import { parseMessage } from "./parseMessage.js";
import type { CommandResult } from "./result.js";
import type { TokenState } from "../state/store.js";

export interface IncomingMessage {
  token: string | null;
  body: unknown;
  state: TokenState;
}

export function handleMessage(input: IncomingMessage): CommandResult {
  if (!isJsonObject(input.body)) {
    return missingM;
  }
  const message = input.body.m;
  if (typeof message !== "string") {
    return missingM;
  }
  const parsed = parseMessage(message);
  if (parsed === "E103") {
    return missingControl;
  }
  if (parsed === "E104") {
    return emptySegment;
  }
  return executeMessage(parsed, input.state);
}

export function parseMsgBody(raw: string): { ok: true; body: unknown } | { ok: false; result: CommandResult } {
  if (raw.length === 0) {
    return { ok: false, result: invalidJson };
  }
  try {
    return { ok: true, body: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, result: invalidJson };
  }
}

function isJsonObject(value: unknown): value is { m?: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
