import type { Response } from "express";
import type { CommandResult } from "../core/result.js";

export function sendResult(res: Response, result: CommandResult): void {
  res.status(result.status);

  if (result.payload.kind === "empty") {
    res.end();
    return;
  }

  if (result.payload.kind === "text") {
    res.type("text/plain; charset=utf-8");
    res.send(result.payload.value);
    return;
  }

  res.json(result.payload.value);
}
