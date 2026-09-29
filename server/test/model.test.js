import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createPredictor,
  encodeLocation,
  evalTrees,
  loadJsonGz,
  pickComparables,
} from "../src/model.js";

const model = loadJsonGz(new URL("../model/model.json.gz", import.meta.url));
const comps = loadJsonGz(new URL("../model/comps.json.gz", import.meta.url));
const predictor = createPredictor(model, comps);

const home = { bed: 3, bath: 2, house_size: 1800, acre_lot: 0.25 };

describe("evalTrees", () => {
  it("reproduces sklearn predictions for the golden rows", () => {
    model.golden.X.forEach((row, i) => {
      const x = row.map((v) => (v === null ? NaN : v));
      assert.ok(
        Math.abs(evalTrees(model, x) - model.golden.y[i]) < 1e-4,
        `row ${i}`,
      );
    });
  });
});

describe("encodeLocation", () => {
  const { location } = model;
  const knownZip = Object.keys(location.zip)[0];
  const unknownZip = ["99998", "99997", "99996"].find((z) => !location.zip[z]);

  it("prefers the zip code", () => {
    assert.equal(encodeLocation(location, { zip_code: knownZip }).matched, "zip");
  });

  it("falls back to city, then state, then national", () => {
    assert.equal(
      encodeLocation(location, { zip_code: unknownZip, city: "Austin", state: "TX" }).matched,
      "city",
    );
    assert.equal(
      encodeLocation(location, { city: "Nowhereville", state: "Texas" }).matched,
      "state",
    );
    assert.equal(encodeLocation(location, {}).matched, "national");
  });
});

describe("predict", () => {
  it("returns an estimate inside its own interval", () => {
    const r = predictor.predict({ ...home, zip_code: "78704", city: "Austin", state: "Texas" });
    assert.ok(r.low < r.estimate && r.estimate < r.high);
    assert.equal(r.location.matched, "zip");
    assert.equal(r.interval_coverage, 80);
  });

  it("prices a home in an expensive zip above the same home in a cheap one", () => {
    const pricey = predictor.predict({ ...home, zip_code: "94301" }); // Palo Alto
    const cheap = predictor.predict({ ...home, zip_code: "48205" }); // Detroit
    assert.ok(pricey.estimate > 3 * cheap.estimate);
  });

  it("values a larger home higher, all else equal", () => {
    const small = predictor.predict({ ...home, zip_code: "78704", house_size: 1200 });
    const large = predictor.predict({ ...home, zip_code: "78704", house_size: 3000 });
    assert.ok(large.estimate > small.estimate);
  });

  it("widens the interval when the location is less specific", () => {
    const zip = predictor.predict({ ...home, zip_code: "78704" });
    const national = predictor.predict(home);
    const width = (r) => Math.log(r.high / r.low);
    assert.ok(width(national) > width(zip));
    assert.deepEqual(national.comparables, []);
  });

  it("accepts a missing lot size", () => {
    const r = predictor.predict({ ...home, acre_lot: null, zip_code: "10025" });
    assert.ok(Number.isFinite(r.estimate) && r.estimate > 0);
  });
});

describe("pickComparables", () => {
  it("returns the closest homes first and prefers sales", () => {
    const rows = [
      [3, 2, 1800, 0.2, 400000, 0, null, "A"],
      [3, 2, 1790, 0.2, 390000, 1, "2021-05-01", "A"],
      [6, 5, 5000, 2, 1500000, 1, "2021-05-01", "A"],
    ];
    const picked = pickComparables(rows, home, 2);
    assert.equal(picked[0].status, "sold");
    assert.equal(picked[0].house_size, 1790);
    assert.equal(picked.length, 2);
    assert.equal(picked[0].price_per_sqft, Math.round(390000 / 1790));
  });

  it("handles zips with no comps", () => {
    assert.deepEqual(pickComparables(undefined, home), []);
  });
});
