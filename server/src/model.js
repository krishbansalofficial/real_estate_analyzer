import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { normalizeState } from "./states.js";

export const loadJsonGz = (path) =>
  JSON.parse(gunzipSync(readFileSync(path)).toString("utf8"));

/**
 * Evaluate the exported HistGradientBoostingRegressor.
 * Mirrors sklearn: NaN follows the node's learned missing direction,
 * otherwise x <= threshold goes left.
 */
export const evalTrees = (model, x) => {
  let sum = model.baseline;
  for (const tree of model.trees) {
    let node = 0;
    while (tree.f[node] !== -1) {
      const value = x[tree.f[node]];
      const goLeft = Number.isNaN(value)
        ? tree.m[node] === 1
        : value <= tree.t[node];
      node = goLeft ? tree.l[node] : tree.r[node];
    }
    sum += tree.v[node];
  }
  return sum;
};

/** Most specific location level wins: zip, then city, then state, then national. */
export const encodeLocation = (location, { zip_code, city, state }) => {
  const stateName = normalizeState(state);
  const stateKey = stateName?.toLowerCase();
  const cityKey =
    city && stateKey ? `${city.trim().toLowerCase()}|${stateKey}` : undefined;

  const zipRow = zip_code ? location.zip[zip_code] : undefined;
  const cityRow = cityKey ? location.city[cityKey] : undefined;
  const stateRow = stateKey ? location.state[stateKey] : undefined;

  const [row, matched, label] = zipRow
    ? [zipRow, "zip", zip_code]
    : cityRow
      ? [cityRow, "city", `${city.trim()}, ${stateName}`]
      : stateRow
        ? [stateRow, "state", stateName]
        : [
            [location.global.lppsf, location.global.lprice, 0],
            "national",
            "United States",
          ];

  return {
    lppsf: row[0],
    lprice: row[1],
    zipSales: zipRow ? zipRow[2] : 0,
    salesInArea: row[2],
    stateLppsf: stateRow ? stateRow[0] : location.global.lppsf,
    matched,
    label,
  };
};

const COMP_FIELDS = [
  "bed",
  "bath",
  "house_size",
  "acre_lot",
  "price",
  "sold",
  "sold_date",
  "city",
];

/** Pick the homes in the zip most similar to the subject property. */
export const pickComparables = (rows, input, count = 3) => {
  if (!rows) return [];
  const distance = (c) =>
    4 * Math.abs(Math.log(c.house_size / input.house_size)) +
    0.5 * Math.abs(c.bed - input.bed) +
    0.5 * Math.abs(c.bath - input.bath) +
    (c.sold ? 0 : 0.3); // prefer closed sales over asking prices

  return rows
    .map((r) => Object.fromEntries(COMP_FIELDS.map((k, i) => [k, r[i]])))
    .map((c) => ({ ...c, d: distance(c) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map(({ d: _d, sold, ...c }) => ({
      ...c,
      status: sold ? "sold" : "listed",
      price_per_sqft: Math.round(c.price / c.house_size),
    }));
};

export const createPredictor = (model, comps) => {
  const intervalFor = (zipSales) =>
    model.intervals.reduce(
      (found, b) => (zipSales >= b.min_zip_sales ? b : found),
      model.intervals[0],
    );

  return {
    version: model.version,

    predict(input) {
      const loc = encodeLocation(model.location, input);
      // Order must match FEATURES in ml/train.py.
      const x = [
        input.bed,
        input.bath,
        Math.log(input.house_size),
        input.acre_lot == null ? NaN : Math.log1p(input.acre_lot),
        loc.lppsf,
        loc.lprice,
        Math.log1p(loc.zipSales),
        loc.stateLppsf,
      ];
      const logPrice = evalTrees(model, x);
      const band = intervalFor(loc.zipSales);
      const estimate = Math.exp(logPrice);

      return {
        estimate: Math.round(estimate),
        low: Math.round(Math.exp(logPrice + band.low)),
        high: Math.round(Math.exp(logPrice + band.high)),
        interval_coverage: model.interval_coverage,
        price_per_sqft: Math.round(estimate / input.house_size),
        location: {
          matched: loc.matched,
          label: loc.label,
          sales_in_data: loc.salesInArea,
          median_price_per_sqft: Math.round(Math.exp(loc.lppsf)),
          median_price: Math.round(Math.exp(loc.lprice)),
        },
        comparables:
          loc.matched === "zip"
            ? pickComparables(comps[input.zip_code], input)
            : [],
        model_version: model.version,
      };
    },
  };
};
