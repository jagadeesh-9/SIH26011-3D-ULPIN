import React, { useState } from "react";
import {
  MapPin,
  Building2,
  X,
  Layers,
  Loader2,
  RotateCcw,
  ArrowLeft,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import type { LocationSearchResult, BuildingCandidate } from "../types/cadastre";

export interface PrototypeConfigOptions {
  floorsAbove: number;
  floorHeight: number;
  includeBasement: boolean;
  includeRooftop: boolean;
  subdivideFlats: boolean;
}

interface LocationContextCardProps {
  location: LocationSearchResult;
  buildingCandidates?: BuildingCandidate[];
  selectedBuildingCandidate?: BuildingCandidate | null;
  onSelectBuildingCandidate?: (candidate: BuildingCandidate) => void;
  onDeselectBuildingCandidate?: () => void;
  onInspect3DStrata?: () => void;
  onGenerate3DPrototype?: (
    candidate: BuildingCandidate,
    options?: PrototypeConfigOptions
  ) => Promise<void> | void;
  onReturnToDemo: () => void;
  onClose: () => void;
  isLoadingBuildings?: boolean;
  isGeneratingPrototype?: boolean;
}

export const LocationContextCard: React.FC<LocationContextCardProps> = ({
  location,
  buildingCandidates = [],
  selectedBuildingCandidate,
  onSelectBuildingCandidate,
  onDeselectBuildingCandidate,
  onInspect3DStrata,
  onGenerate3DPrototype,
  onReturnToDemo,
  onClose,
  isLoadingBuildings = false,
  isGeneratingPrototype = false,
}) => {
  // Prototype configuration state for State B / C
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [floorsAbove, setFloorsAbove] = useState<number>(
    selectedBuildingCandidate?.levels && selectedBuildingCandidate.levels > 0
      ? selectedBuildingCandidate.levels
      : 3
  );
  const [floorHeight, setFloorHeight] = useState<number>(3.0);
  const [includeBasement, setIncludeBasement] = useState<boolean>(true);
  const [includeRooftop, setIncludeRooftop] = useState<boolean>(true);
  const [subdivideFlats, setSubdivideFlats] = useState<boolean>(true);

  // Check validity for State D
  const isInvalidFootprint =
    selectedBuildingCandidate &&
    (!selectedBuildingCandidate.footprintCoordinates ||
      selectedBuildingCandidate.footprintCoordinates.length < 3);

  const handleTriggerGeneration = () => {
    if (!selectedBuildingCandidate || !onGenerate3DPrototype) return;
    onGenerate3DPrototype(selectedBuildingCandidate, {
      floorsAbove,
      floorHeight,
      includeBasement,
      includeRooftop,
      subdivideFlats,
    });
  };

  return (
    <div
      className="location-context-card"
      style={{
        position: "absolute",
        top: "16px",
        left: "16px",
        width: "390px",
        maxWidth: "calc(100% - 32px)",
        maxHeight: "calc(100vh - 120px)",
        overflowY: "auto",
        background: "rgba(15, 23, 42, 0.94)",
        backdropFilter: "blur(16px)",
        border: selectedBuildingCandidate?.modelAvailable || location.modelAvailable
          ? "1px solid rgba(52, 211, 153, 0.45)"
          : "1px solid rgba(56, 189, 248, 0.35)",
        borderRadius: "10px",
        boxShadow: "0 14px 35px rgba(0, 0, 0, 0.6)",
        padding: "14px",
        zIndex: 50,
        color: "#f8fafc",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <MapPin style={{ width: "17px", height: "17px", color: "#38bdf8" }} />
          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>
            Searched Location Context
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: "2px",
            display: "flex",
            alignItems: "center",
          }}
          title="Dismiss Location Card"
        >
          <X style={{ width: "16px", height: "16px" }} />
        </button>
      </div>

      {/* Searched Location Name & Address */}
      <div style={{ marginBottom: "8px" }}>
        <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#e2e8f0", lineHeight: 1.3, marginBottom: "2px" }}>
          {location.displayName}
        </div>
        {location.shortAddress && (
          <div style={{ fontSize: "0.70rem", color: "#94a3b8" }}>
            {location.shortAddress}
          </div>
        )}
      </div>

      {/* Geographic Coordinates */}
      <div
        style={{
          background: "rgba(30, 41, 59, 0.6)",
          borderRadius: "6px",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          padding: "6px 10px",
          marginBottom: "10px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.70rem",
        }}
      >
        <span style={{ color: "#94a3b8" }}>Coordinates:</span>
        <span style={{ fontFamily: "monospace", color: "#38bdf8", fontWeight: 600 }}>
          {location.latitude.toFixed(6)}° N, {location.longitude.toFixed(6)}° E
        </span>
      </div>

      {/* Selected Reference Building Section */}
      {selectedBuildingCandidate ? (
        <div
          style={{
            background: "rgba(30, 41, 59, 0.75)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "8px",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Building2 style={{ width: "15px", height: "15px", color: selectedBuildingCandidate.modelAvailable ? "#34d399" : "#38bdf8" }} />
              <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#f8fafc" }}>
                SELECTED REFERENCE BUILDING
              </span>
            </div>
            {onDeselectBuildingCandidate && (
              <button
                type="button"
                onClick={onDeselectBuildingCandidate}
                style={{
                  background: "none",
                  border: "none",
                  color: "#38bdf8",
                  fontSize: "0.68rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                  fontWeight: 600,
                }}
              >
                <ArrowLeft style={{ width: "11px", height: "11px" }} /> Back
              </button>
            )}
          </div>

          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#e2e8f0", marginBottom: "4px" }}>
            {selectedBuildingCandidate.name || `Building (${selectedBuildingCandidate.buildingType})`}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "0.68rem", marginBottom: "8px" }}>
            <div>
              <span style={{ color: "#94a3b8" }}>Source: </span>
              <span style={{ color: "#cbd5e1" }}>OpenStreetMap</span>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Ref ID: </span>
              <span style={{ color: "#a78bfa", fontFamily: "monospace" }}>{selectedBuildingCandidate.osmId}</span>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Footprint Area: </span>
              <span style={{ color: "#34d399", fontWeight: 600 }}>~{selectedBuildingCandidate.approxAreaSqm} m²</span>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Distance: </span>
              <span style={{ color: "#38bdf8", fontWeight: 600 }}>{selectedBuildingCandidate.distanceMeters} m</span>
            </div>
          </div>

          {/* STATE D: INVALID FOOTPRINT */}
          {isInvalidFootprint ? (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "6px",
                padding: "8px",
                marginBottom: "8px",
                fontSize: "0.70rem",
                color: "#fca5a5",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "5px", fontWeight: 700, marginBottom: "2px" }}>
                <AlertTriangle style={{ width: "13px", height: "13px", color: "#ef4444" }} />
                <span>Invalid Building Footprint</span>
              </div>
              <div>Geometry contains fewer than 3 vertices. Cannot reconstruct 3D solid envelope.</div>
            </div>
          ) : selectedBuildingCandidate.modelAvailable ? (
            /* STATE A: EXISTING 3D CADASTRAL MODEL */
            <div
              style={{
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                borderRadius: "6px",
                padding: "8px",
                marginBottom: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.72rem", color: "#34d399", fontWeight: 700, marginBottom: "2px" }}>
                <CheckCircle2 style={{ width: "13px", height: "13px" }} />
                <span>3D CADASTRAL MODEL AVAILABLE</span>
              </div>
              <div style={{ fontSize: "0.68rem", color: "#cbd5e1", marginBottom: "6px" }}>
                Active vertical strata and Prototype 3D ULPINs are loaded in the 3D viewport.
              </div>
              {onInspect3DStrata && (
                <button
                  type="button"
                  onClick={onInspect3DStrata}
                  style={{
                    width: "100%",
                    background: "rgba(16, 185, 129, 0.3)",
                    color: "#34d399",
                    border: "1px solid rgba(16, 185, 129, 0.6)",
                    borderRadius: "4px",
                    padding: "6px",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                >
                  <Layers style={{ width: "13px", height: "13px" }} />
                  <span>Inspect 3D Strata</span>
                </button>
              )}
            </div>
          ) : (
            /* STATE B & C: IDENTIFIED BUT NO VERTICAL DATA / PROTOTYPE CONFIGURATION */
            <div
              style={{
                background: "rgba(56, 189, 248, 0.08)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: "6px",
                padding: "8px",
                marginBottom: "8px",
              }}
            >
              {/* Evidence Notice */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "6px" }}>
                <FileText style={{ width: "14px", height: "14px", color: "#38bdf8", flexShrink: 0, marginTop: "1px" }} />
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 700 }}>
                    Building Identified — Additional Vertical Data Required
                  </div>
                  <div style={{ fontSize: "0.64rem", color: "#94a3b8", lineHeight: 1.35, marginTop: "2px" }}>
                    OpenStreetMap provides a 2D reference footprint only. To establish vertical strata units, verified evidence (e.g. Architectural plans, LiDAR, Total Station) or explicit prototype parameters are required.
                  </div>
                </div>
              </div>

              {/* Toggle Prototype Configuration Drawer */}
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                style={{
                  width: "100%",
                  background: showConfig ? "rgba(56, 189, 248, 0.16)" : "rgba(30, 41, 59, 0.8)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  borderRadius: "4px",
                  padding: "5px 8px",
                  fontSize: "0.68rem",
                  color: "#38bdf8",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Sliders style={{ width: "12px", height: "12px" }} />
                  <span>{showConfig ? "Hide Prototype Parameters" : "Configure Synthetic Vertical Data"}</span>
                </div>
                {showConfig ? <ChevronUp style={{ width: "12px", height: "12px" }} /> : <ChevronDown style={{ width: "12px", height: "12px" }} />}
              </button>

              {/* State B: Interactive Prototype Parameter Controls */}
              {showConfig && (
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "5px",
                    padding: "8px",
                    marginBottom: "8px",
                    fontSize: "0.68rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#cbd5e1" }}>Floors Above Ground:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => setFloorsAbove(Math.max(1, floorsAbove - 1))}
                        style={{ background: "rgba(255, 255, 255, 0.1)", border: "none", color: "#fff", width: "18px", height: "18px", borderRadius: "3px", cursor: "pointer", fontWeight: 700 }}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 700, color: "#38bdf8", minWidth: "16px", textAlign: "center" }}>{floorsAbove}</span>
                      <button
                        type="button"
                        onClick={() => setFloorsAbove(Math.min(15, floorsAbove + 1))}
                        style={{ background: "rgba(255, 255, 255, 0.1)", border: "none", color: "#fff", width: "18px", height: "18px", borderRadius: "3px", cursor: "pointer", fontWeight: 700 }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#cbd5e1" }}>Floor Height:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => setFloorHeight(Math.max(2.5, Number((floorHeight - 0.1).toFixed(1))))}
                        style={{ background: "rgba(255, 255, 255, 0.1)", border: "none", color: "#fff", width: "18px", height: "18px", borderRadius: "3px", cursor: "pointer", fontWeight: 700 }}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 700, color: "#34d399", minWidth: "38px", textAlign: "center" }}>{floorHeight.toFixed(1)} m</span>
                      <button
                        type="button"
                        onClick={() => setFloorHeight(Math.min(5.0, Number((floorHeight + 0.1).toFixed(1))))}
                        style={{ background: "rgba(255, 255, 255, 0.1)", border: "none", color: "#fff", width: "18px", height: "18px", borderRadius: "3px", cursor: "pointer", fontWeight: 700 }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "2px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#94a3b8" }}>
                      <input
                        type="checkbox"
                        checked={subdivideFlats}
                        onChange={(e) => setSubdivideFlats(e.target.checked)}
                        style={{ accentColor: "#38bdf8" }}
                      />
                      <span>Subdivide into 4 Flats + Core (F01)</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#94a3b8" }}>
                      <input
                        type="checkbox"
                        checked={includeBasement}
                        onChange={(e) => setIncludeBasement(e.target.checked)}
                        style={{ accentColor: "#38bdf8" }}
                      />
                      <span>Include Basement Parking (B01)</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", color: "#94a3b8" }}>
                      <input
                        type="checkbox"
                        checked={includeRooftop}
                        onChange={(e) => setIncludeRooftop(e.target.checked)}
                        style={{ accentColor: "#38bdf8" }}
                      />
                      <span>Include Rooftop Solar Strata (RF01)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Generation Action Button */}
              {onGenerate3DPrototype && (
                <button
                  type="button"
                  disabled={isGeneratingPrototype}
                  onClick={handleTriggerGeneration}
                  style={{
                    width: "100%",
                    background: isGeneratingPrototype
                      ? "rgba(100, 116, 139, 0.2)"
                      : "linear-gradient(135deg, rgba(56, 189, 248, 0.35) 0%, rgba(168, 85, 247, 0.35) 100%)",
                    color: isGeneratingPrototype ? "#94a3b8" : "#f8fafc",
                    border: "1px solid rgba(56, 189, 248, 0.6)",
                    borderRadius: "5px",
                    padding: "7px 10px",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    cursor: isGeneratingPrototype ? "wait" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "2px",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    {isGeneratingPrototype ? (
                      <Loader2 style={{ width: "13px", height: "13px", animation: "spin 1s linear infinite", color: "#38bdf8" }} />
                    ) : (
                      <Layers style={{ width: "13px", height: "13px", color: "#38bdf8" }} />
                    )}
                    <span>{isGeneratingPrototype ? "Generating 3D Cadastral Strata..." : "Generate 3D Cadastral Prototype"}</span>
                  </div>
                  <span style={{ fontSize: "0.58rem", color: "#94a3b8", fontWeight: 500 }}>
                    Synthetic Research Prototype • PROPOSED State
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Discovered Building Candidates Section */
        <div style={{ marginBottom: "10px" }}>
          <div
            style={{
              fontSize: "0.68rem",
              color: "#64748b",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Nearby Reference Buildings</span>
            {isLoadingBuildings && (
              <Loader2 style={{ width: "12px", height: "12px", color: "#38bdf8", animation: "spin 1s linear infinite" }} />
            )}
          </div>

          {isLoadingBuildings ? (
            <div style={{ padding: "12px", textAlign: "center", color: "#94a3b8", fontSize: "0.72rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <Loader2 style={{ width: "13px", height: "13px", color: "#38bdf8", animation: "spin 1s linear infinite" }} />
              <span>Discovering nearby OpenStreetMap buildings...</span>
            </div>
          ) : buildingCandidates.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "190px", overflowY: "auto" }}>
              {buildingCandidates.slice(0, 5).map((candidate) => (
                <div
                  key={candidate.id}
                  style={{
                    background: candidate.isDirectMatch || candidate.proximityTier === "EXACT_OR_VERY_NEAR"
                      ? "rgba(14, 116, 144, 0.25)"
                      : "rgba(30, 41, 59, 0.5)",
                    border: candidate.isDirectMatch || candidate.proximityTier === "EXACT_OR_VERY_NEAR"
                      ? "1px solid rgba(56, 189, 248, 0.4)"
                      : "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "6px",
                    padding: "6px 8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {candidate.name || `Building (${candidate.buildingType})`}
                      </span>
                      {candidate.isDirectMatch ? (
                        <span
                          style={{
                            background: "rgba(56, 189, 248, 0.25)",
                            color: "#38bdf8",
                            borderRadius: "3px",
                            padding: "1px 4px",
                            fontSize: "0.55rem",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          EXACT REF
                        </span>
                      ) : candidate.proximityTier === "EXACT_OR_VERY_NEAR" ? (
                        <span
                          style={{
                            background: "rgba(52, 211, 153, 0.2)",
                            color: "#34d399",
                            borderRadius: "3px",
                            padding: "1px 4px",
                            fontSize: "0.55rem",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          NEAR REF
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: "0.66rem", color: "#94a3b8", display: "flex", gap: "6px", marginTop: "2px" }}>
                      <span>Dist: <strong style={{ color: "#38bdf8" }}>{candidate.distanceMeters}m</strong></span>
                      <span>•</span>
                      <span>Area: <strong style={{ color: "#34d399" }}>~{candidate.approxAreaSqm} m²</strong></span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {candidate.modelAvailable && (
                      <span
                        style={{
                          background: "rgba(16, 185, 129, 0.2)",
                          color: "#34d399",
                          borderRadius: "3px",
                          padding: "2px 4px",
                          fontSize: "0.60rem",
                          fontWeight: 700,
                        }}
                      >
                        3D
                      </span>
                    )}
                    {onSelectBuildingCandidate && (
                      <button
                        type="button"
                        onClick={() => onSelectBuildingCandidate(candidate)}
                        style={{
                          background: "rgba(56, 189, 248, 0.18)",
                          color: "#38bdf8",
                          border: "1px solid rgba(56, 189, 248, 0.35)",
                          borderRadius: "4px",
                          padding: "3px 8px",
                          fontSize: "0.68rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px dashed rgba(255, 255, 255, 0.12)", borderRadius: "6px", padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: "0.72rem", color: "#e2e8f0", fontWeight: 600, marginBottom: "4px" }}>
                No mapped OpenStreetMap building footprint found near this location.
              </div>
              <div style={{ fontSize: "0.64rem", color: "#94a3b8", lineHeight: 1.3 }}>
                Progressive discovery searched up to 500m radius without detecting digitized building outlines.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Claim Safety Disclaimer */}
      <div
        style={{
          fontSize: "0.64rem",
          color: "#64748b",
          marginBottom: "10px",
          lineHeight: 1.3,
          background: "rgba(0, 0, 0, 0.25)",
          padding: "6px 8px",
          borderRadius: "4px",
        }}
      >
        ℹ️ <strong>OpenStreetMap Reference Notice:</strong> Building footprints are geographic reference geometries from OpenStreetMap. They do not constitute official government cadastral records or registered ownership.
      </div>

      {/* Action: Return to Surya Heights Demo */}
      <button
        type="button"
        onClick={onReturnToDemo}
        style={{
          width: "100%",
          background: "rgba(56, 189, 248, 0.14)",
          color: "#38bdf8",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "6px",
          padding: "6px 10px",
          fontSize: "0.74rem",
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "5px",
        }}
      >
        <RotateCcw style={{ width: "13px", height: "13px" }} />
        <span>Return to Surya Heights Demo</span>
      </button>
    </div>
  );
};
