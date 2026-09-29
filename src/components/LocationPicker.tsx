import { useRef, useState } from "react";
import { GoogleMap, Marker, StandaloneSearchBox, useJsApiLoader } from "@react-google-maps/api";
import { MapPin } from "lucide-react";

import type { FormErrors, PropertyForm } from "@/lib/property";

type LocationFields = Pick<PropertyForm, "city" | "state" | "zip">;

interface LocationPickerProps {
  value: LocationFields;
  errors: FormErrors;
  onChange: (value: Partial<LocationFields>) => void;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
// Must be a stable reference or the loader reloads the script on every render.
const LIBRARIES: "places"[] = ["places"];

const fieldClass = (error?: string) =>
  `input-calm ${error ? "border-destructive focus:ring-destructive/20" : ""}`;

const ManualFields = ({ value, errors, onChange }: LocationPickerProps) => (
  <div className="grid grid-cols-2 gap-3">
    <div>
      <label htmlFor="zip" className="text-xs text-muted-foreground mb-1 block">
        Zip code
      </label>
      <input
        id="zip"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={5}
        value={value.zip}
        onChange={(e) => onChange({ zip: e.target.value.replace(/\D/g, "") })}
        className={fieldClass(errors.zip)}
        placeholder="24060"
        aria-invalid={!!errors.zip}
        aria-describedby={errors.zip ? "location-error" : undefined}
      />
    </div>
    <div>
      <label htmlFor="state" className="text-xs text-muted-foreground mb-1 block">
        State
      </label>
      <input
        id="state"
        autoComplete="address-level1"
        value={value.state}
        onChange={(e) => onChange({ state: e.target.value })}
        className="input-calm"
        placeholder="VA"
      />
    </div>
    <div className="col-span-2">
      <label htmlFor="city" className="text-xs text-muted-foreground mb-1 block">
        City
      </label>
      <input
        id="city"
        autoComplete="address-level2"
        value={value.city}
        onChange={(e) => onChange({ city: e.target.value })}
        className="input-calm"
        placeholder="Blacksburg"
      />
    </div>
    {errors.zip && (
      <p id="location-error" className="col-span-2 text-xs text-destructive" role="alert">
        {errors.zip}
      </p>
    )}
  </div>
);

const GooglePlaces = (props: LocationPickerProps & { apiKey: string }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: props.apiKey,
    libraries: LIBRARIES,
  });
  const searchBox = useRef<google.maps.places.SearchBox | null>(null);
  const [center, setCenter] = useState<google.maps.LatLngLiteral | null>(null);

  const handlePlacesChanged = () => {
    const place = searchBox.current?.getPlaces()?.[0];
    if (!place) return;

    const next: Partial<LocationFields> = { city: "", state: "", zip: "" };
    for (const c of place.address_components ?? []) {
      if (c.types.includes("locality") || (!next.city && c.types.includes("sublocality"))) {
        next.city = c.long_name;
      }
      if (c.types.includes("administrative_area_level_1")) next.state = c.long_name;
      if (c.types.includes("postal_code")) next.zip = c.long_name;
    }
    props.onChange(next);

    const loc = place.geometry?.location;
    if (loc) setCenter({ lat: loc.lat(), lng: loc.lng() });
  };

  if (loadError || !isLoaded) {
    return (
      <>
        {loadError && (
          <p className="text-xs text-muted-foreground mb-3">
            Address search is unavailable; enter the location below.
          </p>
        )}
        <ManualFields {...props} />
      </>
    );
  }

  return (
    <div className="space-y-3">
      <StandaloneSearchBox
        onLoad={(ref) => (searchBox.current = ref)}
        onPlacesChanged={handlePlacesChanged}
      >
        <input
          type="text"
          className="input-calm"
          placeholder="Search an address, city or zip…"
          aria-label="Search for an address"
        />
      </StandaloneSearchBox>
      <ManualFields {...props} />
      {center && (
        <div className="h-48 w-full rounded-2xl overflow-hidden">
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={center}
            zoom={14}
            options={{
              fullscreenControl: false,
              mapTypeControl: false,
              streetViewControl: false,
            }}
          >
            <Marker position={center} />
          </GoogleMap>
        </div>
      )}
    </div>
  );
};

const LocationPicker = (props: LocationPickerProps) => (
  <div>
    <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
      <MapPin className="w-4 h-4" />
      Location
    </span>
    {GOOGLE_MAPS_API_KEY ? (
      <GooglePlaces {...props} apiKey={GOOGLE_MAPS_API_KEY} />
    ) : (
      <ManualFields {...props} />
    )}
  </div>
);

export default LocationPicker;
