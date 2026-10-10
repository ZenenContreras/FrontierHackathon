import type { Transport, TransportRequest } from "./types.js";

export const fetchTransport: Transport = async (request: TransportRequest, signal: AbortSignal) => {
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    signal,
    redirect: "manual",
    cache: "no-store",
  };
  if (request.body !== undefined) {
    init.body = request.body;
  }
  const response = await fetch(request.url, init);
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return {
    status: response.status,
    body: await response.text(),
    headers,
  };
};
