import { readFileSync } from "node:fs";

import { createApp } from "./app.js";
import { createLogStore } from "./db.js";
import { createPredictor, loadJsonGz } from "./model.js";

const modelDir = new URL("../model/", import.meta.url);

/** Load the model artifacts and build the Express app. Used by the local server and Vercel. */
export const loadApp = (env = process.env) => {
  const predictor = createPredictor(
    loadJsonGz(new URL("model.json.gz", modelDir)),
    loadJsonGz(new URL("comps.json.gz", modelDir)),
  );
  const metrics = JSON.parse(readFileSync(new URL("metrics.json", modelDir), "utf8"));
  const logStore = createLogStore(env);
  return { app: createApp({ predictor, metrics, logStore, env }), predictor, logStore };
};
