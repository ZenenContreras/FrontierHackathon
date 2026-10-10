import type { Express, Request, Response } from "express";
import { handleMessage } from "../core/handleMessage.js";
import type { StateStore } from "../state/store.js";
import { readRequestContext } from "./context.js";
import { errorHandler } from "./errorHandler.js";
import { provisionalHealth, provisionalReset, provisionalUnknown } from "./provisional.js";
import { sendResult } from "./sendResult.js";

export function registerRoutes(app: Express, store: StateStore): void {
  app.get("/health", (_req: Request, res: Response) => {
    sendResult(res, provisionalHealth());
  });

  app.post("/__reset", (req: Request, res: Response) => {
    const context = readRequestContext(req.header("authorization"));
    store.reset(context.stateKey);
    sendResult(res, provisionalReset());
  });

  app.post("/msg", (req: Request, res: Response) => {
    const context = readRequestContext(req.header("authorization"));
    const state = store.get(context.stateKey);
    sendResult(
      res,
      handleMessage({
        token: context.token,
        body: req.body,
        state,
      }),
    );
  });

  app.use((req: Request, res: Response) => {
    sendResult(res, provisionalUnknown(req.method, req.path));
  });

  app.use(errorHandler);
}
