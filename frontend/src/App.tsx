import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { CesiumViewer } from "./components/CesiumViewer";
import { VerticalExplorer } from "./components/VerticalExplorer";
import { PropertyInspector } from "./components/PropertyInspector";
import { ReviewWorkspace } from "./components/ReviewWorkspace";
import { ParcelOverviewModal } from "./components/ParcelOverviewModal";
import { IngestionWorkspaceModal } from "./components/IngestionWorkspaceModal";
import { LocationContextCard } from "./components/LocationContextCard";
import { ULPINResultCard } from "./components/ULPINResultCard";
import type {
  Parcel,
  Building,
  VerticalUnit,
  LayerVisibility,
  LocationSearchResult,
  BuildingCandidate,
  ParcelULPINLookupResult,
} from "./types/cadastre";
import {
  fetchParcels,
  fetchBuildings,
  fetchVerticalUnits,
  fetchUnitSubUnits,
  generateBuilding3DPrototype,
} from "./api/cadastreApi";
import { defaultBuildingDiscoveryProvider } from "./services/buildingDiscoveryProvider";
import { DEFAULT_CUTAWAY_STATE } from "./utils/cutawayUtils";
import {
  DEFAULT_MEASUREMENT_STATE,
  DEFAULT_COORD_HUD_STATE,
  addMeasurementPoint,
} from "./utils/measurementUtils";
import { AlertTriangle, RefreshCw } from "lucide-react";
import "./App.css";

