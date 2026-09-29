export interface PropertyInput {
  bed: number;
  bath: number;
  house_size: number;
  acre_lot: number | null;
  zip_code?: string;
  city?: string;
  state?: string;
}

export interface Comparable {
  bed: number;
  bath: number;
  house_size: number;
  acre_lot: number | null;
  price: number;
  price_per_sqft: number;
  status: "sold" | "listed";
  sold_date: string | null;
  city: string;
}

export type LocationMatch = "zip" | "city" | "state" | "national";

export interface Prediction {
  estimate: number;
  low: number;
  high: number;
  interval_coverage: number;
  price_per_sqft: number;
  location: {
    matched: LocationMatch;
    label: string;
    sales_in_data: number;
    median_price_per_sqft: number;
    median_price: number;
  };
  comparables: Comparable[];
  model_version: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

// Empty in development: Vite proxies /api to the local server.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export const predictPrice = async (
  input: PropertyInput,
  signal?: AbortSignal,
): Promise<Prediction> => {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("Can't reach the prediction service. Is the API running?", 0);
  }

  if (res.ok) return res.json();

  const body = await res.json().catch(() => ({}));
  const fieldErrors = Object.fromEntries(
    (body.errors ?? []).map((e: { field: string; message: string }) => [e.field, e.message]),
  );
  const message =
    res.status === 429
      ? "Too many requests. Please wait a minute and try again."
      : (body.message ?? `Prediction failed (${res.status})`);
  throw new ApiError(message, res.status, fieldErrors);
};
