import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createApp } from "../src/app.js";

const fakeResult = {
  estimate: 500000,
  low: 400000,
  high: 600000,
  interval_coverage: 80,
  price_per_sqft: 278,
  location: { matched: "zip", label: "12345", sales_in_data: 10, median_price_per_sqft: 250, median_price: 450000 },
  comparables: [],
  model_version: "test",
};

const logged = [];
const logStore = {
  add: async (input, result) => logged.push({ input, result }),
  list: async () => logged,
};

let server;
let base;

const post = (path, body) =>
  fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

before(async () => {
  const app = createApp({
    predictor: { version: "test", predict: () => fakeResult },
    metrics: { model: { median_abs_pct_error: 15 } },
    logStore,
    env: { ADMIN_TOKEN: "secret-token" },
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const valid = { bed: 3, bath: 2, house_size: 1800, acre_lot: 0.25, zip_code: "12345" };

describe("POST /api/predict", () => {
  it("returns the prediction and logs it server-side", async () => {
    const res = await post("/api/predict", valid);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), fakeResult);
    assert.equal(logged.at(-1).input.zip_code, "12345");
  });

  it("rejects out-of-range and malformed input with field errors", async () => {
    const res = await post("/api/predict", { ...valid, house_size: 10, zip_code: "abc" });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.deepEqual(body.errors.map((e) => e.field).sort(), ["house_size", "zip_code"]);
  });

  it("treats an empty zip as absent", async () => {
    const res = await post("/api/predict", { ...valid, zip_code: "" });
    assert.equal(res.status, 200);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await post("/api/predict", "{not json");
    assert.equal(res.status, 400);
  });

  it("still responds when logging fails", async () => {
    const failing = createApp({
      predictor: { version: "t", predict: () => fakeResult },
      metrics: {},
      logStore: { add: async () => { throw new Error("db down"); } },
      env: {},
    }).listen(0);
    await new Promise((r) => failing.once("listening", r));
    const res = await fetch(`http://127.0.0.1:${failing.address().port}/api/predict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(valid),
    });
    assert.equal(res.status, 200);
    failing.close();
  });
});

describe("GET /api/analyzer-log", () => {
  it("requires the admin token", async () => {
    assert.equal((await fetch(`${base}/api/analyzer-log`)).status, 401);
    const ok = await fetch(`${base}/api/analyzer-log`, {
      headers: { authorization: "Bearer secret-token" },
    });
    assert.equal(ok.status, 200);
  });
});

describe("misc routes", () => {
  it("reports health and model metrics", async () => {
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.logging, "enabled");
    const model = await (await fetch(`${base}/api/model`)).json();
    assert.equal(model.model.median_abs_pct_error, 15);
  });

  it("no longer exposes log mutation routes", async () => {
    const res = await fetch(`${base}/api/analyzer-log/1`, { method: "DELETE" });
    assert.equal(res.status, 404);
  });
});
