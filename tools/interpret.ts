import type { XReq } from "./types.js";

export function interpretXReq(raw: string | undefined): XReq {
  if (raw === undefined) {
    return null;
  }
  const digits = raw.startsWith("-") ? raw.slice(1) : raw;
  if (/^\d+$/.test(digits) && digits.length > 0 && digits.length <= 15) {
    return Number(raw);
  }
  return raw;
}

export function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return undefined;
}

export function interpretResponseBody(
  raw: string,
  contentType: string | undefined,
): unknown {
  if (raw.length === 0) {
    return "";
  }
  if (contentType !== undefined && contentType.toLowerCase().includes("json")) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

export function computeGap(lastSentAt: number, nowMs: number, minIntervalMs: number): number {
  if (lastSentAt <= 0) {
    return 0;
  }
  const elapsed = nowMs - lastSentAt;
  if (elapsed >= minIntervalMs) {
    return 0;
  }
  if (elapsed < 0) {
    return minIntervalMs;
  }
  return minIntervalMs - elapsed;
}
