import { timingSafeEqual } from "node:crypto";

import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";

import { predictSchema } from "./validation.js";

const DEFAULT_ORIGINS = ["http://localhost:8080", "http://localhost:5173"];

const safeEqual = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const createApp = ({ predictor, metrics, logStore = null, env = process.env }) => {
  const app = express();
  const origins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : DEFAULT_ORIGINS;

  app.disable("x-powered-by");
  app.set("trust proxy", Number(env.TRUST_PROXY) || 0);
  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: "10kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      model_version: predictor.version,
      logging: logStore ? "enabled" : "disabled",
    });
  });

  app.get("/api/model", (_req, res) => res.json(metrics));

  app.post(
    "/api/predict",
    rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false }),
    (req, res) => {
      const parsed = predictSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid property details",
          errors: parsed.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        });
      }

      const result = predictor.predict(parsed.data);
      res.json(result);

      // Logging is best-effort and never delays or fails the response.
      logStore
        ?.add(parsed.data, result)
        .catch((error) => console.error("Failed to log prediction:", error.message));
    },
  );

  // Reading the log is an admin action; disabled unless ADMIN_TOKEN is set.
  app.get("/api/analyzer-log", async (req, res) => {
    const token = env.ADMIN_TOKEN;
    if (!token || !logStore) return res.status(404).json({ message: "Not found" });
    const given = (req.get("authorization") ?? "").replace(/^Bearer /, "");
    if (!safeEqual(given, token)) return res.status(401).json({ message: "Unauthorized" });
    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    res.json(await logStore.list(limit));
  });

  app.use("/api", (_req, res) => res.status(404).json({ message: "Not found" }));

  // Express 5 forwards async errors here.
  app.use((error, _req, res, _next) => {
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ message: "Malformed JSON" });
    }
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  });

  return app;
};
