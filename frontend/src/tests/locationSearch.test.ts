import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NominatimLocationSearchProvider,
  CANONICAL_DEMO_PRESETS,
} from "../services/locationSearchProvider";

describe("Phase 3.11A: General Address Search & Geocoding Provider", () => {
  const provider = new NominatimLocationSearchProvider(1500);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles short or empty queries safely without triggering network calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const emptyResults = await provider.search("");
    expect(emptyResults).toEqual([]);

    const shortResults = await provider.search("a");
    expect(shortResults).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("performs live geocoding query and normalizes Nominatim responses", async () => {
    const mockNominatimResponse = [
      {
        place_id: 123456,
        osm_type: "way",
        osm_id: 982341201,
        lat: "17.468200",
        lon: "78.432100",
        display_name: "Lane 3, Road No. 4, Anjaneya Nagar, Moosapet, Hyderabad, Telangana, 500018, India",
        class: "highway",
        type: "residential",
        boundingbox: ["17.467", "17.469", "78.431", "78.433"],
        address: {
          road: "Lane 3",
          suburb: "Anjaneya Nagar",
          city: "Hyderabad",
          state: "Telangana",
        },
      },
      {
        place_id: 123457,
        osm_type: "node",
        osm_id: 982341202,
        lat: "17.469100",
        lon: "78.433200",
        display_name: "Moosapet Metro Station, Hyderabad, Telangana",
        class: "railway",
        type: "station",
        address: {
          suburb: "Moosapet",
          city: "Hyderabad",
          state: "Telangana",
        },
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNominatimResponse,
    } as any);

    const results = await provider.search("Lane 3 Road No 4 Anjaneya Nagar Moosapet");
    expect(results.length).toBe(2);

    const first = results[0];
    expect(first.displayName).toContain("Lane 3");
    expect(first.latitude).toBeCloseTo(17.4682, 4);
    expect(first.longitude).toBeCloseTo(78.4321, 4);
    expect(first.osmId).toBe("way/982341201");
    expect(first.shortAddress).toContain("Lane 3, Hyderabad, Telangana");
    expect(first.modelAvailable).toBe(false);
    expect(first.attribution).toBe("© OpenStreetMap contributors");
  });

  it("detects modelAvailable=true when geocoded location matches Surya Heights coordinates", async () => {
    const mockSuryaResponse = [
      {
        place_id: 999,
        osm_type: "way",
        osm_id: 356027047,
        lat: "17.464877",
        lon: "78.361956",
        display_name: "Surya Heights, Kondapur Main Road, Serilingampally, Hyderabad, Telangana, 500084, India",
        class: "building",
        type: "apartments",
        address: {
          building: "Surya Heights",
          road: "Kondapur Main Road",
          city: "Hyderabad",
          state: "Telangana",
        },
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuryaResponse,
    } as any);

    const results = await provider.search("Surya Heights Kondapur");
    expect(results.length).toBe(1);
    expect(results[0].modelAvailable).toBe(true);
    expect(results[0].buildingCode).toBe("APARTMENT-SURYA-OSM");
    expect(results[0].parcelId).toBe("36A1B2C3D4E5F9");
  });

  it("throws descriptive error when geocoding server returns HTTP failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as any);

    await expect(provider.search("Banjara Hills Hyderabad")).rejects.toThrow(
      "Geocoding server responded with status: 503"
    );
  });

  it("verifies canonical demo presets are available for quick access", () => {
    expect(CANONICAL_DEMO_PRESETS.length).toBe(5);
    const surya = CANONICAL_DEMO_PRESETS.find((p) => p.id === "preset-surya-heights");
    expect(surya?.modelAvailable).toBe(true);

    const moosapet = CANONICAL_DEMO_PRESETS.find((p) => p.id === "preset-moosapet");
    expect(moosapet?.modelAvailable).toBe(false);
  });
});
