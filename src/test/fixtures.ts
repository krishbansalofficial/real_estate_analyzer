import type { Prediction } from "@/lib/api";

export const samplePrediction: Prediction = {
  estimate: 363146,
  low: 269289,
  high: 485818,
  interval_coverage: 80,
  price_per_sqft: 202,
  location: {
    matched: "zip",
    label: "24060",
    sales_in_data: 412,
    median_price_per_sqft: 190,
    median_price: 350000,
  },
  comparables: [
    {
      bed: 3,
      bath: 2,
      house_size: 1508,
      acre_lot: 0.3,
      price: 250000,
      price_per_sqft: 166,
      status: "sold",
      sold_date: "2021-06-01",
      city: "Blacksburg",
    },
  ],
  model_version: "test",
};

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
