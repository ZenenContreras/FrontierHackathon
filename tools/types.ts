export const DAILY_LIMIT = 8000;
export const MIN_INTERVAL_MS = 100;
export const DEFAULT_INTERVAL_MS = 120;
export const DEFAULT_TIMEOUT_MS = 5000;
export const MAX_TIMEOUT_MS = 15_000;
export const MAX_STEPS = 30;
export const MAX_BODY_BYTES = 1_000_000;
export const MIN_TOKEN_LENGTH = 8;

export const REQUIRED_FIELDS = [
  "id",
  "seq",
  "x_req",
  "hipotesis",
  "request",
  "status",
  "response",
] as const;

export type XReq = number | string | null;

export interface ExperimentRecord {
  id: number;
  seq: string;
  x_req: XReq;
  hipotesis: string;
  request: unknown;
  status: number | null;
  response: unknown;
  conclusion?: string;
}

export type Classification = "http" | "infra" | "transport";

export interface ProbeInput {
  seq: string;
  hipotesis: string;
  method: string;
  path: string;
  body: unknown;
  rawBody: boolean;
  headers: Record<string, string>;
  contentType?: string;
  attemptKey: string;
  conclusion?: string;
  timeoutMs?: number;
}

export interface TransportRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface TransportResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

export type Transport = (
  request: TransportRequest,
  signal: AbortSignal,
) => Promise<TransportResponse>;

export interface ProbeResult {
  sent: boolean;
  duplicate: boolean;
  classification: Classification | "blocked";
  usableAsEvidence: boolean;
  record: ExperimentRecord | null;
  method: string;
  path: string;
  message: string;
  relevantResponseHeaders?: Record<string, string>;
}

export interface LabPaths {
  log: string;
  quota: string;
  ledger: string;
}

export interface LabContext {
  transport: Transport;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  paths: LabPaths;
  token: string;
  baseUrl: string;
  minIntervalMs: number;
  dailyLimit: number;
  timeoutMs: number;
  maxBodyBytes: number;
  authMode?: "bearer" | "omit" | "invalid";
}
