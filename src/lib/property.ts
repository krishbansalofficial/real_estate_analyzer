import type { PropertyInput } from "./api";

// Mirrors server/src/validation.js, which mirrors the training data's range.
export const LIMITS = {
  bed: { min: 1, max: 12 },
  bath: { min: 1, max: 12 },
  house_size: { min: 300, max: 15_000 },
  acre_lot: { min: 0, max: 200 },
} as const;

export interface PropertyForm {
  beds: number;
  baths: number;
  sqft: number;
  lot: number | null;
  city: string;
  state: string;
  zip: string;
}

export type FormErrors = Partial<Record<keyof PropertyForm, string>>;

export const DEFAULT_FORM: PropertyForm = {
  beds: 3,
  baths: 2,
  sqft: 1800,
  lot: 0.25,
  city: "",
  state: "",
  zip: "",
};

/** Router state accepted from the landing page's quick form and search bar. */
export type AnalyzerPrefill = Partial<Omit<PropertyForm, "city" | "state" | "zip">> & {
  query?: string;
};

export const initialForm = (prefill: AnalyzerPrefill | null): PropertyForm => {
  const { query, ...fields } = prefill ?? {};
  const q = query?.trim() ?? "";
  // A bare zip goes straight in; anything else is read as "City, ST".
  if (/^\d{5}$/.test(q)) return { ...DEFAULT_FORM, ...fields, zip: q };
  const [city = "", state = ""] = q.split(",").map((part) => part.trim());
  return { ...DEFAULT_FORM, ...fields, city, state };
};

const outOfRange = (v: number, { min, max }: { min: number; max: number }) =>
  !Number.isFinite(v) || v < min || v > max;

export const validateProperty = (form: PropertyForm): FormErrors => {
  const errors: FormErrors = {};
  const { house_size, acre_lot } = LIMITS;

  if (outOfRange(form.sqft, house_size)) {
    errors.sqft = `Enter ${house_size.min.toLocaleString()}–${house_size.max.toLocaleString()} sq ft`;
  }
  if (form.lot !== null && outOfRange(form.lot, acre_lot)) {
    errors.lot = `Enter 0–${acre_lot.max} acres, or leave blank`;
  }
  if (form.zip && !/^\d{5}$/.test(form.zip.trim())) {
    errors.zip = "Zip code must be 5 digits";
  }
  if (!form.zip.trim() && !form.state.trim()) {
    errors.zip = "Enter a zip code or state so the estimate reflects your market";
  }
  return errors;
};

export const toPropertyInput = (form: PropertyForm): PropertyInput => ({
  bed: form.beds,
  bath: form.baths,
  house_size: form.sqft,
  acre_lot: form.lot,
  zip_code: form.zip.trim() || undefined,
  city: form.city.trim() || undefined,
  state: form.state.trim() || undefined,
});

// Map server field names back onto form fields.
const SERVER_FIELD: Record<string, keyof PropertyForm> = {
  bed: "beds",
  bath: "baths",
  house_size: "sqft",
  acre_lot: "lot",
  zip_code: "zip",
  city: "city",
  state: "state",
};

export const fromServerErrors = (fieldErrors: Record<string, string>): FormErrors =>
  Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([k]) => k in SERVER_FIELD)
      .map(([k, v]) => [SERVER_FIELD[k], v]),
  );

export const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);

export const formatCompactPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: price >= 1_000_000 ? 2 : 0,
  }).format(price);
