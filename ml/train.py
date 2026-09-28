"""Train the Real Estate Analyzer price model and export it for the Node API.

Usage:
    python ml/train.py [--data ml/data/realtor-data.zip.csv]

Outputs (all consumed by server/):
    server/model/model.json.gz   gradient-boosted trees + location encodings + intervals
    server/model/comps.json.gz   a sample of real sales per zip code for comparables
    server/model/metrics.json    held-out test metrics (also copied to src/data/)

The dataset is the Kaggle "USA Real Estate Dataset" (ahmedshahriarsakib). Download it with:
    curl -L -o ml/data/realtor.zip \
        https://www.kaggle.com/api/v1/datasets/download/ahmedshahriarsakib/usa-real-estate-dataset
"""

from __future__ import annotations

import argparse
import gzip
import json
import sys
import time
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold, GroupShuffleSplit

ROOT = Path(__file__).resolve().parent.parent
SEED = 42

# Additive smoothing strength: a zip with n sales gets weight n / (n + SMOOTHING)
# on its own median and the rest on its parent (city -> state -> national).
SMOOTHING = 10

# Prediction interval: central 80% of held-out log-residuals.
INTERVAL_LOW_Q, INTERVAL_HIGH_Q = 0.10, 0.90

# Buckets of "how many training sales exist in this zip" used to widen intervals
# where the model has seen little local data.
SUPPORT_BUCKETS = [0, 5, 25, 100, 10**9]

FEATURES = [
    "bed",
    "bath",
    "log_house_size",
    "log1p_acre_lot",
    "loc_lppsf",
    "loc_lprice",
    "log1p_zip_n",
    "state_lppsf",
]
MIN_COMP_SALES = 3
COMPS_PER_ZIP = 12


# --------------------------------------------------------------------------- data


def load_and_clean(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype={"zip_code": str})
    n0 = len(df)

    # Homes only: land listings / new construction have no living area.
    df = df[df["status"].isin(["for_sale", "sold"])]
    df = df.dropna(subset=["price", "bed", "bath", "house_size", "zip_code", "state", "city"])

    # Remove implausible values (data-entry errors dominate the extremes).
    df = df[
        df["price"].between(20_000, 60_000_000)
        & df["bed"].between(1, 12)
        & df["bath"].between(1, 12)
        & df["house_size"].between(300, 15_000)
        & (df["acre_lot"].isna() | df["acre_lot"].between(0, 200))
    ]
    ppsf = df["price"] / df["house_size"]
    # Above ~$8k/ft² rows are mostly typos or commercial; below that, luxury
    # markets (Aspen, Manhattan, Malibu) are real and must stay in.
    df = df[ppsf.between(15, 8_000)]

    df = df.drop_duplicates(subset=["street", "zip_code", "price", "house_size"])
    df["zip_code"] = df["zip_code"].str.zfill(5)
    df["city"] = df["city"].str.strip()
    df["state"] = df["state"].str.strip()
    # Rows without a street id can't be grouped; give each its own group.
    df["group"] = df["street"].fillna(-pd.Series(range(len(df)), index=df.index).astype(float))

    df["log_price"] = np.log(df["price"])
    df["lppsf"] = df["log_price"] - np.log(df["house_size"])
    df["log_house_size"] = np.log(df["house_size"])
    df["log1p_acre_lot"] = np.log1p(df["acre_lot"])  # NaN stays NaN; the trees route it
    df["city_key"] = df["city"].str.lower() + "|" + df["state"].str.lower()
    df["state_key"] = df["state"].str.lower()

    print(f"cleaned: {n0:,} -> {len(df):,} rows")
    return df.reset_index(drop=True)


# ------------------------------------------------------------- location encoding


def _level_stats(df: pd.DataFrame, key: str) -> pd.DataFrame:
    return df.groupby(key).agg(n=("lppsf", "size"), lppsf=("lppsf", "median"), lprice=("log_price", "median"))


