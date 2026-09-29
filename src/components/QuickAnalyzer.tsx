import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bath, Bed, MapPin, Square } from "lucide-react";

import Stepper from "@/components/Stepper";
import { LIMITS, type AnalyzerPrefill } from "@/lib/property";

const QuickAnalyzer = () => {
  const navigate = useNavigate();
  const [beds, setBeds] = useState(3);
  const [baths, setBaths] = useState(2);
  const [sqft, setSqft] = useState(1800);
  const [zip, setZip] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const state: AnalyzerPrefill = { beds, baths, sqft, query: zip };
    navigate("/analyzer", { state });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-3xl p-6 md:p-8 shadow-soft">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Bed className="w-4 h-4" />
            Beds
          </span>
          <Stepper label="Beds" value={beds} {...LIMITS.bed} onChange={setBeds} />
        </div>

        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Bath className="w-4 h-4" />
            Baths
          </span>
          <Stepper label="Baths" value={baths} {...LIMITS.bath} onChange={setBaths} />
        </div>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="quick-sqft"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
          >
            <Square className="w-4 h-4" />
            Sq Ft
          </label>
          <input
            id="quick-sqft"
            type="number"
            inputMode="numeric"
            min={LIMITS.house_size.min}
            max={LIMITS.house_size.max}
            value={sqft}
            onChange={(e) => setSqft(Number(e.target.value))}
            className="input-calm text-center"
          />
        </div>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="quick-zip"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
          >
            <MapPin className="w-4 h-4" />
            Zip code
          </label>
          <input
            id="quick-zip"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
            placeholder="24060"
            className="input-calm text-center"
          />
        </div>
      </div>

      <div className="mt-6 md:mt-8 flex justify-center">
        <button type="submit" className="btn-primary px-10">
          Estimate Price
        </button>
      </div>
    </form>
  );
};

export default QuickAnalyzer;
