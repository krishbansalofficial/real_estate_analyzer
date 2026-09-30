import { Link, useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight, ChevronDown } from "lucide-react";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import PropertyCard from "@/components/PropertyCard";
import QuickAnalyzer from "@/components/QuickAnalyzer";
import Footer from "@/components/Footer";

import heroImage from "@/assets/hero-home.jpg";
import featuredProperty from "@/assets/featured-property.jpg";
import property1 from "@/assets/property-1.jpg";
import property2 from "@/assets/property-2.jpg";
import property3 from "@/assets/property-3.jpg";
import property4 from "@/assets/property-4.jpg";

import metrics from "@/data/model-metrics.json";
import { predictPrice } from "@/lib/api";
import { formatPrice, type AnalyzerPrefill } from "@/lib/property";

// Example homes; the price on each card is the model's live estimate.
const examples = [
  { image: property1, title: "Coastal home", location: "Malibu, CA", zip: "90265", beds: 4, baths: 3, sqft: 3200, lot: 0.5 },
  { image: property2, title: "Mountain home", location: "Aspen, CO", zip: "81611", beds: 5, baths: 4, sqft: 4500, lot: 1 },
  { image: property3, title: "City townhouse", location: "Brooklyn, NY", zip: "11215", beds: 3, baths: 2, sqft: 2100, lot: null },
  { image: property4, title: "Suburban farmhouse", location: "Nashville, TN", zip: "37215", beds: 4, baths: 3, sqft: 2800, lot: 0.75 },
];

const stats = [
  { value: `${metrics.model.median_abs_pct_error}%`, label: "Median error on held-out homes" },
  { value: `${Math.round(metrics.model.within_20_pct)}%`, label: "Of estimates within 20%" },
  { value: `${(metrics.data.train_rows / 1e6).toFixed(1)}M`, label: "Homes in training data" },
  { value: metrics.data.zip_codes.toLocaleString(), label: "Zip codes covered" },
];

const Index = () => {
  const navigate = useNavigate();
  const estimates = useQueries({
    queries: examples.map((home) => ({
      queryKey: ["example-estimate", home.zip, home.beds, home.baths, home.sqft, home.lot],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        predictPrice(
          { bed: home.beds, bath: home.baths, house_size: home.sqft, acre_lot: home.lot, zip_code: home.zip },
          signal,
        ),
      staleTime: Infinity,
      retry: false,
    })),
  });

  const analyze = (prefill: AnalyzerPrefill) => navigate("/analyzer", { state: prefill });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Modern home exterior"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative container-calm pt-24">
          <div className="max-w-2xl">
            <h1 className="heading-hero text-foreground mb-6 animate-fade-up">
              Find your home's <span className="text-primary">true value</span>
            </h1>
            <p
              className="body-large mb-8 animate-fade-up"
              style={{ animationDelay: "0.1s" }}
            >
              Estimate what a home is worth from its size, rooms and zip code,
              with an honest range instead of false precision.
            </p>
            <div className="animate-fade-up" style={{ animationDelay: "0.2s" }}>
              <SearchBar
                placeholder="Enter a zip code or City, ST…"
                onSearch={(query) => analyze({ query })}
              />
            </div>
            <div
              className="flex items-center gap-6 mt-8 animate-fade-up"
              style={{ animationDelay: "0.3s" }}
            >
              <Link to="/analyzer" className="btn-primary">
                Analyze Property
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <Link to="/about" className="btn-ghost">
                How it works
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
        </div>
      </section>

      {/* Quick Analyzer Strip */}
      <section className="section-spacing bg-muted">
        <div className="container-calm">
          <div className="text-center mb-10">
            <h2 className="heading-section text-foreground mb-4">
              Quick Estimate
            </h2>
            <p className="body-large max-w-2xl mx-auto">
              A price estimate in about a second
            </p>
          </div>
          <QuickAnalyzer />
        </div>
      </section>

      {/* Popular Properties */}
      <section className="section-spacing">
        <div className="container-calm">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="heading-section text-foreground mb-2">
                Same model, different markets
              </h2>
              <p className="text-muted-foreground">
                Live estimates for example homes. Photos are illustrative.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {examples.map((home, index) => {
              const { data, isError } = estimates[index];
              const price = data
                ? `Est. ${formatPrice(data.estimate)}`
                : isError
                  ? "Estimate unavailable"
                  : "Estimating…";
              return (
                <div
                  key={home.zip}
                  className="animate-fade-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <PropertyCard
                    {...home}
                    price={price}
                    onClick={() =>
                      analyze({
                        beds: home.beds,
                        baths: home.baths,
                        sqft: home.sqft,
                        lot: home.lot,
                        query: home.zip,
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Property */}
      <section className="section-spacing bg-muted">
        <div className="container-calm">
          <div className="relative rounded-3xl overflow-hidden min-h-[500px] md:min-h-[600px]">
            <img
              src={featuredProperty}
              alt="Featured property interior"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
              <h3 className="text-3xl md:text-4xl font-serif text-card mb-3">
                Know the range before you negotiate
              </h3>
              <p className="text-card/80 mb-6 max-w-xl">
                Every estimate comes with an 80% range, the typical price per
                square foot in the area, and similar homes from the same zip
                code.
              </p>
              <Link to="/analyzer" className="btn-primary">
                Analyze a property
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="section-spacing">
        <div className="container-calm">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div>
              <h2 className="heading-section text-foreground mb-6">
                Intelligent analysis, <br />
                beautiful simplicity
              </h2>
              <p className="body-large mb-6">
                A gradient-boosted model trained on{" "}
                {metrics.data.rows_used.toLocaleString()} US listings and sales
                learns how size, rooms, lot and location drive price, and tells
                you how confident it is.
              </p>
              <div className="space-y-4">
                {[
                  "Location-aware estimates down to the zip code",
                  "Calibrated 80% price ranges",
                  "Comparable homes from the same zip code",
                  "Accuracy measured on homes the model never saw",
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-foreground">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link to="/analyzer" className="btn-primary">
                  Try the Analyzer
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="card-soft p-6 text-center">
                  <div className="text-4xl font-serif text-primary mb-2">
                    {stat.value}
                  </div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