export const App: React.FC = () => {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [verticalUnits, setVerticalUnits] = useState<VerticalUnit[]>([]);
  const [subUnitsMap, setSubUnitsMap] = useState<Record<string, VerticalUnit[]>>({});
  const [expandedFloorIds, setExpandedFloorIds] = useState<Set<string>>(new Set());
  const [selectedUnit, setSelectedUnit] = useState<VerticalUnit | null>(null);
  const [searchedLocation, setSearchedLocation] = useState<LocationSearchResult | null>(null);
  const [showLocationCard, setShowLocationCard] = useState<boolean>(true);
  const [ulpinLookupResult, setUlpinLookupResult] = useState<ParcelULPINLookupResult | null>(null);
  const [showULPINCard, setShowULPINCard] = useState<boolean>(true);
  const [buildingCandidates, setBuildingCandidates] = useState<BuildingCandidate[]>([]);
  const [selectedBuildingCandidate, setSelectedBuildingCandidate] = useState<BuildingCandidate | null>(null);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState<boolean>(false);
  const [isGeneratingPrototype, setIsGeneratingPrototype] = useState<boolean>(false);
  const [reviewUnitId, setReviewUnitId] = useState<string | null>(null);
  const [isOverviewModalOpen, setIsOverviewModalOpen] = useState<boolean>(false);
  const [isIngestionModalOpen, setIsIngestionModalOpen] = useState<boolean>(false);
  const [isolatedUnitId, setIsolatedUnitId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraTrigger, setCameraTrigger] = useState<number>(0);
  const [is2DView, setIs2DView] = useState<boolean>(false);

  // Discover nearby reference building footprints when searched location changes
  useEffect(() => {
    if (!searchedLocation) {
      setBuildingCandidates([]);
      setSelectedBuildingCandidate(null);
      setIsLoadingBuildings(false);
      return;
    }

    setIsLoadingBuildings(true);
    setSelectedBuildingCandidate(null);

    defaultBuildingDiscoveryProvider
      .discoverBuildings(searchedLocation.latitude, searchedLocation.longitude, searchedLocation)
      .then((candidates) => {
        setBuildingCandidates(candidates);
        // If searched location already points to Surya Heights, auto-select it
        if (searchedLocation.modelAvailable) {
          const suryaCandidate = candidates.find((c) => c.modelAvailable);
          if (suryaCandidate) {
            setSelectedBuildingCandidate(suryaCandidate);
          }
        }
      })
      .catch((err) => {
        console.warn("Building discovery error:", err);
        setBuildingCandidates([]);
      })
      .finally(() => {
        setIsLoadingBuildings(false);
      });
  }, [searchedLocation]);

  const handleSelectBuildingCandidate = useCallback((candidate: BuildingCandidate) => {
    setSelectedBuildingCandidate(candidate);
    setShowLocationCard(true);

    if (candidate.modelAvailable) {
      const matchingParcel = parcels.find(
        (p) =>
          (candidate.parcelId && p.id === candidate.parcelId) ||
          (candidate.parcelId && p.ulpin_2d === candidate.parcelId) ||
          (candidate.osmId === "356027047" && p.ulpin_2d === "36A1B2C3D4E5F9")
      );
      if (matchingParcel && matchingParcel.id !== selectedParcel?.id) {
        setSelectedParcel(matchingParcel);
      }
      setCameraTrigger((prev) => prev + 1);
    }
  }, [parcels, selectedParcel?.id]);

  const handleAddMeasurementPoint = useCallback((point: any) => {
    setLayers((prev) => ({
      ...prev,
      measurement: addMeasurementPoint(prev.measurement, point),
    }));
  }, []);

  const handleGenerate3DPrototype = async (
    candidate: BuildingCandidate,
    options?: {
      floorsAbove: number;
      floorHeight: number;
      includeBasement: boolean;
      includeRooftop: boolean;
      subdivideFlats: boolean;
    }
  ) => {
    try {
      setIsGeneratingPrototype(true);
      const res = await generateBuilding3DPrototype({
        candidate_osm_id: candidate.osmId,
        footprint_wgs84: candidate.footprintCoordinates,
        building_name: candidate.name || `Building OSM-${candidate.osmId}`,
        total_floors_above: options?.floorsAbove !== undefined ? options.floorsAbove : (candidate.levels && candidate.levels > 0 ? candidate.levels : 3),
        total_floors_below: options?.includeBasement === false ? 0 : 1,
        include_rooftop: options?.includeRooftop !== false,
        subdivide_residential_floors: options?.subdivideFlats !== false,
        floor_height_m: options?.floorHeight || 3.0,
        is_synthetic_prototype: true,
      });

      // Update candidate in state so UI immediately marks 3D model as available
      const updatedCandidate: BuildingCandidate = {
        ...candidate,
        modelAvailable: true,
        buildingCode: res.building_code,
        parcelId: res.parcel_id,
      };
      setSelectedBuildingCandidate(updatedCandidate);
      setBuildingCandidates((prev) =>
        prev.map((c) => (c.osmId === candidate.osmId ? updatedCandidate : c))
      );
      setSearchedLocation((prev) =>
        prev ? { ...prev, modelAvailable: true, parcelId: res.parcel_id } : null
      );

      // Refresh parcels list and select the newly created / updated parcel
      const updatedParcels = await fetchParcels();
      setParcels(updatedParcels);
      const targetParcel = updatedParcels.find((p) => p.id === res.parcel_id);
      if (targetParcel) {
        setSelectedParcel(targetParcel);
      }
      setCameraTrigger((prev) => prev + 1);
    } catch (err: any) {
      console.error("Failed to generate 3D prototype:", err);
      alert(`3D Cadastral Prototype generation failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsGeneratingPrototype(false);
    }
  };

  const handleSelectUnit = useCallback((unit: VerticalUnit | null) => {
    if (!unit) {
      setSelectedUnit(null);
      return;
    }
    setSelectedUnit((prev) => (prev?.id === unit.id ? null : unit));
  }, []);

  const handleToggleIsolate = (unitId: string) => {
    setIsolatedUnitId((prev) => (prev === unitId ? null : unitId));
  };

  const handleSelectLocation = (result: LocationSearchResult) => {
    setSearchedLocation(result);
    setShowLocationCard(true);

    if (result.modelAvailable) {
      // If it points to an existing parcel (e.g. Surya Heights), switch to it
      const matchingParcel = parcels.find(
        (p) =>
          (result.parcelId && p.id === result.parcelId) ||
          (result.parcelId && p.ulpin_2d === result.parcelId) ||
          p.ulpin_2d === "36A1B2C3D4E5F9"
      );
      if (matchingParcel && matchingParcel.id !== selectedParcel?.id) {
        setSelectedParcel(matchingParcel);
      }
      // Re-trigger building framing
      setCameraTrigger((prev) => prev + 1);
    }
  };

  const handleClearLocation = () => {
    setSearchedLocation(null);
    setBuildingCandidates([]);
    setSelectedBuildingCandidate(null);
    // Restore Surya Heights default demo
    const osmParcel = parcels.find((p) => p.ulpin_2d === "36A1B2C3D4E5F9");
    if (osmParcel && selectedParcel?.id !== osmParcel.id) {
      setSelectedParcel(osmParcel);
    }
    setCameraTrigger((prev) => prev + 1);
  };

  const handleSelectULPIN = (result: ParcelULPINLookupResult) => {
    setUlpinLookupResult(result);
    setShowULPINCard(true);
    // Clear address search context
    setSearchedLocation(null);
    setBuildingCandidates([]);
    setSelectedBuildingCandidate(null);

    // Resolve or append registered parcel in state
    let targetParcel = parcels.find(
      (p) => p.id === result.parcel_id || p.ulpin_2d === result.ulpin
    );
    if (!targetParcel) {
      targetParcel = {
        id: result.parcel_id,
        ulpin_2d: result.ulpin,
        survey_number: result.survey_number,
        district: result.district,
        state: result.state,
        village_code: result.village_code,
        area_sqm: result.area_sqm,
        geom_2d: result.geometry,
        building_count: result.building_id ? 1 : 0,
        vertical_unit_count: result.vertical_unit_count,
        created_at: new Date().toISOString(),
      };
      setParcels((prev) => [...prev, targetParcel!]);
    }
    setSelectedParcel(targetParcel);
    setCameraTrigger((prev) => prev + 1);
  };

  const handleClearULPIN = () => {
    setUlpinLookupResult(null);
    setShowULPINCard(false);
    // Restore Surya Heights default demo
    const osmParcel = parcels.find((p) => p.ulpin_2d === "36A1B2C3D4E5F9");
    if (osmParcel && selectedParcel?.id !== osmParcel.id) {
      setSelectedParcel(osmParcel);
    }
    setCameraTrigger((prev) => prev + 1);
  };

  const handleResetCamera = () => {
    setSelectedUnit(null);
    setIsolatedUnitId(null);
    setSearchedLocation(null);
    setBuildingCandidates([]);
    setSelectedBuildingCandidate(null);
    setUlpinLookupResult(null);
    setShowULPINCard(false);
    setCameraTrigger((prev) => prev + 1);
  };

  const [layers, setLayers] = useState<LayerVisibility>({
    parcel: true,
    building: true,
    groundFloors: true,
    upperFloors: true,
    basements: true,
    utilities: true,
    rooftopElevated: true,
    commonCirculation: true,
    undergroundMode: false,
    wireframeMode: false,
    elevationLevels: false,
    showVerified: true,
    showProposed: true,
    showUnderReview: true,
    showRejected: true,
    showConflictsOnly: false,
    sliceMode: false,
    sliceMinZ: -10,
    sliceMaxZ: 30,
    cutaway: DEFAULT_CUTAWAY_STATE,
    measurement: DEFAULT_MEASUREMENT_STATE,
    coordHUD: DEFAULT_COORD_HUD_STATE,
  });

  // 1. Initial Data Fetching: Load parcels on mount (prioritize canonical APARTMENT-SURYA-OSM anchor parcel)
  useEffect(() => {
    fetchParcels()
      .then((data) => {
        setParcels(data);
        setIsConnected(true);
        setErrorMessage(null);
        if (data.length > 0) {
          const osmParcel = data.find((p) => p.ulpin_2d === "36A1B2C3D4E5F9");
          const suryaParcel = data.find((p) => p.ulpin_2d === "36A1B2C3D4E5F8");
          setSelectedParcel(osmParcel || suryaParcel || data[0]);
        }
      })
      .catch((err) => {
        console.error("Failed to connect to backend:", err);
        setIsConnected(false);
        setErrorMessage(
          "Unable to connect to FastAPI backend at http://127.0.0.1:8000. Ensure the backend uvicorn server is running."
        );
      });
  }, []);

  // 2. When parcel changes, fetch its buildings and vertical units
  useEffect(() => {
    if (!selectedParcel) return;

    fetchBuildings(selectedParcel.id)
      .then((bldgs) => setBuildings(bldgs))
      .catch((err) => console.warn("Buildings fetch error:", err));

    fetchVerticalUnits(selectedParcel.id)
      .then(async (units) => {
        setVerticalUnits(units);
        setSelectedUnit(null); // Default to building overview mode

        // Automatically prefetch sub-units for all residential upper storeys
        const residentialFloors = units.filter(
          (u) => u.tier_code === "F" && u.floor_code !== "F00" && u.floor_code !== "GF"
        );
        for (const floor of residentialFloors) {
          try {
            const subs = await fetchUnitSubUnits(floor.id);
            if (subs && subs.length > 0) {
              setSubUnitsMap((prev) => ({ ...prev, [floor.id]: subs }));
            }
          } catch (err) {
            console.warn("Sub-units prefetch error for floor:", floor.floor_code, err);
          }
        }
      })
      .catch((err) => console.warn("Vertical units fetch error:", err));
  }, [selectedParcel?.id]);

  const handleToggleExpandFloor = async (floorUnitId: string) => {
    setExpandedFloorIds((prev) => {
      const next = new Set(prev);
      if (next.has(floorUnitId)) {
        next.delete(floorUnitId);
      } else {
        next.add(floorUnitId);
      }
      return next;
    });

    if (!subUnitsMap[floorUnitId]) {
      try {
        const subUnits = await fetchUnitSubUnits(floorUnitId);
        if (subUnits && subUnits.length > 0) {
          setSubUnitsMap((prev) => ({
            ...prev,
            [floorUnitId]: subUnits,
          }));
        }
      } catch (err) {
        console.warn("Failed to fetch sub-units for unit:", floorUnitId, err);
      }
    }
  };

  const activeBuilding = buildings.length > 0 ? buildings[0] : null;
  const isSurya = selectedParcel?.ulpin_2d === "36A1B2C3D4E5F9" || selectedParcel?.ulpin_2d === "36A1B2C3D4E5F8" || activeBuilding?.building_code?.startsWith("APARTMENT-SURYA");

  return (
    <div className="cadastre-app">
      {/* Header with Integrated Map Search */}
      <Header
        parcels={parcels}
        selectedParcel={selectedParcel}
        onSelectParcel={setSelectedParcel}
        isConnected={isConnected}
        onOpenIngestion={() => setIsIngestionModalOpen(true)}
        onSelectLocation={handleSelectLocation}
        onClearLocation={handleClearLocation}
        activeLocation={searchedLocation}
        onSelectULPIN={handleSelectULPIN}
        onClearULPIN={handleClearULPIN}
        activeULPIN={ulpinLookupResult}
      />

      {/* Error Alert if backend unreachable */}
      {errorMessage && (
        <div className="error-banner">
          <AlertTriangle className="error-icon" />
          <span>{errorMessage}</span>
          <button
            className="btn-retry"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="icon-sm" /> Retry
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <main className="workspace-container">
        {/* Left Side Panel: Building Levels & Clean Technical Tools Drawer */}
        <aside className="sidebar-left">
          <VerticalExplorer
            units={verticalUnits}
            subUnitsMap={subUnitsMap}
            expandedFloorIds={expandedFloorIds}
            onToggleExpandFloor={handleToggleExpandFloor}
            selectedUnit={selectedUnit}
            onSelectUnit={handleSelectUnit}
            isolatedUnitId={isolatedUnitId}
            onToggleIsolate={handleToggleIsolate}
            onOpenParcelOverview={() => setIsOverviewModalOpen(true)}
            layers={layers}
            onChangeLayers={setLayers}
            onResetCamera={handleResetCamera}
            is2DView={is2DView}
            onToggle2DView={() => setIs2DView(!is2DView)}
          />
        </aside>

        {/* Center: Cesium 3D Viewport */}
        <section className="viewport-center">
          <CesiumViewer
            parcel={selectedParcel}
            building={activeBuilding}
            units={verticalUnits}
            subUnitsMap={subUnitsMap}
            expandedFloorIds={expandedFloorIds}
            selectedUnit={selectedUnit}
            onSelectUnit={handleSelectUnit}
            layers={layers}
            isolatedUnitId={isolatedUnitId}
            is2DView={is2DView}
            cameraTrigger={cameraTrigger}
            searchedLocation={searchedLocation}
            ulpinLookupResult={ulpinLookupResult}
            buildingCandidates={buildingCandidates}
            selectedBuildingCandidate={selectedBuildingCandidate}
            onSelectBuildingCandidate={handleSelectBuildingCandidate}
            onAddMeasurementPoint={handleAddMeasurementPoint}
          />

          {/* ULPIN Direct Lookup Result Card (Phase 3.13) */}
          {ulpinLookupResult && showULPINCard && (
            <ULPINResultCard
              result={ulpinLookupResult}
              onFlyToParcel={() => setCameraTrigger((prev) => prev + 1)}
              onInspect3D={() => setCameraTrigger((prev) => prev + 1)}
              onClose={() => setShowULPINCard(false)}
            />
          )}

          {/* Restore ULPIN Result Card button if dismissed */}
          {ulpinLookupResult && !showULPINCard && (
            <button
              type="button"
              className="chip"
              onClick={() => setShowULPINCard(true)}
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                zIndex: 35,
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                color: "#34d399",
                border: "1px solid rgba(52, 211, 153, 0.4)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                backdropFilter: "blur(8px)",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "0.78rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              title="Reopen ULPIN Result Card"
            >
              <span>🏢 Show ULPIN Details ({ulpinLookupResult.ulpin})</span>
            </button>
          )}

          {/* Searched Location & Building Discovery Context Card (Phase 3.11B / 3.12A) */}
          {searchedLocation && showLocationCard && (
            <LocationContextCard
              location={searchedLocation}
              buildingCandidates={buildingCandidates}
              selectedBuildingCandidate={selectedBuildingCandidate}
              onSelectBuildingCandidate={handleSelectBuildingCandidate}
              onDeselectBuildingCandidate={() => setSelectedBuildingCandidate(null)}
              onGenerate3DPrototype={handleGenerate3DPrototype}
              isGeneratingPrototype={isGeneratingPrototype}
              onInspect3DStrata={() => {
                const osmParcel = parcels.find((p) => p.ulpin_2d === "36A1B2C3D4E5F9");
                if (osmParcel) setSelectedParcel(osmParcel);
                setCameraTrigger((prev) => prev + 1);
              }}
              onReturnToDemo={handleClearLocation}
              onClose={() => setShowLocationCard(false)}
              isLoadingBuildings={isLoadingBuildings}
            />
          )}

          {/* Restore Location Context Card button if dismissed */}
          {searchedLocation && !showLocationCard && (
            <button
              type="button"
              className="chip"
              onClick={() => setShowLocationCard(true)}
              style={{
                position: "absolute",
                top: "16px",
                left: "16px",
                zIndex: 35,
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                color: "#38bdf8",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                backdropFilter: "blur(8px)",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "0.78rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              title="Reopen Searched Location Context"
            >
              <span>📍 Show Location Context ({searchedLocation.displayName.split(",")[0]})</span>
            </button>
          )}

          {/* Floating Spatial HUD Overlay */}
          {(() => {
            const hudMinZ = verticalUnits.length > 0 ? Math.min(...verticalUnits.map((u) => u.z_min)) : 540.0;
            const hudMaxZ = verticalUnits.length > 0 ? Math.max(...verticalUnits.map((u) => u.z_max)) : (isSurya ? 561.5 : 549.5);
            const hudHeight = (hudMaxZ - hudMinZ).toFixed(2);
            return (
              <div className="spatial-hud" style={{ background: "rgba(15, 23, 42, 0.9)", backdropFilter: "blur(8px)", border: "1px solid rgba(255, 255, 255, 0.12)" }}>
                <div className="hud-metric">
                  <span className="hud-label">Building:</span>
                  <span className="hud-value" style={{ color: "#38bdf8", fontWeight: 700 }}>
                    {isSurya ? "Surya Heights" : (activeBuilding?.building_code || "Demo Building")}
                  </span>
                </div>
                <div className="hud-divider" />
                <div className="hud-metric">
                  <span className="hud-label">Height:</span>
                  <span className="hud-value" style={{ color: "#34d399", fontWeight: 700 }}>
                    {hudHeight} m
                  </span>
                </div>
                <div className="hud-divider" />
                <div className="hud-metric">
                  <span className="hud-label">Ground Z:</span>
                  <span className="hud-value">+{hudMinZ.toFixed(2)} m</span>
                </div>
                <div className="hud-divider" />
                <div className="hud-metric">
                  <span className="hud-label">Roof Z:</span>
                  <span className="hud-value">+{hudMaxZ.toFixed(2)} m</span>
                </div>
                <div className="hud-divider" />
                <div className="hud-metric">
                  <span className="hud-label">Strata:</span>
                  <span className="hud-value">{verticalUnits.length} Levels</span>
                </div>
              </div>
            );
          })()}

          {/* Research Prototype Disclaimer & OSM Attribution Footer Banner */}
          <div
            style={{
              position: "absolute",
              bottom: "8px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(15, 23, 42, 0.88)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "20px",
              padding: "4px 16px",
              fontSize: "0.68rem",
              color: "#94a3b8",
              pointerEvents: "none",
              zIndex: 30,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
              whiteSpace: "nowrap"
            }}
          >
            <span>🇮🇳</span>
            <span>OpenStreetMap provides the geographic reference footprint. Vertical floors and Prototype 3D Unit IDs are synthetic research models.</span>
            <span style={{ color: "#475569" }}>•</span>
            <span style={{ color: "#64748b" }}>© OpenStreetMap contributors</span>
          </div>
        </section>

        {/* Right Side Panel: Cadastral Inspector */}
        <aside className="sidebar-right">
          <PropertyInspector
            unit={selectedUnit}
            building={activeBuilding}
            parcel={selectedParcel}
            onClose={() => setSelectedUnit(null)}
            onOpenReview={(id) => setReviewUnitId(id)}
          />
        </aside>
      </main>

      {/* Phase 3.1 Human Review & Decision Workspace Modal */}
      {reviewUnitId && (
        <ReviewWorkspace
          unitId={reviewUnitId}
          onClose={() => setReviewUnitId(null)}
          onStatusChanged={(updatedUnit) => {
            if (selectedParcel) {
              fetchVerticalUnits(selectedParcel.id).then((units) => {
                setVerticalUnits(units);
                const match = units.find((u) => u.id === updatedUnit.id);
                if (match) setSelectedUnit(match);
              });
            }
          }}
        />
      )}

      {/* Phase 3.2 Parcel 3D Dataset Overview & Scorecard Modal */}
      {isOverviewModalOpen && selectedParcel && (
        <ParcelOverviewModal
          parcelId={selectedParcel.id}
          onClose={() => setIsOverviewModalOpen(false)}
        />
      )}

      {/* Phase 3.3 Real-World Ingestion & Source Standardization Modal */}
      {isIngestionModalOpen && (
        <IngestionWorkspaceModal
          isOpen={isIngestionModalOpen}
          onClose={() => setIsIngestionModalOpen(false)}
          onOpenReviewWorkspace={(unitId) => {
            setReviewUnitId(unitId || verticalUnits[0]?.id || null);
          }}
        />
      )}
    </div>
  );
};

export default App;

