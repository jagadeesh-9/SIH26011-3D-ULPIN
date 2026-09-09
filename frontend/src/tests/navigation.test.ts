import { describe, it, expect } from "vitest";
import type { VerticalUnit, Building, Parcel } from "../types/cadastre";
import { getUnitArchitecturalColor } from "../utils/architecturalDetails";

describe("Phase 3.13: Toggle Floor & Flat Selection State Machine", () => {
  // Mock Data
  const mockBuilding: Building = {
    id: "bldg-surya",
    parcel_id: "parcel-surya",
    building_code: "APARTMENT-SURYA-001",
    building_name: "Surya Heights",
    total_floors_above: 5,
    total_floors_below: 1,
    footprint_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
    unit_count: 8,
    created_at: new Date().toISOString(),
  };

  const mockParcel: Parcel = {
    id: "parcel-surya",
    ulpin_2d: "36A1B2C3D4E5F9",
    survey_number: "SY-101",
    district: "Ranga Reddy",
    state: "Telangana",
    area_sqm: 1450.0,
    geom_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
    building_count: 1,
    vertical_unit_count: 8,
    created_at: new Date().toISOString(),
  };

  const mockFloorF01: VerticalUnit = {
    id: "unit-f01-parent",
    parcel_id: "parcel-surya",
    building_id: "bldg-surya",
    prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F-6131-F01",
    floor_code: "F01",
    tier_code: "F",
    unit_sequence: 1,
    unit_label: "Floor F01 (First Floor)",
    unit_type: "STOREY",
    unit_level: "STOREY",
    z_min: 543.5,
    z_max: 546.5,
    status: "PROPOSED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  };

  const mockFloorF02: VerticalUnit = {
    id: "unit-f02-parent",
    parcel_id: "parcel-surya",
    building_id: "bldg-surya",
    prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F-6132-F02",
    floor_code: "F02",
    tier_code: "F",
    unit_sequence: 2,
    unit_label: "Floor F02 (Second Floor)",
    unit_type: "STOREY",
    unit_level: "STOREY",
    z_min: 546.5,
    z_max: 549.5,
    status: "PROPOSED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  };

  const mockFlat101: VerticalUnit = {
    id: "unit-f01-flat101",
    parcel_id: "parcel-surya",
    building_id: "bldg-surya",
    parent_unit_id: "unit-f01-parent",
    prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F-6132-U101",
    floor_code: "F01",
    tier_code: "F",
    unit_sequence: 101,
    unit_label: "Flat 101 (2BHK)",
    unit_type: "APARTMENT",
    unit_level: "FLAT",
    flat_number: "101",
    z_min: 543.5,
    z_max: 546.5,
    status: "PROPOSED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  };

  // State machine simulator with single-source-of-truth toggle selection logic
  class SelectionManager {
    selectedUnit: VerticalUnit | null = null;
    activeBuilding: Building | null = mockBuilding;
    selectedParcel: Parcel | null = mockParcel;

    handleSelectUnit(unit: VerticalUnit | null) {
      if (!unit) {
        this.selectedUnit = null;
        return;
      }
      if (this.selectedUnit?.id === unit.id) {
        this.selectedUnit = null;
      } else {
        this.selectedUnit = unit;
      }
    }
  }

  it("TEST 1: Initial state has selectedUnit = null (normal building overview)", () => {
    const manager = new SelectionManager();
    expect(manager.selectedUnit).toBeNull();
    expect(manager.activeBuilding).not.toBeNull();
    expect(manager.selectedParcel).not.toBeNull();

    // Verify all floors have normal building colors (not glowing yellow)
    const colorF01 = getUnitArchitecturalColor(mockFloorF01, manager.selectedUnit);
    const colorF02 = getUnitArchitecturalColor(mockFloorF02, manager.selectedUnit);
    expect(colorF01.alpha).toBeCloseTo(0.90, 2);
    expect(colorF02.alpha).toBeCloseTo(0.90, 2);
  });

  it("TEST 2: Click F01 selects F01 and highlights F01 yellow", () => {
    const manager = new SelectionManager();
    manager.handleSelectUnit(mockFloorF01);

    expect(manager.selectedUnit?.id).toBe(mockFloorF01.id);
    expect(manager.selectedUnit?.floor_code).toBe("F01");

    // F01 highlighted yellow (alpha 0.96), F02 dimmed (alpha 0.45)
    const colorF01 = getUnitArchitecturalColor(mockFloorF01, manager.selectedUnit);
    const colorF02 = getUnitArchitecturalColor(mockFloorF02, manager.selectedUnit);
    expect(colorF01.alpha).toBeCloseTo(0.96, 2);
    expect(colorF02.alpha).toBeCloseTo(0.45, 2);
  });

  it("TEST 3: Click F01 AGAIN toggles selection off (selectedUnit = null, Building Overview restored)", () => {
    const manager = new SelectionManager();
    // First click: select
    manager.handleSelectUnit(mockFloorF01);
    expect(manager.selectedUnit?.id).toBe(mockFloorF01.id);

    // Second click on SAME floor: toggle off
    manager.handleSelectUnit(mockFloorF01);
    expect(manager.selectedUnit).toBeNull();

    // Verify building overview appearance restored
    const colorF01 = getUnitArchitecturalColor(mockFloorF01, manager.selectedUnit);
    const colorF02 = getUnitArchitecturalColor(mockFloorF02, manager.selectedUnit);
    expect(colorF01.alpha).toBeCloseTo(0.90, 2);
    expect(colorF02.alpha).toBeCloseTo(0.90, 2);
  });

  it("TEST 4: Click F01 → F02 deselects F01 and selects F02", () => {
    const manager = new SelectionManager();
    // Select F01
    manager.handleSelectUnit(mockFloorF01);
    expect(manager.selectedUnit?.floor_code).toBe("F01");

    // Click F02
    manager.handleSelectUnit(mockFloorF02);
    expect(manager.selectedUnit?.floor_code).toBe("F02");

    const colorF01 = getUnitArchitecturalColor(mockFloorF01, manager.selectedUnit);
    const colorF02 = getUnitArchitecturalColor(mockFloorF02, manager.selectedUnit);
    expect(colorF01.alpha).toBeCloseTo(0.45, 2);
    expect(colorF02.alpha).toBeCloseTo(0.96, 2);
  });

  it("TEST 5: Click F02 AGAIN clears selection (selectedUnit = null)", () => {
    const manager = new SelectionManager();
    manager.handleSelectUnit(mockFloorF01);
    manager.handleSelectUnit(mockFloorF02);
    expect(manager.selectedUnit?.floor_code).toBe("F02");

    // Click F02 again
    manager.handleSelectUnit(mockFloorF02);
    expect(manager.selectedUnit).toBeNull();
  });

  it("TEST 6: Select F01 → Flat 101 preserves flat selection and flat toggle", () => {
    const manager = new SelectionManager();
    // Click F01
    manager.handleSelectUnit(mockFloorF01);
    expect(manager.selectedUnit?.floor_code).toBe("F01");

    // Click Flat 101
    manager.handleSelectUnit(mockFlat101);
    expect(manager.selectedUnit?.flat_number).toBe("101");
    expect(manager.selectedUnit?.id).toBe("unit-f01-flat101");

    // Click Flat 101 again -> toggles off to null
    manager.handleSelectUnit(mockFlat101);
    expect(manager.selectedUnit).toBeNull();
  });

  it("TEST 7: After deselecting a floor, building and parcel remain completely intact", () => {
    const manager = new SelectionManager();
    manager.handleSelectUnit(mockFloorF01);
    expect(manager.selectedUnit?.floor_code).toBe("F01");

    // Deselect
    manager.handleSelectUnit(mockFloorF01);
    expect(manager.selectedUnit).toBeNull();

    // Critical invariant checks
    expect(manager.activeBuilding).not.toBeNull();
    expect(manager.activeBuilding?.building_name).toBe("Surya Heights");
    expect(manager.selectedParcel).not.toBeNull();
    expect(manager.selectedParcel?.ulpin_2d).toBe("36A1B2C3D4E5F9");
  });
});
