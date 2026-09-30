import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import metrics from "@/data/model-metrics.json";

const rows = [
  { name: "This model", m: metrics.model, highlight: true },
  { name: "Zip median $/ft² × size", m: metrics.baselines.zip_median_price_per_sqft },
  { name: "Previous fixed formula", m: metrics.baselines.previous_mock_formula },
];

const About = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <main className="pt-28 pb-16">
      <div className="container-calm max-w-3xl">
        <h1 className="heading-hero text-foreground mb-6">How it works</h1>
        <p className="body-large mb-12">
          Inspired by <em>The Big Short</em>: a price is only useful if you know how wrong it
          might be. This page shows exactly how the estimates are made and how accurate they are.
        </p>

        <section className="mb-12">
          <h2 className="heading-section text-foreground mb-4">The data</h2>
          <p className="body-regular mb-3">
            {metrics.data.rows_used.toLocaleString()} homes across{" "}
            {metrics.data.zip_codes.toLocaleString()} zip codes in {metrics.data.states} states
            and territories, from the{" "}
            <a
              className="text-primary underline underline-offset-4"
              href="https://www.kaggle.com/datasets/ahmedshahriarsakib/usa-real-estate-dataset"
              target="_blank"
              rel="noreferrer"
            >
              USA Real Estate Dataset
            </a>{" "}
            (Realtor.com listings and sales collected through early 2024). Land-only listings,
            duplicates and implausible values were removed before training.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="heading-section text-foreground mb-4">The model</h2>
          <ul className="space-y-3 body-regular list-disc pl-5">
            <li>
              A gradient-boosted tree ensemble ({metrics.n_trees.toLocaleString()} trees) predicts
              the logarithm of price, so it optimizes percentage error rather than dollars.
            </li>
            <li>
              Inputs: bedrooms, bathrooms, living area, lot size, and location. Location is
              represented by the typical price per square foot of the zip code, blended toward
              the city and state averages when a zip has few sales.
            </li>
            <li>
              The 80% range comes from the model's actual errors on homes it was not trained on,
              and is wider in zip codes with little data.
            </li>
            <li>
              Homes were split into training and test sets by property, so a house listed and
              later sold can't appear on both sides and inflate the score.
            </li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="heading-section text-foreground mb-4">Accuracy</h2>
          <p className="body-regular mb-6">
            Measured on {metrics.data.test_rows.toLocaleString()} held-out homes. The 80% range
            contained the true price for {metrics.interval.test_coverage_pct}% of them.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Method</th>
                  <th className="py-2 px-2 font-medium text-right">Median error</th>
                  <th className="py-2 px-2 font-medium text-right">Within 10%</th>
                  <th className="py-2 pl-2 font-medium text-right">Within 20%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ name, m, highlight }) => (
                  <tr
                    key={name}
                    className={`border-b border-border ${highlight ? "text-foreground font-medium" : "text-muted-foreground"}`}
                  >
                    <td className="py-3 pr-4">{name}</td>
                    <td className="py-3 px-2 text-right tabular-nums">{m.median_abs_pct_error}%</td>
                    <td className="py-3 px-2 text-right tabular-nums">{m.within_10_pct}%</td>
                    <td className="py-3 pl-2 text-right tabular-nums">{m.within_20_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="heading-section text-foreground mb-4">Limitations</h2>
          <ul className="space-y-3 body-regular list-disc pl-5">
            <li>
              The model doesn't know about condition, renovations, views, schools or the exact
              street, which is why individual homes can be well outside the range.
            </li>
            <li>
              Many prices are asking prices, not closing prices, and none are adjusted for market
              changes since the data was collected.
            </li>
            <li>This is an educational tool, not an appraisal.</li>
          </ul>
        </section>

        <Link to="/analyzer" className="btn-primary">
          Try the analyzer
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>
    </main>

    <Footer />
  </div>
);

export default About;
