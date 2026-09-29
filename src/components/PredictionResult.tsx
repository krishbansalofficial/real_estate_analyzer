import { useEffect, useState } from "react";
import { AlertTriangle, Bath, Bed, Square } from "lucide-react";

import type { Comparable, Prediction } from "@/lib/api";
import { formatCompactPrice, formatPrice } from "@/lib/property";
import metrics from "@/data/model-metrics.json";

const LOCATION_NOTE: Record<string, string> = {
  city: "No zip code match, so this uses city-level prices. Add a zip code for a sharper estimate.",
  state: "No zip code or city match, so this uses state-level prices. Expect a wide range.",
  national: "No location matched, so this uses national prices. Add a zip code for a meaningful estimate.",
};

const useCountUp = (target: number, duration = 1200) => {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
};

/** Where the estimate sits between low and high, on a log scale like the interval itself. */
const RangeBar = ({ low, estimate, high }: Pick<Prediction, "low" | "estimate" | "high">) => {
  const pct = (Math.log(estimate / low) / Math.log(high / low)) * 100;
  return (
    <div className="max-w-md mx-auto mt-6" aria-hidden="true">
      <div className="relative h-2 rounded-full bg-primary/15">
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-card"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <span>{formatCompactPrice(low)}</span>
        <span>{formatCompactPrice(high)}</span>
      </div>
    </div>
  );
};

const ComparableCard = ({ comp }: { comp: Comparable }) => (
  <div className="card-soft p-5">
    <div className="flex items-baseline justify-between mb-3">
      <span className="text-xl font-serif text-foreground">{formatPrice(comp.price)}</span>
      <span
        className={`text-xs px-2 py-0.5 rounded-full ${
          comp.status === "sold" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        {comp.status === "sold" ? "Sold" : "Listed"}
      </span>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
      <span className="flex items-center gap-1">
        <Bed className="w-4 h-4" aria-label="Bedrooms" />
        {comp.bed}
      </span>
      <span className="flex items-center gap-1">
        <Bath className="w-4 h-4" aria-label="Bathrooms" />
        {comp.bath}
      </span>
      <span className="flex items-center gap-1 whitespace-nowrap">
        <Square className="w-4 h-4" aria-label="Square feet" />
        {comp.house_size.toLocaleString()} ft²
      </span>
    </div>
    <p className="text-xs text-muted-foreground mt-3">
      ${comp.price_per_sqft}/ft² · {comp.city}
      {comp.sold_date && ` · last sold ${comp.sold_date.slice(0, 4)}`}
    </p>
  </div>
);

const PredictionResult = ({ result }: { result: Prediction }) => {
  const displayPrice = useCountUp(result.estimate);
  const { location } = result;
  const vsArea = Math.round((result.price_per_sqft / location.median_price_per_sqft - 1) * 100);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="card-soft text-center py-10">
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Estimated Value
        </span>
        <div className="mt-2">
          <span className="text-5xl md:text-6xl font-serif text-primary" aria-live="polite">
            {formatPrice(displayPrice)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          {result.interval_coverage}% likely range: {formatPrice(result.low)} – {formatPrice(result.high)}
        </p>
        <RangeBar {...result} />
      </div>

      {location.matched !== "zip" && (
        <div className="flex gap-3 items-start rounded-2xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{LOCATION_NOTE[location.matched]}</span>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card-soft p-5 text-center">
          <div className="text-2xl font-serif text-foreground mb-1">${result.price_per_sqft}</div>
          <p className="text-sm text-muted-foreground">Estimated per ft²</p>
        </div>
        <div className="card-soft p-5 text-center">
          <div className="text-2xl font-serif text-foreground mb-1">
            ${location.median_price_per_sqft}
          </div>
          <p className="text-sm text-muted-foreground">
            Typical per ft² in {location.label}
          </p>
        </div>
        <div className="card-soft p-5 text-center">
          <div className="text-2xl font-serif text-foreground mb-1">
            {vsArea > 0 ? "+" : ""}
            {vsArea}%
          </div>
          <p className="text-sm text-muted-foreground">vs. area per ft²</p>
        </div>
      </div>

      {result.comparables.length > 0 && (
        <div>
          <h3 className="heading-card text-foreground mb-1">Similar homes in {location.label}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Closest matches by size, beds and baths from the training data.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {result.comparables.map((comp, i) => (
              <ComparableCard key={i} comp={comp} />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        Based on {location.sales_in_data.toLocaleString()} homes in {location.label}. On{" "}
        {metrics.data.test_rows.toLocaleString()} held-out homes, the typical estimate was within{" "}
        {metrics.model.median_abs_pct_error}% of the actual price. Prices come from listings and
        sales in the Kaggle USA Real Estate dataset (collected through early 2024), so this is not an
        appraisal or a current market value.
      </p>
    </div>
  );
};

export default PredictionResult;
