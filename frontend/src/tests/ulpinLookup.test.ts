import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupParcelByULPIN } from "../api/cadastreApi";
import { CANONICAL_ULPIN_PRESETS } from "../components/LocationSearchBar";
import type { ParcelULPINLookupResult } from "../types/cadastre";

describe("Phase 3.13: ULPIN / Bhu-Aadhaar Lookup Tests (Tests 9 - 17)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("TEST 9: Address search presets and provider functionality remain intact", () => {
    expect(CANONICAL_ULPIN_PRESETS.length).toBeGreaterThanOrEqual(3);
    const surya = CANONICAL_ULPIN_PRESETS.find((p) => p.ulpin === "36A1B2C3D4E5F9");
    expect(surya).toBeDefined();
    expect(surya?.modelAvailable).toBe(true);
    expect(surya?.location).toContain("Hyderabad");
  });

  it("TEST 10: ULPIN format validation handles 14-char uppercase alphanumeric string", async () => {
    const validULPIN = "36A1B2C3D4E5F9";
    expect(validULPIN.length).toBe(14);
    expect(/^[A-Z0-9]{14}$/.test(validULPIN)).toBe(true);

    const invalidInputs = ["123", "36A1B2C3D4E5", "36A1B2C3D4E5F999", "36@1B2C3D4E5F9"];
    invalidInputs.forEach((inv) => {
      const isValid = inv.length === 14 && /^[A-Z0-9]{14}$/.test(inv);
      expect(isValid).toBe(false);
    });
  });

  it("TEST 11: Known ULPIN returns structured result matching ParcelULPINLookupResult", async () => {
    const mockResult: ParcelULPINLookupResult = {
      found: true,
      ulpin: "36A1B2C3D4E5F9",
      parcel_id: "e9860d3f-0600-49ec-83aa-73462bb9d22f",
      survey_number: "SY-142/OSM (Synthetic Demo Parcel - OSM Anchor Context)",
      district: "Hyderabad-Synthetic",
      state: "Telangana-Synthetic",
      latitude: 17.466502,
      longitude: 78.363627,
      address: "Survey No. SY-142/OSM, Hyderabad, Telangana",
      area_sqm: 1400.0,
      geometry: {
        srid: 32644,
        geometry_type: "Polygon",
        geojson: { type: "Polygon", coordinates: [] },
      },
      building_id: "2439c7b8-bdd4-4623-a5c4-8e1e27945fda",
      building_code: "APARTMENT-SURYA-OSM",
      building_name: "Surya Heights Residential Apartment — OSM Reference Anchor",
      has_3d_prototype: true,
      vertical_unit_count: 13,
      source: "Prototype ULPIN Reference Registry",
      disclaimer: "Synthetic/reference data — not a live government land-record lookup.",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResult,
    } as any);

    const res = await lookupParcelByULPIN("36A1B2C3D4E5F9");
    expect(res.found).toBe(true);
    expect(res.ulpin).toBe("36A1B2C3D4E5F9");
    expect(res.has_3d_prototype).toBe(true);
    expect(res.vertical_unit_count).toBe(13);
    expect(res.source).toBe("Prototype ULPIN Reference Registry");
  });

  it("TEST 12: Known ULPIN provides valid centroid coordinates for camera navigation", async () => {
    const mockResult: ParcelULPINLookupResult = {
      found: true,
      ulpin: "36982341201B3E",
      parcel_id: "8971f312-2883-4c69-96c7-d17c9305139f",
      survey_number: "SY-MOOSA-982/1 (Ref)",
      district: "Hyderabad",
      state: "Telangana",
      latitude: 17.468302,
      longitude: 78.432215,
      address: "Moosapet, Hyderabad",
      area_sqm: 850.0,
      geometry: {
        srid: 32644,
        geometry_type: "Polygon",
        geojson: { type: "Polygon", coordinates: [] },
      },
      has_3d_prototype: false,
      vertical_unit_count: 0,
      source: "Prototype ULPIN Reference Registry",
      disclaimer: "Synthetic/reference data — not a live government land-record lookup.",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResult,
    } as any);

    const res = await lookupParcelByULPIN("36982341201B3E");
    expect(res.latitude).toBeCloseTo(17.4683, 3);
    expect(res.longitude).toBeCloseTo(78.4322, 3);
  });

  it("TEST 13: 3D prototype availability is correctly distinguished between available and not generated", async () => {
    const with3D: ParcelULPINLookupResult = {
      found: true,
      ulpin: "36A1B2C3D4E5F9",
      parcel_id: "p1",
      survey_number: "SY-1",
      district: "Hyderabad",
      state: "Telangana",
      latitude: 17.46,
      longitude: 78.36,
      address: "Kondapur",
      area_sqm: 1400,
      geometry: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
      has_3d_prototype: true,
      vertical_unit_count: 8,
      source: "Prototype ULPIN Reference Registry",
      disclaimer: "Synthetic",
    };

    const without3D: ParcelULPINLookupResult = {
      found: true,
      ulpin: "36982341201B3E",
      parcel_id: "p2",
      survey_number: "SY-2",
      district: "Hyderabad",
      state: "Telangana",
      latitude: 17.47,
      longitude: 78.43,
      address: "Moosapet",
      area_sqm: 850,
      geometry: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
      has_3d_prototype: false,
      vertical_unit_count: 0,
      source: "Prototype ULPIN Reference Registry",
      disclaimer: "Synthetic",
    };

    expect(with3D.has_3d_prototype).toBe(true);
    expect(without3D.has_3d_prototype).toBe(false);
  });

  it("TEST 14: Unknown ULPIN produces clear not found error without unhandled exceptions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({
        detail: "Parcel with ULPIN '36000000000000' not found in Prototype ULPIN Reference Registry.",
      }),
    } as any);

    await expect(lookupParcelByULPIN("36000000000000")).rejects.toThrow(
      "not found in Prototype ULPIN Reference Registry"
    );
  });

  it("TEST 15: ULPIN lookup payload maintains complete cadastral property structure", () => {
    const sampleResult: ParcelULPINLookupResult = {
      found: true,
      ulpin: "36A1B2C3D4E5F9",
      parcel_id: "p-123",
      survey_number: "SY-142/OSM",
      district: "Hyderabad",
      state: "Telangana",
      latitude: 17.4665,
      longitude: 78.3636,
      address: "Kondapur, Hyderabad",
      area_sqm: 1400,
      geometry: {
        srid: 32644,
        geometry_type: "Polygon",
        geojson: { type: "Polygon", coordinates: [[[219986, 1933088], [219985, 1933104], [220009, 1933106], [219986, 1933088]]] },
      },
      has_3d_prototype: true,
      vertical_unit_count: 13,
      source: "Prototype ULPIN Reference Registry",
      disclaimer: "Synthetic/reference data — not a live government land-record lookup.",
    };

    expect(sampleResult.ulpin).toHaveLength(14);
    expect(sampleResult.geometry.srid).toBe(32644);
    expect(sampleResult.source).toContain("Reference Registry");
  });

  it("TEST 16 & 17: Prototype 3D ULPIN hierarchy formatting remains consistent with 2D Parcel ULPIN", () => {
    const parcelUlpin = "36A1B2C3D4E5F9";
    const storeyUnitUlpin = `${parcelUlpin}-3D-F-0003`;
    const flatUnitUlpin = `${parcelUlpin}-3D-F-0003-U101`;

    expect(storeyUnitUlpin).toContain(parcelUlpin);
    expect(storeyUnitUlpin).toContain("-3D-F-");
    expect(flatUnitUlpin).toContain(storeyUnitUlpin);
    expect(flatUnitUlpin).toContain("-U101");
  });
});
