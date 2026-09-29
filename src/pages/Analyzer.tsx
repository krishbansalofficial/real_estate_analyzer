import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertCircle, Bath, Bed, Home, Square, TreePine, TrendingUp } from "lucide-react";

import Footer from "@/components/Footer";
import LocationPicker from "@/components/LocationPicker";
import Navbar from "@/components/Navbar";
import PredictionResult from "@/components/PredictionResult";
import Spinner from "@/components/Spinner";
import Stepper from "@/components/Stepper";
import metrics from "@/data/model-metrics.json";
import { ApiError, predictPrice, type Prediction } from "@/lib/api";
import {
  fromServerErrors,
  initialForm,
  LIMITS,
  toPropertyInput,
  validateProperty,
  type AnalyzerPrefill,
  type FormErrors,
  type PropertyForm,
} from "@/lib/property";

const Analyzer = () => {
  const location = useLocation();
  const [form, setForm] = useState<PropertyForm>(() =>
    initialForm(location.state as AnalyzerPrefill | null),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const update = (patch: Partial<PropertyForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    // Clear errors for fields the user is fixing.
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch) as (keyof PropertyForm)[]) delete next[key];
      if ("state" in patch || "city" in patch) delete next.zip;
      return next;
    });
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateProperty(form);
    setErrors(found);
    setRequestError(null);
    if (Object.keys(found).length > 0) return;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setIsLoading(true);

    try {
      setResult(await predictPrice(toPropertyInput(form), controller.signal));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (err instanceof ApiError) {
        setErrors(fromServerErrors(err.fieldErrors));
        setRequestError(err.message);
      } else {
        setRequestError("Something went wrong. Please try again.");
      }
      setResult(null);
    } finally {
      if (inFlight.current === controller) setIsLoading(false);
    }
  };

  const numberInput = (field: "sqft" | "lot", raw: string) => {
    if (raw === "") return update({ [field]: field === "lot" ? null : NaN });
    const value = Number(raw);
    update({ [field]: value });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16">
        <div className="container-calm">
          <div className="text-center mb-12">
            <h1 className="heading-hero text-foreground mb-4">Property Analyzer</h1>
            <p className="body-large max-w-2xl mx-auto">
              Estimate a home's price from its size, rooms and location, using a model trained
              on {metrics.data.train_rows.toLocaleString()} US listings and sales.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
            <div className="lg:col-span-2">
              <form onSubmit={handlePredict} noValidate className="card-soft lg:sticky lg:top-24">
                <h2 className="heading-card text-foreground mb-6">Property Details</h2>

                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                        <Bed className="w-4 h-4" />
                        Bedrooms
                      </span>
                      <Stepper
                        label="Bedrooms"
                        value={form.beds}
                        {...LIMITS.bed}
                        onChange={(beds) => update({ beds })}
                      />
                    </div>
                    <div>
                      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                        <Bath className="w-4 h-4" />
                        Bathrooms
                      </span>
                      <Stepper
                        label="Bathrooms"
                        value={form.baths}
                        {...LIMITS.bath}
                        onChange={(baths) => update({ baths })}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="sqft"
                      className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2"
                    >
                      <Square className="w-4 h-4" />
                      Living area (sq ft)
                    </label>
                    <input
                      id="sqft"
                      type="number"
                      inputMode="numeric"
                      min={LIMITS.house_size.min}
                      max={LIMITS.house_size.max}
                      value={Number.isNaN(form.sqft) ? "" : form.sqft}
                      onChange={(e) => numberInput("sqft", e.target.value)}
                      className={`input-calm ${errors.sqft ? "border-destructive" : ""}`}
                      aria-invalid={!!errors.sqft}
                      aria-describedby={errors.sqft ? "sqft-error" : undefined}
                    />
                    {errors.sqft && (
                      <p id="sqft-error" className="text-xs text-destructive mt-1" role="alert">
                        {errors.sqft}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="lot"
                      className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2"
                    >
                      <TreePine className="w-4 h-4" />
                      Lot size (acres)
                      <span className="text-xs font-normal">optional</span>
                    </label>
                    <input
                      id="lot"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={LIMITS.acre_lot.min}
                      max={LIMITS.acre_lot.max}
                      value={form.lot ?? ""}
                      onChange={(e) => numberInput("lot", e.target.value)}
                      className={`input-calm ${errors.lot ? "border-destructive" : ""}`}
                      placeholder="Leave blank for condos"
                      aria-invalid={!!errors.lot}
                      aria-describedby={errors.lot ? "lot-error" : undefined}
                    />
                    {errors.lot && (
                      <p id="lot-error" className="text-xs text-destructive mt-1" role="alert">
                        {errors.lot}
                      </p>
                    )}
                  </div>

                  <LocationPicker
                    value={form}
                    errors={errors}
                    onChange={(patch) => update(patch)}
                  />

                  <button type="submit" disabled={isLoading} className="btn-primary w-full mt-6">
                    {isLoading ? (
                      <Spinner size="sm" className="mr-2" />
                    ) : (
                      <TrendingUp className="w-4 h-4 mr-2" />
                    )}
                    {isLoading ? "Estimating…" : "Estimate Price"}
                  </button>
                </div>
              </form>
            </div>

            <div className="lg:col-span-3">
              {requestError && (
                <div
                  className="flex gap-3 items-start rounded-2xl border border-destructive/40 bg-destructive/5 p-4 mb-6 text-sm text-destructive"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{requestError}</span>
                </div>
              )}

              {isLoading && !result && (
                <div className="card-soft text-center py-16">
                  <Spinner size="lg" className="mx-auto mb-6" />
                  <h3 className="heading-card text-foreground mb-2">Estimating</h3>
                </div>
              )}

              {!result && !isLoading && (
                <div className="card-soft text-center py-16">
                  <Home className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="heading-card text-foreground mb-2">Ready to Analyze</h3>
                  <p className="text-muted-foreground">
                    Enter the property details and a zip code to get an estimate.
                  </p>
                </div>
              )}

              {result && (
                <div className={isLoading ? "opacity-50 transition-opacity" : ""}>
                  <PredictionResult result={result} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Analyzer;
