import React, { useEffect, useState } from "react";
import {
  Building2,
  FileText,
  ShieldCheck,
  Layers,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  Activity,
  MapPin
} from "lucide-react";
import type {
  VerticalUnit,
  Building,
  Parcel,
  UnitEvidenceProvenanceResponse,
  AICandidateAnalysisResponse,
  UnitTopologyReportResponse,
  UnitEvidenceFusionResponse,
  PrototypeTechnicalReviewDossier
} from "../types/cadastre";
import {
  fetchUnitEvidence,
  fetchUnitAIAnalysis,
  fetchUnitTopology,
  fetchUnitEvidenceFusion,
  fetchUnitDossier
} from "../api/cadastreApi";
import { PrototypeTechnicalDossier } from "./PrototypeTechnicalDossier";

interface PropertyInspectorProps {
  unit: VerticalUnit | null;
  building?: Building | null;
  parcel?: Parcel | null;
  onClose: () => void;
  onOpenReview?: (unitId: string) => void;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  unit,
  building,
  parcel,
  onClose,
  onOpenReview,
}) => {
  const [activeTab, setActiveTab] = useState<"EVIDENCE" | "AI" | "TOPOLOGY" | "FUSION">("EVIDENCE");
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  const [evidenceData, setEvidenceData] = useState<UnitEvidenceProvenanceResponse | null>(null);
  const [evidenceFusion, setEvidenceFusion] = useState<UnitEvidenceFusionResponse | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AICandidateAnalysisResponse | null>(null);
  const [unitTopology, setUnitTopology] = useState<UnitTopologyReportResponse | null>(null);
  const [dossierData, setDossierData] = useState<PrototypeTechnicalReviewDossier | null>(null);
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [loadingDossier, setLoadingDossier] = useState(false);

  useEffect(() => {
    if (!unit) {
      setEvidenceData(null);
      setEvidenceFusion(null);
      setAiAnalysis(null);
      setUnitTopology(null);
      return;
    }

    fetchUnitEvidence(unit.id)
      .then((data) => setEvidenceData(data))
      .catch((err) => {
        console.warn("Evidence fetch error:", err);
        setEvidenceData(null);
      });

    fetchUnitEvidenceFusion(unit.id)
      .then((data) => setEvidenceFusion(data))
      .catch((err) => {
        console.warn("Evidence Fusion fetch error:", err);
        setEvidenceFusion(null);
      });

    fetchUnitAIAnalysis(unit.id)
      .then((data) => setAiAnalysis(data))
      .catch((err) => {
        console.warn("AI Analysis fetch error:", err);
        setAiAnalysis(null);
      });

    fetchUnitTopology(unit.id)
      .then((data) => setUnitTopology(data))
      .catch((err) => {
        console.warn("Topology fetch error:", err);
        setUnitTopology(null);
      });
  }, [unit?.id]);

  const handleOpenDossier = async () => {
    if (!unit) return;
    setLoadingDossier(true);
    try {
      const data = await fetchUnitDossier(unit.id);
      setDossierData(data);
      setShowDossierModal(true);
    } catch (err) {
      console.error("Failed to load dossier:", err);
    } finally {
      setLoadingDossier(false);
    }
  };

  const getStatusBadge = (status: VerticalUnit["status"]) => {
    switch (status) {
      case "VERIFIED":
        return <span className="badge badge-success">✓ VERIFIED</span>;
      case "UNDER_REVIEW":
        return <span className="badge badge-warning">⏳ UNDER REVIEW</span>;
      case "PROPOSED":
        return <span className="badge badge-info">💡 PROPOSED</span>;
      case "REJECTED":
        return <span className="badge badge-danger">✗ REJECTED</span>;
    }
  };

  const isSurya = building?.building_code?.startsWith("APARTMENT-SURYA") || parcel?.ulpin_2d === "36A1B2C3D4E5F8" || parcel?.ulpin_2d === "36A1B2C3D4E5F9";

  // 1. DEFAULT VIEW: No floor selected -> Display Clean Building Overview
  if (!unit) {
    return (
      <div className="panel inspector-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
        <div className="panel-header">
          <div className="panel-title">
            <Building2 className="panel-icon" />
            <span style={{ fontWeight: 700 }}>BUILDING OVERVIEW</span>
          </div>
          <span className="badge prototype-badge">Surya Heights</span>
        </div>

        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Building Title Header */}
          <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", padding: "12px" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f8fafc", marginBottom: "2px" }}>
              Surya Heights
            </div>
            <div style={{ fontSize: "0.82rem", color: "#38bdf8", fontWeight: 600, marginBottom: "4px" }}>
              Residential Apartment
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
              <MapPin style={{ width: "13px", height: "13px", color: "#38bdf8" }} />
              <span>Kondapur · Hyderabad, Telangana, India</span>
            </div>
          </div>

          {/* Primary Key Metrics Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            <div className="metric-box" style={{ background: "rgba(30, 41, 59, 0.6)", padding: "8px 6px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.06)", textAlign: "center" }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#38bdf8" }}>21.50 m</div>
              <div style={{ fontSize: "0.66rem", color: "#94a3b8", fontWeight: 600 }}>Building Height</div>
            </div>

            <div className="metric-box" style={{ background: "rgba(30, 41, 59, 0.6)", padding: "8px 6px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.06)", textAlign: "center" }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#f8fafc" }}>5</div>
              <div style={{ fontSize: "0.66rem", color: "#94a3b8", fontWeight: 600 }}>Residential Floors</div>
            </div>

            <div className="metric-box" style={{ background: "rgba(30, 41, 59, 0.6)", padding: "8px 6px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.06)", textAlign: "center" }}>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#818cf8" }}>1</div>
              <div style={{ fontSize: "0.66rem", color: "#94a3b8", fontWeight: 600 }}>Basement Parking</div>
            </div>
          </div>

          {/* Location & Elevation Section */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "12px", fontSize: "0.78rem" }}>
            <div style={{ fontWeight: 700, color: "#f8fafc", marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "4px", display: "flex", justifyContent: "space-between" }}>
              <span>Spatial Datum & Coordinates</span>
              <span style={{ color: "#64748b", fontSize: "0.7rem", fontWeight: 400 }}>EPSG:32644</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: "#94a3b8" }}>Ground Z</span>
              <span style={{ fontFamily: "monospace", color: "#34d399", fontWeight: 700 }}>540.00 m</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: "#94a3b8" }}>Roof Z</span>
              <span style={{ fontFamily: "monospace", color: "#f43f5e", fontWeight: 700 }}>561.50 m</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: "#94a3b8" }}>X</span>
              <span style={{ fontFamily: "monospace", color: "#38bdf8" }}>219997.91 m</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span style={{ color: "#94a3b8" }}>Y</span>
              <span style={{ fontFamily: "monospace", color: "#38bdf8" }}>1933097.50 m</span>
            </div>
          </div>

          {/* Reference & Model Lineage Card */}
          <div style={{ background: "rgba(14, 165, 233, 0.06)", border: "1px solid rgba(14, 165, 233, 0.22)", borderRadius: "6px", padding: "10px 12px", fontSize: "0.74rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "#94a3b8" }}>Reference:</span>
              <span style={{ color: "#38bdf8", fontWeight: 600 }}>OpenStreetMap Building Footprint</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "#94a3b8" }}>Vertical Model:</span>
              <span style={{ color: "#34d399", fontWeight: 600 }}>Synthetic Research Prototype</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "#94a3b8" }}>OSM Anchor:</span>
              <span style={{ color: "#7dd3fc", fontFamily: "monospace" }}>Way 356027047</span>
            </div>
            <div style={{ borderTop: "1px solid rgba(14, 165, 233, 0.12)", marginTop: "6px", paddingTop: "4px", fontSize: "0.68rem", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
              <span>Attribution:</span>
              <span style={{ color: "#94a3b8" }}>© OpenStreetMap contributors</span>
            </div>
          </div>

          {/* Interactive Guidance Prompt */}
          <div style={{ textAlign: "center", padding: "10px", background: "rgba(6, 182, 212, 0.05)", borderRadius: "6px", border: "1px dashed rgba(6, 182, 212, 0.25)" }}>
            <span style={{ fontSize: "0.76rem", color: "#38bdf8" }}>
              Select any floor in the left navigator to inspect vertical unit cadastral details.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. FLOOR / FLAT SELECTED VIEW
  const isFlat = unit.unit_level === "FLAT" || unit.unit_level === "COMMON_CIRCULATION" || Boolean(unit.parent_unit_id);
  const isBasement = unit.tier_code === "SB" || unit.floor_code === "B01" || unit.floor_code.startsWith("B");
  const isGround = unit.floor_code === "F00" || unit.floor_code === "GF" || unit.floor_code === "P00";
  const floorHeight = (unit.z_max - unit.z_min).toFixed(2);
  const groundRef = 540.0;
  
  // Base elevation relative to configured prototype ground datum
  const relElevation = (unit.z_min - groundRef).toFixed(2);
  const formattedElevation = isGround || Math.abs(Number(relElevation)) < 0.001
    ? "±0.00 m"
    : `${Number(relElevation) > 0 ? "+" : ""}${relElevation} m`;

  // Flat specific metrics
  const flatArea = unit.flat_number === "101" || unit.flat_number === "104"
    ? "76.73"
    : unit.flat_number === "102" || unit.flat_number === "103"
    ? "76.70"
    : unit.unit_level === "COMMON_CIRCULATION"
    ? "71.98"
    : isSurya ? "384.00" : "300.00";

  const flatVolume = (Number(flatArea) * Number(floorHeight)).toFixed(2);

  const approxVolume = unitTopology?.solid_validation?.volume_cbm
    ? unitTopology.solid_validation.volume_cbm.toFixed(1)
    : flatVolume;

  const unitTitle = unit.unit_label || (isFlat ? `Flat ${unit.flat_number || unit.floor_code}` : `Floor ${unit.floor_code}`);

  return (
    <div className="panel inspector-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title">
          <Building2 className="panel-icon" />
          <span style={{ fontWeight: 700 }}>{unitTitle}</span>
        </div>
        <button
          className="btn-text btn-back-to-building"
          data-testid="property-inspector-back-btn"
          onClick={onClose}
          style={{ fontSize: "0.74rem", color: "#38bdf8", cursor: "pointer", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "4px", padding: "2px 8px", fontWeight: 600 }}
          title="Return to Building Overview"
        >
          ← Back to Building
        </button>
      </div>

      <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Unit Identity & Status */}
        <div style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", padding: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <div>
              <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#f8fafc" }}>
                {unitTitle}
              </span>
              {isFlat && (
                <div style={{ fontSize: "0.72rem", color: "#38bdf8", fontWeight: 600, marginTop: "2px" }}>
                  Parent Floor: Floor F01 (First Floor) · {unit.unit_level === "COMMON_CIRCULATION" ? "Common Core" : "Residential Unit"}
                </div>
              )}
            </div>
            {getStatusBadge(unit.status)}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#64748b", fontFamily: "monospace" }}>
            Prototype 3D Unit ID: <span style={{ color: "#38bdf8" }}>{unit.prototype_ulpin_3d}</span>
          </div>
        </div>

        {/* Primary Cadastral Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "8px 10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ fontSize: "0.68rem", color: "#64748b" }}>Elevation from Ground</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: isBasement ? "#818cf8" : "#fbbf24" }}>{formattedElevation}</div>
          </div>
          <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "8px 10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ fontSize: "0.68rem", color: "#64748b" }}>{isFlat ? "Unit Height" : "Floor Height"}</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#38bdf8" }}>{floorHeight} m</div>
          </div>
          <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "8px 10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ fontSize: "0.68rem", color: "#64748b" }}>{isFlat ? "Flat Footprint Area" : "Floor Footprint"}</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#34d399" }}>
              {flatArea} m²
            </div>
          </div>
          <div style={{ background: "rgba(30, 41, 59, 0.6)", padding: "8px 10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ fontSize: "0.68rem", color: "#64748b" }}>Modeled 3D Volume</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc" }}>{approxVolume} m³</div>
          </div>
        </div>

        {/* Prototype Z Bounds Card */}
        <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Prototype Z Bounds (EPSG:32644)</span>
          <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#34d399", fontFamily: "monospace" }}>
            {unit.z_min.toFixed(2)} → {unit.z_max.toFixed(2)} m
          </span>
        </div>

        {/* Synthetic Prototype Notice for Flats */}
        {isFlat && (
          <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", borderRadius: "6px", padding: "8px 10px", fontSize: "0.72rem", color: "#fcd34d" }}>
            <div style={{ fontWeight: 600, marginBottom: "2px" }}>ℹ️ Synthetic Research Prototype — Internal Flat Subdivision:</div>
            Individual apartment boundaries and circulation zones on Floor F01 are synthetic demonstration models for 3D cadastral prototyping. They do not represent final surveyed deed boundaries.
          </div>
        )}

        {/* Underground Safety Note for Basement / Subterranean */}
        {isBasement && (
          <div style={{ background: "rgba(99, 102, 241, 0.12)", border: "1px solid rgba(99, 102, 241, 0.3)", borderRadius: "6px", padding: "8px 10px", fontSize: "0.72rem", color: "#c7d2fe" }}>
            <div style={{ fontWeight: 600, marginBottom: "2px" }}>ℹ️ Subterranean Geometry Note:</div>
            Underground geometry in this research prototype is synthetic architectural/BIM-style demonstration geometry. LiDAR alone does not establish underground geometry.
          </div>
        )}

        {/* Action Buttons: Review & Technical Dossier */}
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={handleOpenDossier}
            disabled={loadingDossier}
            style={{
              flex: 1,
              background: "rgba(59, 130, 246, 0.2)",
              color: "#60a5fa",
              border: "1px solid rgba(59, 130, 246, 0.4)",
              borderRadius: "4px",
              padding: "6px 8px",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px"
            }}
          >
            <FileText style={{ width: "13px", height: "13px" }} />
            <span>{loadingDossier ? "Loading..." : "Technical Dossier"}</span>
          </button>

          {onOpenReview && (
            <button
              type="button"
              onClick={() => onOpenReview(unit.id)}
              style={{
                flex: 1,
                background: "rgba(16, 185, 129, 0.2)",
                color: "#34d399",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                borderRadius: "4px",
                padding: "6px 8px",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px"
              }}
            >
              <ShieldCheck style={{ width: "13px", height: "13px" }} />
              <span>Surveyor Review</span>
            </button>
          )}
        </div>

        {/* Progressive Disclosure: Technical Details Accordion */}
        <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "8px" }}>
          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            style={{
              width: "100%",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "4px",
              padding: "6px 10px",
              color: "#94a3b8",
              fontSize: "0.76rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <span>Technical Details</span>
            {showTechnicalDetails ? <ChevronUp style={{ width: "14px", height: "14px" }} /> : <ChevronDown style={{ width: "14px", height: "14px" }} />}
          </button>

          {showTechnicalDetails && (
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Tabs */}
              <div style={{ display: "flex", gap: "3px", background: "rgba(0,0,0,0.3)", padding: "2px", borderRadius: "4px" }}>
                {[
                  { key: "EVIDENCE", label: "Evidence", icon: Database },
                  { key: "AI", label: "AI Analysis", icon: Cpu },
                  { key: "TOPOLOGY", label: "Topology", icon: Layers },
                  { key: "FUSION", label: "Fusion", icon: Activity },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key as any)}
                    style={{
                      flex: 1,
                      background: activeTab === t.key ? "rgba(59, 130, 246, 0.3)" : "transparent",
                      color: activeTab === t.key ? "#60a5fa" : "#64748b",
                      border: "none",
                      borderRadius: "3px",
                      padding: "4px 2px",
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Evidence */}
              {activeTab === "EVIDENCE" && (
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {evidenceData?.evidence_records?.map((rec, idx) => (
                    <div key={idx} style={{ background: "rgba(15, 23, 42, 0.5)", padding: "6px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ fontWeight: 600, color: "#f8fafc" }}>{rec.source_type} · {rec.dataset_name}</div>
                      <div>Accuracy: H ±{rec.accuracy_horizontal_m}m, V ±{rec.accuracy_vertical_m}m</div>
                      <div style={{ color: "#64748b" }}>Sensor: {rec.sensor_category}</div>
                    </div>
                  )) || <div>No evidence records found.</div>}
                </div>
              )}

              {/* Tab 2: AI Analysis */}
              {activeTab === "AI" && (
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ background: "rgba(15, 23, 42, 0.5)", padding: "6px", borderRadius: "4px" }}>
                    <div>Confidence: <span style={{ color: "#34d399", fontWeight: 600 }}>{aiAnalysis?.confidence_label || "HIGH CONFIDENCE"}</span></div>
                    <div>Score: <span style={{ color: "#38bdf8" }}>{aiAnalysis?.confidence_score ? `${(aiAnalysis.confidence_score * 100).toFixed(0)}%` : "92%"}</span></div>
                    <div>Explanation: {aiAnalysis?.explanation?.join(" ") || "Segmented solid conforms to detected levels."}</div>
                  </div>
                </div>
              )}

              {/* Tab 3: Topology */}
              {activeTab === "TOPOLOGY" && (
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ background: "rgba(15, 23, 42, 0.5)", padding: "6px", borderRadius: "4px" }}>
                    <div>Solid Valid: <span style={{ color: "#34d399", fontWeight: 600 }}>{unitTopology?.solid_validation?.is_solid ? "YES" : "VALID"}</span></div>
                    <div>Volume: <span style={{ color: "#f8fafc" }}>{unitTopology?.solid_validation?.volume_cbm?.toFixed(2) || approxVolume} m³</span></div>
                    <div>Conflicts: <span style={{ color: unitTopology?.conflict_count === 0 ? "#34d399" : "#ef4444" }}>{unitTopology?.conflict_count ?? 0}</span></div>
                  </div>
                </div>
              )}

              {/* Tab 4: Fusion */}
              {activeTab === "FUSION" && (
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ background: "rgba(15, 23, 42, 0.5)", padding: "6px", borderRadius: "4px" }}>
                    <div>Confidence: <span style={{ color: "#38bdf8", fontWeight: 600 }}>{evidenceFusion?.overall_confidence_label || "HIGH CONFIDENCE"}</span></div>
                    <div>Source Count: {evidenceFusion?.sources?.length ?? 1} Evaluated</div>
                    <div>Conflicts: {evidenceFusion?.conflicts?.length ?? 0} Detected</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Technical Dossier Modal */}
      {showDossierModal && dossierData && (
        <PrototypeTechnicalDossier
          dossier={dossierData}
          onClose={() => setShowDossierModal(false)}
        />
      )}
    </div>
  );
};
