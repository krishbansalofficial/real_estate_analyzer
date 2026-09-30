import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, samplePrediction } from "@/test/fixtures";
import { ApiError, predictPrice } from "./api";

const input = { bed: 3, bath: 2, house_size: 1800, acre_lot: 0.25, zip_code: "24060" };

afterEach(() => vi.unstubAllGlobals());

describe("predictPrice", () => {
  it("posts the property and returns the prediction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(samplePrediction));
    vi.stubGlobal("fetch", fetchMock);

    await expect(predictPrice(input)).resolves.toEqual(samplePrediction);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/predict");
    expect(JSON.parse(init.body)).toEqual(input);
  });

  it("surfaces field-level validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { message: "Invalid property details", errors: [{ field: "house_size", message: "too small" }] },
          400,
        ),
      ),
    );

    const err = await predictPrice(input).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.fieldErrors).toEqual({ house_size: "too small" });
  });

  it("explains rate limiting", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 429)));
    await expect(predictPrice(input)).rejects.toThrow(/Too many requests/);
  });

  it("reports an unreachable API clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(predictPrice(input)).rejects.toThrow(/Can't reach the prediction service/);
  });
});
