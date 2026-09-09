import React, { useState, useMemo } from "react";
import {
  Building2,
  ShieldCheck,
  Clock,
  HelpCircle,
  XCircle,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Search,
  BarChart3,
  Car,
  Home,
  Layers,
  Sun,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from "lucide-react";
import type { VerticalUnit, LayerVisibility, MeasurementMode } from "../types/cadastre";
import {
  setMeasurementMode,
  clearMeasurement,
  DEFAULT_MEASUREMENT_STATE,
} from "../utils/measurementUtils";
import { deriveElevationLevels } from "../utils/elevationOverlay";

interface VerticalExplorerProps {
  units: VerticalUnit[];
  selectedUnit: VerticalUnit | null;
  onSelectUnit: (unit: VerticalUnit | null) => void;
  isolatedUnitId: string | null;
  onToggleIsolate: (unitId: string) => void;
  onOpenParcelOverview?: () => void;
  layers?: LayerVisibility;
  onChangeLayers?: (layers: LayerVisibility) => void;
  onResetCamera?: () => void;
  is2DView?: boolean;
  onToggle2DView?: () => void;
  subUnitsMap?: Record<string, VerticalUnit[]>;
  expandedFloorIds?: Set<string>;
  onToggleExpandFloor?: (unitId: string) => void;
}

export const VerticalExplorer: React.FC<VerticalExplorerProps> = ({
  units,
  selectedUnit,
  onSelectUnit,
  isolatedUnitId,
  onToggleIsolate,
  onOpenParcelOverview,
  layers,
  onChangeLayers,
  onResetCamera,
  is2DView,
  onToggle2DView,
  subUnitsMap,
  expandedFloorIds: propExpandedFloorIds,
  onToggleExpandFloor: propOnToggleExpandFloor,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [showTechnicalTools, setShowTechnicalTools] = useState<boolean>(false);
  const [localExpandedIds, setLocalExpandedIds] = useState<Set<string>>(new Set(["F01"]));

  const isFloorExpanded = (floorIdOrCode: string) => {
    if (propExpandedFloorIds) {
      return propExpandedFloorIds.has(floorIdOrCode);
    }
    return localExpandedIds.has(floorIdOrCode);
  };

  const toggleExpand = (unit: VerticalUnit) => {
    if (propOnToggleExpandFloor) {
      propOnToggleExpandFloor(unit.id);
    } else {
      setLocalExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(unit.id) || next.has(unit.floor_code)) {
          next.delete(unit.id);
          next.delete(unit.floor_code);
        } else {
          next.add(unit.id);
          next.add(unit.floor_code);
        }
        return next;
      });
    }
  };

  const getStatusIcon = (status: VerticalUnit["status"]) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span title="Human Surveyor Verified">
            <ShieldCheck className="status-icon-sm verified" />
          </span>
        );
      case "UNDER_REVIEW":
        return (
          <span title="Surveyor Review in Progress">
            <Clock className="status-icon-sm review" />
          </span>
        );
      case "PROPOSED":
        return (
          <span title="Proposed Strata">
            <HelpCircle className="status-icon-sm proposed" />
          </span>
        );
      case "REJECTED":
        return (
          <span title="Rejected Candidate">
            <XCircle className="status-icon-sm rejected" />
          </span>
        );
      default:
        return null;
    }
  };

  const getFloorIcon = (tier: string, floorCode: string, unitType: string) => {
    if (tier === "SB" || unitType === "PARKING" || floorCode === "B01") return <Car style={{ width: "13px", height: "13px", color: "#818cf8" }} />;
    if (tier === "AR" || floorCode === "RF01") return <Sun style={{ width: "13px", height: "13px", color: "#f43f5e" }} />;
    if (floorCode === "F00" || floorCode === "GF") return <Building2 style={{ width: "13px", height: "13px", color: "#34d399" }} />;
    if (unitType === "RESIDENTIAL") return <Home style={{ width: "13px", height: "13px", color: "#38bdf8" }} />;
    return <Layers style={{ width: "13px", height: "13px", color: "#a78bfa" }} />;
  };

  const getCleanFloorHeader = (unit: VerticalUnit) => {
    if (unit.floor_code === "RF01" || unit.tier_code === "AR") return "ROOFTOP";
    if (unit.floor_code === "F05") return "FLOOR 5";
    if (unit.floor_code === "F04") return "FLOOR 4";
    if (unit.floor_code === "F03") return "FLOOR 3";
    if (unit.floor_code === "F02") return "FLOOR 2";
    if (unit.floor_code === "F01") return "FLOOR 1";
    if (unit.floor_code === "F00" || unit.floor_code === "GF") return "GROUND";
    if (unit.floor_code === "B01" || unit.tier_code === "SB") return "BASEMENT PARKING";
    return unit.floor_code;
  };

  const getCleanFloorUse = (unit: VerticalUnit) => {
    if (unit.tier_code === "SB" || unit.floor_code === "B01") return "Parking";
    if (unit.floor_code === "F00" || unit.floor_code === "GF") return "Stilt & Lobby";
    if (unit.unit_type === "RESIDENTIAL") return "Residential";
    if (unit.floor_code === "RF01" || unit.tier_code === "AR") return "Common Terrace & Solar";
    if (unit.tier_code === "CM") return "Common Circulation";
    return unit.unit_type;
  };

  // Sort strictly by physical Z elevation descending (Rooftop -> F05 -> ... -> F00 -> B01)
  const sortedPhysicalUnits = useMemo(() => {
    return [...units].sort((a, b) => b.z_max - a.z_max);
  }, [units]);

  // Derive Prototype Vertical Elevation Reference levels (relative to configured prototype ground datum)
  const elevationLevels = useMemo(() => {
    return deriveElevationLevels(units);
  }, [units]);

  const elevationLevelMap = useMemo(() => {
    const map = new Map<string, string>();
    elevationLevels.forEach((l) => {
      map.set(l.floorCode, l.displayElevation);
      if (l.unit?.id) {
        map.set(l.unit.id, l.displayElevation);
      }
    });
    return map;
  }, [elevationLevels]);

  // Sort elevation reference levels descending from top to bottom (RF01 -> F03 -> F02 -> F01 -> F00 -> B01)
  const sortedElevationLevelsDesc = useMemo(() => {
    return [...elevationLevels].sort((a, b) => b.renderZ - a.renderZ);
  }, [elevationLevels]);

  // Filter units
  const filteredUnits = useMemo(() => {
    return sortedPhysicalUnits.filter((u) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUlpin = (u.prototype_ulpin_3d || "").toLowerCase().includes(q);
        const matchLabel = (u.unit_label || "").toLowerCase().includes(q);
        const matchFloor = (u.floor_code || "").toLowerCase().includes(q);
        const matchType = (u.unit_type || "").toLowerCase().includes(q);
        if (!matchUlpin && !matchLabel && !matchFloor && !matchType) {
          return false;
        }
      }
      if (selectedStatus !== "ALL" && u.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [sortedPhysicalUnits, searchQuery, selectedStatus]);

  const toggleLayer = (key: keyof LayerVisibility) => {
    if (!layers || !onChangeLayers) return;
    onChangeLayers({
      ...layers,
      [key]: !layers[key],
    });
  };

  const handleSetMeasurementMode = (mode: MeasurementMode) => {
    if (!layers || !onChangeLayers) return;
    const currentState = layers.measurement || DEFAULT_MEASUREMENT_STATE;
    const newState = setMeasurementMode(currentState, mode);
    onChangeLayers({
      ...layers,
      measurement: newState,
    });
  };

  const handleClearMeasurement = () => {
    if (!layers || !onChangeLayers) return;
    const currentState = layers.measurement || DEFAULT_MEASUREMENT_STATE;
    const newState = clearMeasurement(currentState);
    onChangeLayers({
      ...layers,
      measurement: newState,
    });
  };

  return (
    <div className="panel vertical-explorer-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Panel Header */}
      <div className="panel-header" style={{ flexShrink: 0, padding: "8px 10px" }}>
        <div className="panel-title">
          <Building2 className="panel-icon" />
          <span style={{ letterSpacing: "0.02em", fontWeight: 700 }}>BUILDING LEVELS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            className={`btn-icon-sm ${showFilters ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle Search"
            style={{
              background: showFilters ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.05)",
              color: showFilters ? "#60a5fa" : "#94a3b8",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "4px",
              padding: "3px 5px",
              cursor: "pointer",
            }}
          >
            <SlidersHorizontal style={{ width: "12px", height: "12px" }} />
          </button>
          <span className="count-badge">{filteredUnits.length} Levels</span>
        </div>
      </div>

      {/* Optional Search Drawer */}
      {showFilters && (
        <div style={{ flexShrink: 0, padding: "6px 10px", background: "rgba(15, 23, 42, 0.7)", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", flexDirection: "column", gap: "5px" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search style={{ position: "absolute", left: "8px", width: "12px", height: "12px", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search level..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "4px",
                padding: "3px 8px 3px 24px",
                color: "#f8fafc",
                fontSize: "0.70rem",
                outline: "none"
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: "6px",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "0.8rem"
                }}
              >
                ×
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
            {["ALL", "VERIFIED", "UNDER_REVIEW", "PROPOSED", "REJECTED"].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                style={{
                  padding: "2px 5px",
                  fontSize: "0.60rem",
                  borderRadius: "3px",
                  background: selectedStatus === st ? "rgba(6, 182, 212, 0.25)" : "rgba(255,255,255,0.05)",
                  color: selectedStatus === st ? "#38bdf8" : "#94a3b8",
                  border: selectedStatus === st ? "1px solid #06b6d4" : "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                }}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prototype Vertical Elevation Reference Section */}
      {sortedElevationLevelsDesc.length > 0 && (
        <div
          className="elevation-reference-strip"
          data-testid="prototype-elevation-reference-panel"
          style={{
            flexShrink: 0,
            padding: "8px 10px",
            background: "linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.7) 100%)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div
            style={{
              fontSize: "0.64rem",
              fontWeight: 800,
              color: "#38bdf8",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>PROTOTYPE VERTICAL ELEVATION REFERENCE</span>
            <span style={{ fontSize: "0.58rem", color: "#94a3b8", fontWeight: 600 }}>Datum F00: ±0.00 m</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
              gap: "4px",
            }}
          >
            {sortedElevationLevelsDesc.map((lvl) => {
              const isSelected =
                selectedUnit?.floor_code === lvl.floorCode ||
                selectedUnit?.id === lvl.unit?.id ||
                (selectedUnit?.parent_unit_id && selectedUnit.parent_unit_id === lvl.unit?.id);

              return (
                <div
                  key={lvl.id}
                  onClick={() => lvl.unit && onSelectUnit(lvl.unit)}
                  data-testid={`elevation-level-${lvl.floorCode}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "3px 6px",
                    borderRadius: "4px",
                    background: isSelected
                      ? "rgba(251, 191, 36, 0.25)"
                      : lvl.isGround
                      ? "rgba(52, 211, 153, 0.12)"
                      : lvl.isBasement
                      ? "rgba(129, 140, 248, 0.12)"
                      : "rgba(255, 255, 255, 0.05)",
                    border: isSelected
                      ? "1.5px solid #fbbf24"
                      : lvl.isGround
                      ? "1px solid rgba(52, 211, 153, 0.4)"
                      : "1px solid rgba(255, 255, 255, 0.08)",
                    cursor: lvl.unit ? "pointer" : "default",
                    transition: "all 0.15s ease",
                    boxShadow: isSelected ? "0 0 8px rgba(251, 191, 36, 0.3)" : "none",
                  }}
                  title={`${lvl.unitLabel} (${lvl.displayElevation})`}
                >
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      color: isSelected ? "#fbbf24" : lvl.isGround ? "#34d399" : "#f1f5f9",
                      fontFamily: "monospace",
                    }}
                  >
                    {lvl.floorCode}
                  </span>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      color: isSelected
                        ? "#fbbf24"
                        : lvl.isGround
                        ? "#34d399"
                        : lvl.isBasement
                        ? "#a5b4fc"
                        : "#38bdf8",
                      fontFamily: "monospace",
                    }}
                  >
                    {lvl.displayElevation}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Complete Scrollable Stack of Floor Cards (Rooftop to Basement Parking) */}
      <div
        className="stack-container"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "6px 8px",
          display: "flex",
          flexDirection: "column",
          gap: "4px"
        }}
      >
        {filteredUnits.length === 0 ? (
          <div style={{ padding: "16px 8px", textAlign: "center", color: "#94a3b8", fontSize: "0.75rem" }}>
            No levels found.
          </div>
        ) : (
          filteredUnits.map((u) => {
            const isSelected = selectedUnit?.id === u.id;
            const isIsolated = isolatedUnitId === u.id;
            const isBasement = u.tier_code === "SB" || u.floor_code === "B01";
            const isRoof = u.tier_code === "AR" || u.floor_code === "RF01";
            const isGround = u.floor_code === "F00" || u.floor_code === "GF";
            const height = (u.z_max - u.z_min).toFixed(1);

            const subUnits = subUnitsMap?.[u.id] || u.sub_units || [];
            const hasSubUnits = u.floor_code === "F01" || subUnits.length > 0;
            const isExpanded = isFloorExpanded(u.id) || isFloorExpanded(u.floor_code);
            const levelDisplayElevation = elevationLevelMap.get(u.floor_code) || elevationLevelMap.get(u.id) || "±0.00 m";

            return (
              <div key={u.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div
                  className={`floor-card-item ${isSelected ? "selected-floor" : ""} ${
                    isBasement ? "basement-card" : isRoof ? "roof-card" : isGround ? "ground-card" : ""
                  }`}
                  onClick={() => onSelectUnit(u)}
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(59, 130, 246, 0.2) 100%)"
                      : isBasement
                      ? "rgba(99, 102, 241, 0.08)"
                      : isRoof
                      ? "rgba(244, 63, 94, 0.08)"
                      : isGround
                      ? "rgba(16, 185, 129, 0.08)"
                      : "rgba(30, 41, 59, 0.6)",
                    border: isSelected
                      ? "1.5px solid #06b6d4"
                      : "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "5px",
                    padding: "5px 8px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: isSelected ? "0 0 10px rgba(6, 182, 212, 0.25)" : "none",
                  }}
                >
                  {/* Level Title Row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      {hasSubUnits && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(u);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: isExpanded ? "#38bdf8" : "#94a3b8",
                            cursor: "pointer",
                            padding: "0",
                            display: "flex",
                            alignItems: "center"
                          }}
                          title={isExpanded ? "Collapse floor flats" : "Expand floor flats"}
                        >
                          {isExpanded ? <ChevronDown style={{ width: "13px", height: "13px" }} /> : <ChevronRight style={{ width: "13px", height: "13px" }} />}
                        </button>
                      )}
                      {getFloorIcon(u.tier_code, u.floor_code, u.unit_type)}
                      <span style={{ fontSize: "0.80rem", fontWeight: 800, letterSpacing: "0.01em", color: isSelected ? "#ffffff" : "#f1f5f9" }}>
                        {getCleanFloorHeader(u)}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {hasSubUnits && (
                        <span
                          style={{
                            fontSize: "0.58rem",
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: "3px",
                            background: "rgba(56, 189, 248, 0.15)",
                            color: "#38bdf8",
                            border: "1px solid rgba(56, 189, 248, 0.3)",
                            cursor: "pointer"
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(u);
                          }}
                        >
                          {subUnits.length > 0 ? `${subUnits.filter(s => s.flat_number).length} Flats + Core` : "4 Flats + Core"}
                        </span>
                      )}
                      {getStatusIcon(u.status)}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleIsolate(u.id);
                        }}
                        title={isIsolated ? "Show all levels" : "Isolate in 3D"}
                        style={{
                          background: isIsolated ? "rgba(6, 182, 212, 0.3)" : "transparent",
                          border: "none",
                          color: isIsolated ? "#06b6d4" : "#64748b",
                          cursor: "pointer",
                          padding: "1px 3px",
                          borderRadius: "3px"
                        }}
                      >
                        {isIsolated ? <EyeOff style={{ width: "12px", height: "12px" }} /> : <Eye style={{ width: "12px", height: "12px" }} />}
                      </button>
                    </div>
                  </div>

                  {/* Subtitle Use */}
                  <div style={{ fontSize: "0.68rem", color: isSelected ? "#a5f3fc" : "#94a3b8", marginBottom: "2px", fontWeight: 500 }}>
                    {getCleanFloorUse(u)}
                  </div>

                  {/* Elevation and Height */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.67rem", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "2px" }}>
                    <span style={{ color: isSelected ? "#fbbf24" : isGround ? "#34d399" : isBasement ? "#a5b4fc" : "#38bdf8", fontFamily: "monospace", fontWeight: 700 }}>
                      {levelDisplayElevation}
                    </span>
                    <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: "0.62rem" }}>
                      Z: {u.z_min.toFixed(1)} → {u.z_max.toFixed(1)} m
                    </span>
                    <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{height} m</span>
                  </div>
                </div>

                {/* Sub-units Nested Cards Container */}
                {hasSubUnits && isExpanded && subUnits.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                      marginLeft: "10px",
                      paddingLeft: "6px",
                      borderLeft: "2px solid rgba(56, 189, 248, 0.4)",
                      marginTop: "1px",
                      marginBottom: "2px"
                    }}
                  >
                    {subUnits.map((sub) => {
                      const isSubSelected = selectedUnit?.id === sub.id;
                      const isSubIsolated = isolatedUnitId === sub.id;
                      const isCore = sub.unit_level === "COMMON_CIRCULATION" || sub.tier_code === "CM";
                      const subLabel = sub.flat_number ? `Flat ${sub.flat_number}` : (sub.unit_label || "Common Core");
                      const subArea = sub.flat_number === "101" || sub.flat_number === "104" ? "76.73 m²" : sub.flat_number ? "76.70 m²" : "71.98 m²";

                      return (
                        <div
                          key={sub.id}
                          className={`sub-unit-card ${isSubSelected ? "selected-sub" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectUnit(sub);
                          }}
                          style={{
                            background: isSubSelected
                              ? "linear-gradient(135deg, rgba(251, 191, 36, 0.25) 0%, rgba(245, 158, 11, 0.2) 100%)"
                              : isCore
                              ? "rgba(71, 85, 105, 0.25)"
                              : "rgba(15, 23, 42, 0.65)",
                            border: isSubSelected
                              ? "1.5px solid #fbbf24"
                              : isCore
                              ? "1px dashed rgba(148, 163, 184, 0.35)"
                              : "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "4px",
                            padding: "4px 7px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            boxShadow: isSubSelected ? "0 0 8px rgba(251, 191, 36, 0.3)" : "none",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: isSubSelected ? "#fbbf24" : isCore ? "#94a3b8" : "#38bdf8" }}>
                                {subLabel}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                              {getStatusIcon(sub.status)}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleIsolate(sub.id);
                                }}
                                title={isSubIsolated ? "Show all" : "Isolate in 3D"}
                                style={{
                                  background: isSubIsolated ? "rgba(251, 191, 36, 0.3)" : "transparent",
                                  border: "none",
                                  color: isSubIsolated ? "#fbbf24" : "#64748b",
                                  cursor: "pointer",
                                  padding: "1px 2px",
                                  borderRadius: "2px"
                                }}
                              >
                                {isSubIsolated ? <EyeOff style={{ width: "10px", height: "10px" }} /> : <Eye style={{ width: "10px", height: "10px" }} />}
                              </button>
                            </div>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.64rem", color: isSubSelected ? "#fef3c7" : "#94a3b8", marginTop: "1px" }}>
                            <span>{isCore ? "Circulation & Core" : "2BHK Residential"}</span>
                            <span style={{ fontFamily: "monospace", color: isSubSelected ? "#fbbf24" : "#34d399", fontWeight: 600 }}>
                              {subArea}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Fixed Bottom Control Bar (Frame Building & Technical Tools) */}
      <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(15, 23, 42, 0.9)" }}>
        <div style={{ padding: "6px 8px", display: "flex", gap: "5px" }}>
          {onResetCamera && (
            <button
              className="btn-secondary"
              onClick={onResetCamera}
              style={{ flex: 1, padding: "5px 6px", fontSize: "0.70rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
              title="Frame building in 3D"
            >
              <RotateCcw style={{ width: "11px", height: "11px" }} />
              <span>Frame Building</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowTechnicalTools(!showTechnicalTools)}
            style={{
              flex: 1,
              background: showTechnicalTools ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.05)",
              color: showTechnicalTools ? "#60a5fa" : "#94a3b8",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "4px",
              padding: "5px 6px",
              fontSize: "0.70rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
          >
            <span>Technical Tools</span>
            {showTechnicalTools ? <ChevronDown style={{ width: "11px", height: "11px" }} /> : <ChevronUp style={{ width: "11px", height: "11px" }} />}
          </button>
        </div>

        {/* Collapsible Technical Tools Section */}
        {showTechnicalTools && layers && onChangeLayers && (
          <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "8px", background: "rgba(15, 23, 42, 0.95)", borderTop: "1px solid rgba(255, 255, 255, 0.06)", maxHeight: "240px", overflowY: "auto" }}>
            {/* 1. VISUALIZATION SECTION */}
            <div>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.05em", color: "#38bdf8", marginBottom: "4px" }}>
                VISUALIZATION
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "0.66rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", color: "#e2e8f0", cursor: "pointer" }} title="Show 2D Cadastral Parent Parcel Boundary">
                  <input type="checkbox" checked={layers.parcel} onChange={() => toggleLayer("parcel")} />
                  <span>Parcel Boundary</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", color: "#e2e8f0", cursor: "pointer" }} title="Show Subordinate Building Envelope Box">
                  <input type="checkbox" checked={layers.building} onChange={() => toggleLayer("building")} />
                  <span>Building Envelope</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", color: "#e2e8f0", cursor: "pointer" }} title="Make ground translucent to inspect basement">
                  <input type="checkbox" checked={layers.undergroundMode} onChange={() => toggleLayer("undergroundMode")} />
                  <span>Underground View</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", color: "#e2e8f0", cursor: "pointer" }} title="Overlay wireframe edges on solid building">
                  <input type="checkbox" checked={layers.wireframeMode} onChange={() => toggleLayer("wireframeMode")} />
                  <span>Wireframe</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "4px", color: "#e2e8f0", cursor: "pointer", gridColumn: "span 2" }} title="Display architectural vertical elevation guide lines and height labels">
                  <input type="checkbox" checked={layers.elevationLevels ?? false} onChange={() => toggleLayer("elevationLevels")} />
                  <span style={{ color: "#38bdf8", fontWeight: 600 }}>Elevation Levels</span>
                </label>
              </div>

              {/* 2D Top-Down & Cutaway */}
              <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                <button
                  className={`btn-mode ${is2DView ? "active" : ""}`}
                  onClick={onToggle2DView}
                  style={{ flex: 1, padding: "3px 4px", fontSize: "0.64rem" }}
                  title="Switch between 3D perspective and 2D top-down plan"
                >
                  {is2DView ? "3D Perspective" : "2D Top View"}
                </button>

                <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", background: layers.cutaway?.enabled ? "rgba(245, 158, 11, 0.2)" : "rgba(255,255,255,0.04)", border: layers.cutaway?.enabled ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid transparent", borderRadius: "3px", fontSize: "0.64rem", color: "#e2e8f0", cursor: "pointer" }} title="Sectional vertical cutaway inspection">
                  <input
                    type="checkbox"
                    checked={layers.cutaway?.enabled ?? false}
                    onChange={() => {
                      const cur = layers.cutaway || { enabled: false, axis: "Y", positionPercent: 50, invert: false, opacity: 0.15 };
                      onChangeLayers({
                        ...layers,
                        cutaway: { ...cur, enabled: !cur.enabled },
                      });
                    }}
                  />
                  <span>Cutaway</span>
                </label>
              </div>
            </div>

            {/* 2. MEASUREMENT SECTION */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "6px" }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.05em", color: "#f59e0b", marginBottom: "4px" }}>
                MEASUREMENT
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px" }}>
                {[
                  { mode: "POINT_COORDS", label: "Point Pick" },
                  { mode: "DISTANCE_2D", label: "Horizontal Dist" },
                  { mode: "ELEVATION_DELTA", label: "Vertical Height" },
                  { mode: "DISTANCE_3D", label: "3D Distance" },
                ].map((item) => {
                  const isActive = (layers.measurement?.mode ?? "OFF") === item.mode;
                  return (
                    <button
                      key={item.mode}
                      className={`btn-mode ${isActive ? "active" : ""}`}
                      onClick={() => handleSetMeasurementMode(item.mode as MeasurementMode)}
                      style={{ padding: "3px 4px", fontSize: "0.62rem" }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              {layers.measurement?.mode && layers.measurement.mode !== "OFF" && (
                <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                  <button
                    onClick={handleClearMeasurement}
                    style={{ flex: 1, padding: "2px 4px", fontSize: "0.62rem", background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "3px", cursor: "pointer" }}
                  >
                    Clear Points
                  </button>
                  <button
                    onClick={() => handleSetMeasurementMode("OFF")}
                    style={{ flex: 1, padding: "2px 4px", fontSize: "0.62rem", background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "3px", cursor: "pointer" }}
                  >
                    Exit Tool
                  </button>
                </div>
              )}
            </div>

            {/* 3. ANALYSIS SECTION */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "6px" }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.05em", color: "#10b981", marginBottom: "4px" }}>
                ANALYSIS
              </div>
              {onOpenParcelOverview && (
                <button
                  onClick={onOpenParcelOverview}
                  style={{
                    width: "100%",
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#34d399",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    borderRadius: "4px",
                    padding: "4px 6px",
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px"
                  }}
                >
                  <BarChart3 style={{ width: "11px", height: "11px" }} />
                  <span>Quality Scorecard</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