def fit_location_tables(df: pd.DataFrame) -> dict:
    """Hierarchically smoothed medians: zip -> city -> state -> national."""
    glob = {"lppsf": float(df["lppsf"].median()), "lprice": float(df["log_price"].median())}

    def smooth(stats: pd.DataFrame, parent_lppsf: pd.Series, parent_lprice: pd.Series) -> pd.DataFrame:
        w = stats["n"] / (stats["n"] + SMOOTHING)
        out = stats.copy()
        out["lppsf"] = w * stats["lppsf"] + (1 - w) * parent_lppsf
        out["lprice"] = w * stats["lprice"] + (1 - w) * parent_lprice
        return out

    st = _level_stats(df, "state_key")
    st = smooth(st, glob["lppsf"], glob["lprice"])

    ct = _level_stats(df, "city_key")
    ct_state = ct.index.str.split("|").str[1]
    ct = smooth(ct, st["lppsf"].reindex(ct_state).fillna(glob["lppsf"]).values,
                st["lprice"].reindex(ct_state).fillna(glob["lprice"]).values)

    # A zip belongs to its most common city in the data.
    zip_city = df.groupby("zip_code")["city_key"].agg(lambda s: s.value_counts().index[0])
    zp = _level_stats(df, "zip_code")
    parent = zip_city.reindex(zp.index)
    zp = smooth(zp, ct["lppsf"].reindex(parent).values, ct["lprice"].reindex(parent).values)

    return {"global": glob, "state": st, "city": ct, "zip": zp}


def encode_location(df: pd.DataFrame, tables: dict) -> pd.DataFrame:
    """Most specific level available wins: zip, else city, else state, else national."""
    g = tables["global"]
    out = pd.DataFrame(index=df.index)
    st_lppsf = df["state_key"].map(tables["state"]["lppsf"])
    st_lprice = df["state_key"].map(tables["state"]["lprice"])
    ct_lppsf = df["city_key"].map(tables["city"]["lppsf"]).fillna(st_lppsf)
    ct_lprice = df["city_key"].map(tables["city"]["lprice"]).fillna(st_lprice)
    out["loc_lppsf"] = df["zip_code"].map(tables["zip"]["lppsf"]).fillna(ct_lppsf).fillna(g["lppsf"])
    out["loc_lprice"] = df["zip_code"].map(tables["zip"]["lprice"]).fillna(ct_lprice).fillna(g["lprice"])
    out["zip_n"] = df["zip_code"].map(tables["zip"]["n"]).fillna(0)
    out["log1p_zip_n"] = np.log1p(out["zip_n"])
    out["state_lppsf"] = st_lppsf.fillna(g["lppsf"])
    return out


def out_of_fold_encoding(train: pd.DataFrame, folds: int = 5) -> pd.DataFrame:
    """Encode each training row with tables that never saw that row (no target leakage)."""
    parts = []
    for fit_idx, enc_idx in GroupKFold(n_splits=folds).split(train, groups=train["group"]):
        tables = fit_location_tables(train.iloc[fit_idx])
        parts.append(encode_location(train.iloc[enc_idx], tables))
    return pd.concat(parts).loc[train.index]


# ----------------------------------------------------------------------- metrics


def summarize(y_true_log: np.ndarray, y_pred_log: np.ndarray) -> dict:
    ape = np.abs(np.exp(y_pred_log) / np.exp(y_true_log) - 1)
    ss_res = np.sum((y_true_log - y_pred_log) ** 2)
    ss_tot = np.sum((y_true_log - y_true_log.mean()) ** 2)
    return {
        "median_abs_pct_error": round(float(np.median(ape)) * 100, 1),
        "mean_abs_pct_error": round(float(np.mean(ape)) * 100, 1),
        "within_10_pct": round(float(np.mean(ape <= 0.10)) * 100, 1),
        "within_20_pct": round(float(np.mean(ape <= 0.20)) * 100, 1),
        "r2_log_price": round(float(1 - ss_res / ss_tot), 3),
    }


def support_bucket(zip_n: np.ndarray) -> np.ndarray:
    return np.digitize(zip_n, SUPPORT_BUCKETS[1:-1], right=False)


# ------------------------------------------------------------------------ export


