import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

interface QuotaFile {
  date: string;
  sent: number;
  lastSentAt: number;
}

export function readQuota(quotaPath: string, now: Date): QuotaFile {
  if (!existsSync(quotaPath)) {
    return { date: utcDate(now), sent: 0, lastSentAt: 0 };
  }
  const parsed = JSON.parse(readFileSync(quotaPath, "utf8")) as Partial<QuotaFile>;
  const date = utcDate(now);
  if (parsed.date !== date) {
    return { date, sent: 0, lastSentAt: typeof parsed.lastSentAt === "number" ? parsed.lastSentAt : 0 };
  }
  return {
    date,
    sent: typeof parsed.sent === "number" ? parsed.sent : 0,
    lastSentAt: typeof parsed.lastSentAt === "number" ? parsed.lastSentAt : 0,
  };
}

export function reserveQuota(quotaPath: string, now: Date, dailyLimit: number): { ok: true } | { ok: false } {
  const current = readQuota(quotaPath, now);
  if (current.sent >= dailyLimit) {
    return { ok: false };
  }
  writeQuota(quotaPath, {
    date: current.date,
    sent: current.sent + 1,
    lastSentAt: now.getTime(),
  });
  return { ok: true };
}

function writeQuota(quotaPath: string, quota: QuotaFile): void {
  mkdirSync(path.dirname(quotaPath), { recursive: true });
  writeFileSync(quotaPath, JSON.stringify(quota), "utf8");
}

function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}
