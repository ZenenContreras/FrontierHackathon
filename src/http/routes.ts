import type { Express, Request, Response } from "express";
import { unauthorized, unknownRoute } from "../core/errors.js";
import { handleMessage, parseMsgBody } from "../core/handleMessage.js";
import { jsonResult } from "../core/errors.js";
import type { StateStore } from "../state/store.js";
import { readRequestContext } from "./context.js";
import { errorHandler } from "./errorHandler.js";
import { sendResult } from "./sendResult.js";

export interface RouteOptions {
  tokens: readonly string[];
}

export function registerRoutes(app: Express, store: StateStore, options: RouteOptions): void {
  app.get("/health", (req: Request, res: Response) => {
    if (!isAuthorized(req, options.tokens)) {
      sendResult(res, unauthorized);
      return;
    }
    sendResult(res, jsonResult(200, { ok: true }));
  });

  app.post("/__reset", (req: Request, res: Response) => {
    if (!isAuthorized(req, options.tokens)) {
      sendResult(res, unauthorized);
      return;
    }
    const context = readRequestContext(req.header("authorization"));
    store.reset(context.stateKey);
    sendResult(res, jsonResult(200, { ok: true }));
  });

  app.post("/msg", (req: Request, res: Response) => {
    if (!isAuthorized(req, options.tokens)) {
      sendResult(res, unauthorized);
      return;
    }
    const raw = rawBody(req);
    const parsed = parseMsgBody(raw);
    if (!parsed.ok) {
      sendResult(res, parsed.result);
      return;
    }
    const context = readRequestContext(req.header("authorization"));
    sendResult(
      res,
      handleMessage({
        token: context.token,
        body: parsed.body,
        state: store.get(context.stateKey),
      }),
    );
  });

  app.use((_req: Request, res: Response) => {
    sendResult(res, unknownRoute);
  });

  app.use(errorHandler);
}

function isAuthorized(req: Request, tokens: readonly string[]): boolean {
  const context = readRequestContext(req.header("authorization"));
  return context.token !== null && tokens.includes(context.token);
}

function rawBody(req: Request): string {
  if (typeof req.body === "string") {
    return req.body;
  }
  return "";
}
