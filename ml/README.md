# Price model

`train.py` builds the model the API serves. It replaces the Azure ML model that was
planned but never connected.

## Retrain

```bash
pip install -r ml/requirements.txt
curl -L -o ml/data/realtor.zip \
  https://www.kaggle.com/api/v1/datasets/download/ahmedshahriarsakib/usa-real-estate-dataset
unzip ml/data/realtor.zip -d ml/data
python ml/train.py            # ~2-3 minutes on a laptop
```

It writes:

| File | Used by |
| --- | --- |
| `server/model/model.json.gz` | the API: trees, location tables, calibrated intervals |
| `server/model/comps.json.gz` | the API: sample of real homes per zip for comparables |
| `server/model/metrics.json` | `GET /api/model` |
| `src/data/model-metrics.json` | the frontend's accuracy figures (landing and About pages) |

Commit all four together so the UI never shows metrics for a different model.

## How it works

1. **Cleaning.** Keeps `for_sale`/`sold` homes with beds, baths and living area, removes
   duplicates, and drops implausible values (for example under 300 ft² or over $8,000/ft²).
   Land listings are excluded because the app values homes.
2. **Split by property.** `GroupShuffleSplit` on the street id gives an 80/10/10
   train/calibration/test split. The same house often appears as both a listing and a sale,
   and a random row split would leak it across sets.
3. **Location encoding.** Each zip is represented by its median log price per ft² and median
   log price. These are shrunk toward the city, then state, then national value when the zip
   has few sales (`SMOOTHING = 10`). Training rows use out-of-fold encodings so a home never
   sees its own price.
4. **Model.** `HistGradientBoostingRegressor` on `log(price)`, so it minimizes percentage
   error rather than dollar error.
5. **Intervals.** The 10th and 90th percentiles of calibration-set residuals, computed
   separately by how many sales the zip has. That is why the range is wider in thin markets.
   The test set checks that about 80% of true prices land inside.
6. **Export.** The trees are exported as flat arrays and evaluated in plain JavaScript
   (`server/src/model.js`), so the API needs no Python at runtime. The script checks that the
   export matches sklearn, and the server tests check again against golden rows.

## Current results

See `server/model/metrics.json`. It includes two baselines: the fixed formula the app used
before, and "zip median $/ft² × size".