def export_trees(model: HistGradientBoostingRegressor) -> dict:
    trees = []
    for (pred,) in model._predictors:
        n = pred.nodes
        if n["is_categorical"].any():
            raise RuntimeError("categorical splits are not supported by the JS evaluator")
        trees.append(
            {
                "f": np.where(n["is_leaf"], -1, n["feature_idx"]).astype(int).tolist(),
                # +/-inf thresholds (missing-vs-present splits) aren't valid JSON;
                # the largest finite double gives identical `<=` results.
                "t": np.clip(n["num_threshold"], -sys.float_info.max, sys.float_info.max).tolist(),
                "l": n["left"].astype(int).tolist(),
                "r": n["right"].astype(int).tolist(),
                "m": n["missing_go_to_left"].astype(int).tolist(),
                "v": [round(float(x), 7) for x in n["value"]],
            }
        )
    return {"baseline": float(np.ravel(model._baseline_prediction)[0]), "trees": trees}


def eval_exported(trees: dict, X: np.ndarray) -> np.ndarray:
    """Pure-Python mirror of server/src/model.js, used to prove the export is faithful."""
    out = np.full(len(X), trees["baseline"])
    for i, x in enumerate(X):
        s = 0.0
        for t in trees["trees"]:
            node = 0
            while t["f"][node] != -1:
                val = x[t["f"][node]]
                go_left = t["m"][node] == 1 if np.isnan(val) else val <= t["t"][node]
                node = t["l"][node] if go_left else t["r"][node]
            s += t["v"][node]
        out[i] += s
    return out


def table_to_json(tbl: pd.DataFrame) -> dict:
    return {
        str(k): [round(float(r.lppsf), 5), round(float(r.lprice), 5), int(r.n)]
        for k, r in tbl.iterrows()
    }


def build_comps(df: pd.DataFrame) -> dict:
    """Per zip, a size-spread sample of real homes (sold first, then listings)."""
    df = df.assign(sold=(df["status"] == "sold").astype(int))
    comps = {}
    for zip_code, g in df.groupby("zip_code"):
        if len(g) < MIN_COMP_SALES:
            continue
        g = g.sort_values(["sold", "prev_sold_date"], ascending=[False, False]).head(COMPS_PER_ZIP * 4)
        g = g.sort_values("house_size")
        idx = np.unique(np.linspace(0, len(g) - 1, min(COMPS_PER_ZIP, len(g))).round().astype(int))
        comps[zip_code] = [
            [
                int(r.bed),
                float(r.bath),
                int(r.house_size),
                None if pd.isna(r.acre_lot) else round(float(r.acre_lot), 3),
                int(r.price),
                int(r.sold),
                None if pd.isna(r.prev_sold_date) else str(r.prev_sold_date)[:10],
                r.city,
            ]
            for r in g.iloc[idx].itertuples()
        ]
    return comps


