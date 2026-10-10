import express, { type Express } from "express";
import { registerRoutes } from "./http/routes.js";
import { createStateStore, type StateStore } from "./state/store.js";

export interface AppDependencies {
  store?: StateStore;
}

export function createApp(deps: AppDependencies = {}): Express {
  const store = deps.store ?? createStateStore();
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());
  registerRoutes(app, store);

  return app;
}
