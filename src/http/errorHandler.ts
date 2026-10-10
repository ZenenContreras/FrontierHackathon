import type { NextFunction, Request, Response } from "express";
import { provisionalUnhandled } from "./provisional.js";
import { sendResult } from "./sendResult.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    return;
  }
  void err;
  sendResult(res, provisionalUnhandled());
}