# -------------------------------------------------------------------------- main


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=ROOT / "ml" / "data" / "realtor-data.zip.csv")
    args = ap.parse_args()
    t0 = time.time()

    df = load_and_clean(args.data)

    # Split by property so a home's listing and its sale never straddle train/test.
    outer = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
    train_idx, hold_idx = next(outer.split(df, groups=df["group"]))
    train, hold = df.iloc[train_idx], df.iloc[hold_idx]
    inner = GroupShuffleSplit(n_splits=1, test_size=0.5, random_state=SEED)
    cal_idx, test_idx = next(inner.split(hold, groups=hold["group"]))
    calib, test = hold.iloc[cal_idx], hold.iloc[test_idx]
    print(f"train {len(train):,}  calibration {len(calib):,}  test {len(test):,}")

    tables = fit_location_tables(train)
    X_train = pd.concat([train[["bed", "bath", "log_house_size", "log1p_acre_lot"]], out_of_fold_encoding(train)], axis=1)[FEATURES]

    def features(part: pd.DataFrame) -> pd.DataFrame:
        return pd.concat([part[["bed", "bath", "log_house_size", "log1p_acre_lot"]], encode_location(part, tables)], axis=1)

    model = HistGradientBoostingRegressor(
        loss="squared_error",
        learning_rate=0.08,
        max_iter=1500,
        max_leaf_nodes=63,
        min_samples_leaf=40,
        l2_regularization=1.0,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=30,
        random_state=SEED,
    )
    model.fit(X_train.values, train["log_price"].values)
    print(f"trained {model.n_iter_} trees in {time.time() - t0:.0f}s")

    # Interval calibration on a split the model never saw.
    Xc = features(calib)
    resid_c = calib["log_price"].values - model.predict(Xc[FEATURES].values)
    bucket_c = support_bucket(Xc["zip_n"].values)
    intervals = []
    for b in range(len(SUPPORT_BUCKETS) - 1):
        r = resid_c[bucket_c == b]
        if len(r) < 200:  # too few to trust; fall back to all residuals
            r = resid_c
        intervals.append(
            {
                "min_zip_sales": SUPPORT_BUCKETS[b],
                "low": round(float(np.quantile(r, INTERVAL_LOW_Q)), 5),
                "high": round(float(np.quantile(r, INTERVAL_HIGH_Q)), 5),
            }
        )

    # Final, untouched test set.
    Xt = features(test)
    pred_t = model.predict(Xt[FEATURES].values)
    y_t = test["log_price"].values
    metrics = {"model": summarize(y_t, pred_t)}

    b_t = support_bucket(Xt["zip_n"].values)
    lo = np.array([intervals[b]["low"] for b in b_t])
    hi = np.array([intervals[b]["high"] for b in b_t])
    resid_t = y_t - pred_t
    metrics["interval"] = {
        "nominal_coverage_pct": round((INTERVAL_HIGH_Q - INTERVAL_LOW_Q) * 100),
        "test_coverage_pct": round(float(np.mean((resid_t >= lo) & (resid_t <= hi))) * 100, 1),
    }

    # Baselines, so the numbers above mean something.
    old_mock = np.log(test["house_size"] * 350 + test["bed"] * 25_000 + test["bath"] * 15_000)
    zip_ppsf = Xt["loc_lppsf"].values + test["log_house_size"].values
    metrics["baselines"] = {
        "previous_mock_formula": summarize(y_t, old_mock.values),
        "zip_median_price_per_sqft": summarize(y_t, zip_ppsf),
    }
    metrics["data"] = {
        "source": "Kaggle: ahmedshahriarsakib/usa-real-estate-dataset",
        "rows_used": int(len(df)),
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "zip_codes": int(df["zip_code"].nunique()),
        "states": int(df["state"].nunique()),
    }
    metrics["trained_on"] = date.today().isoformat()
    metrics["n_trees"] = int(model.n_iter_)
    print(json.dumps(metrics, indent=2))

    # Export + verify the exported trees reproduce sklearn exactly.
    exported = export_trees(model)
    sample = Xt[FEATURES].values[:300]
    diff = np.max(np.abs(eval_exported(exported, sample) - model.predict(sample)))
    print(f"export check: max |diff| = {diff:.2e}")
    assert diff < 1e-4, "exported trees disagree with sklearn"

    # Tables for serving are refit on train+calibration so more zips are covered.
    serve_tables = fit_location_tables(pd.concat([train, calib]))
    artifact = {
        "version": metrics["trained_on"],
        "features": FEATURES,
        "smoothing": SMOOTHING,
        "location": {
            "global": serve_tables["global"],
            "state": table_to_json(serve_tables["state"]),
            "city": table_to_json(serve_tables["city"]),
            "zip": table_to_json(serve_tables["zip"]),
        },
        "intervals": intervals,
        "interval_coverage": metrics["interval"]["nominal_coverage_pct"],
        "golden": {  # used by the server's tests to check the JS evaluator
            "X": [[None if np.isnan(v) else float(v) for v in row] for row in sample[:25]],
            "y": [float(v) for v in model.predict(sample[:25])],
        },
        **exported,
    }

    out_dir = ROOT / "server" / "model"
    out_dir.mkdir(parents=True, exist_ok=True)
    with gzip.open(out_dir / "model.json.gz", "wt", encoding="utf-8") as fh:
        json.dump(artifact, fh, separators=(",", ":"))
    with gzip.open(out_dir / "comps.json.gz", "wt", encoding="utf-8") as fh:
        json.dump(build_comps(df), fh, separators=(",", ":"))
    for dest in (out_dir / "metrics.json", ROOT / "src" / "data" / "model-metrics.json"):
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(metrics, indent=2) + "\n")

    for f in sorted(out_dir.iterdir()):
        print(f"  {f.relative_to(ROOT)}  {f.stat().st_size / 1e6:.1f} MB")
    print(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
