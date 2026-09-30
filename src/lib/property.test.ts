import { describe, expect, it } from "vitest";

import {
  DEFAULT_FORM,
  fromServerErrors,
  initialForm,
  toPropertyInput,
  validateProperty,
} from "./property";

describe("validateProperty", () => {
  const withZip = { ...DEFAULT_FORM, zip: "24060" };

  it("accepts a normal home", () => {
    expect(validateProperty(withZip)).toEqual({});
  });

  it("requires a zip code or state", () => {
    expect(validateProperty(DEFAULT_FORM).zip).toMatch(/zip code or state/);
    expect(validateProperty({ ...DEFAULT_FORM, state: "VA" })).toEqual({});
  });

  it("rejects living area outside the training range, including blank", () => {
    expect(validateProperty({ ...withZip, sqft: 100 }).sqft).toBeDefined();
    expect(validateProperty({ ...withZip, sqft: 20_000 }).sqft).toBeDefined();
    expect(validateProperty({ ...withZip, sqft: NaN }).sqft).toBeDefined();
  });

  it("allows a blank lot but not a negative one", () => {
    expect(validateProperty({ ...withZip, lot: null })).toEqual({});
    expect(validateProperty({ ...withZip, lot: -1 }).lot).toBeDefined();
  });

  it("rejects malformed zip codes", () => {
    expect(validateProperty({ ...withZip, zip: "2406" }).zip).toMatch(/5 digits/);
  });
});

describe("initialForm", () => {
  it("reads a bare zip from the search query", () => {
    expect(initialForm({ query: " 24060 " })).toMatchObject({ zip: "24060", city: "" });
  });

  it("reads City, ST", () => {
    expect(initialForm({ query: "Austin, TX" })).toMatchObject({ city: "Austin", state: "TX", zip: "" });
  });

  it("keeps quick-form values and defaults the rest", () => {
    expect(initialForm({ beds: 5, sqft: 3000 })).toMatchObject({ beds: 5, sqft: 3000, baths: 2 });
    expect(initialForm(null)).toEqual(DEFAULT_FORM);
  });
});

describe("toPropertyInput", () => {
  it("maps form fields to API fields and drops blanks", () => {
    expect(toPropertyInput({ ...DEFAULT_FORM, zip: " 24060 ", lot: null })).toEqual({
      bed: 3,
      bath: 2,
      house_size: 1800,
      acre_lot: null,
      zip_code: "24060",
      city: undefined,
      state: undefined,
    });
  });
});

describe("fromServerErrors", () => {
  it("maps server field names onto form fields", () => {
    expect(fromServerErrors({ house_size: "too small", zip_code: "bad", other: "x" })).toEqual({
      sqft: "too small",
      zip: "bad",
    });
  });
});
