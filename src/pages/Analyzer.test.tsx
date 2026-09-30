import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, samplePrediction } from "@/test/fixtures";
import Analyzer from "./Analyzer";

const renderAnalyzer = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/analyzer", state }]}>
      <Analyzer />
    </MemoryRouter>,
  );

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // No Maps key in tests, so the manual location fields render.
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(samplePrediction));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Analyzer", () => {
  it("asks for a location before calling the API", async () => {
    renderAnalyzer();
    fireEvent.click(screen.getByRole("button", { name: /estimate price/i }));

    expect(await screen.findByText(/zip code or state/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the estimate, range and comparables", async () => {
    renderAnalyzer();
    fireEvent.change(screen.getByLabelText(/zip code/i), { target: { value: "24060" } });
    fireEvent.click(screen.getByRole("button", { name: /estimate price/i }));

    expect(await screen.findByText(/80% likely range/i)).toBeInTheDocument();
    // The headline number counts up, so wait for it to settle.
    expect(await screen.findByText("$363,146", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/similar homes in 24060/i)).toBeInTheDocument();
    expect(screen.getByText("$250,000")).toBeInTheDocument();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ bed: 3, bath: 2, house_size: 1800, zip_code: "24060" });
  });

  it("prefills from the landing page", () => {
    renderAnalyzer({ beds: 5, sqft: 3200, query: "90265" });
    expect(screen.getByLabelText(/zip code/i)).toHaveValue("90265");
    expect(screen.getByLabelText(/living area/i)).toHaveValue(3200);
    expect(screen.getByRole("group", { name: "Bedrooms" })).toHaveTextContent("5");
  });

  it("shows server errors next to the field", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { message: "Invalid property details", errors: [{ field: "zip_code", message: "zip_code must be 5 digits" }] },
        400,
      ),
    );
    renderAnalyzer({ query: "24060" });
    fireEvent.click(screen.getByRole("button", { name: /estimate price/i }));

    expect(await screen.findByText("zip_code must be 5 digits")).toBeInTheDocument();
    expect(screen.getByText("Invalid property details")).toBeInTheDocument();
  });

  it("warns when the location fell back to state level", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...samplePrediction,
        comparables: [],
        location: { ...samplePrediction.location, matched: "state", label: "Ohio" },
      }),
    );
    renderAnalyzer({ query: "Springfield, OH" });
    fireEvent.click(screen.getByRole("button", { name: /estimate price/i }));

    expect(await screen.findByText(/uses state-level prices/i)).toBeInTheDocument();
    expect(screen.queryByText(/similar homes/i)).not.toBeInTheDocument();
  });
});
