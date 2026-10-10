import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const app = createApp();

app.listen(config.port, config.host, () => {
  console.log(`listening on ${config.host}:${config.port}`);
});
