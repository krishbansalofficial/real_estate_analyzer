// Vercel serverless entry point: serves the same Express app as server/ under /api/*.
// vercel.json rewrites every /api/... request here; Express still sees the original path.
import { loadApp } from "../server/src/load.js";

// Vercel sits behind one proxy hop; trust it so rate limiting sees client IPs.
const { app } = loadApp({ TRUST_PROXY: "1", ...process.env });

export default app;
