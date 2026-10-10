import { createApp } from "./app.js";
import { loadConfig, loadEnvFile } from "./config/env.js";

loadEnvFile();
const config = loadConfig();
const app = createApp({ tokens: config.tokens });

app.listen(config.port, config.host, () => {
  console.log(`listening on ${config.host}:${config.port}`);
});
