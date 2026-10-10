import type { NextFunction, Request, Response } from "express";
import { provisionalInvalidJson, provisionalUnhandled } from "./provisional.js";
import { sendResult } from "./sendResult.js";

function isJsonParseError(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("type" in err)) {
    return false;
  }

  return err.type === "entity.parse.failed";
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    return;
  }

  if (isJsonParseError(err)) {
    sendResult(res, provisionalInvalidJson());
    return;
  }

  sendResult(res, provisionalUnhandled());
}
