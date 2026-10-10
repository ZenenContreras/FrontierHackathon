import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { registerRoutes } from "./http/routes.js";
import { createStateStore, type StateStore } from "./state/store.js";

export interface AppDependencies {
  store?: StateStore;
  tokens?: readonly string[];
}

export function createApp(deps: AppDependencies = {}): Express {
  const store = deps.store ?? createStateStore();
  const tokens = deps.tokens ?? [];
  const app = express();

  app.disable("x-powered-by");
  app.set("case sensitive routing", true);
  app.set("strict routing", true);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      req.body = Buffer.concat(chunks).toString("utf8");
      next();
    });
    req.on("error", next);
  });
  registerRoutes(app, store, { tokens });

  return app;
}
