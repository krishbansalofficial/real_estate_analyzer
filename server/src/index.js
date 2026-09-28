import "dotenv/config";

import { loadApp } from "./load.js";

const port = Number(process.env.PORT) || 3000;

const started = Date.now();
const { app, predictor, logStore } = loadApp();

app.listen(port, () => {
  console.log(
    `API on http://localhost:${port} (model ${predictor.version}, loaded in ${Date.now() - started}ms, logging ${logStore ? "on" : "off"})`,
  );
});
