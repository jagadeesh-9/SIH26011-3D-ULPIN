import React, { useState } from "react";
import {
  Building2,
  MapPin,
  X,
  Copy,
  Check,
  Compass,
  AlertCircle,
} from "lucide-react";
import type { ParcelULPINLookupResult } from "../types/cadastre";

interface ULPINResultCardProps {
  result: ParcelULPINLookupResult;
  onFlyToParcel?: () => void;
  onInspect3D?: () => void;
  onClose: () => void;
}

export const ULPINResultCard: React.FC<ULPINResultCardProps> = ({
  result,
  onFlyToParcel,
  onInspect3D,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.ulpin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="ulpin-result-card"
      style={{
        position: "absolute",
        top: "16px",
        left: "16px",
        width: "380px",
        maxWidth: "calc(100% - 32px)",
        background: "rgba(15, 23, 42, 0.95)",
        backdropFilter: "blur(16px)",
        border: result.has_3d_prototype
          ? "1px solid rgba(52, 211, 153, 0.45)"
          : "1px solid rgba(56, 189, 248, 0.35)",
        borderRadius: "12px",
        boxShadow: "0 16px 36px rgba(0, 0, 0, 0.6)",
        zIndex: 40,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "0px",
        color: "#f8fafc",
      }}
    >
      {/* Header with Title & Close Button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px 10px 14px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(30, 41, 59, 0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              background: "rgba(16, 185, 129, 0.18)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MapPin style={{ width: "14px", height: "14px", color: "#34d399" }} />
          </div>
          <div>
            <div style={{ fontSize: "0.80rem", fontWeight: 700, color: "#34d399", letterSpacing: "0.02em" }}>
              ULPIN FOUND ✓
            </div>
            <div style={{ fontSize: "0.66rem", color: "#94a3b8" }}>
              {result.source || "Prototype ULPIN Reference Registry"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px",
          }}
          title="Dismiss result"
        >
          <X style={{ width: "16px", height: "16px" }} />
        </button>
      </div>

      {/* Main Content Body */}
      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* ULPIN Display Box with Copy Action */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "8px",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "0.64rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Bhu-Aadhaar / Parcel ULPIN
            </div>
            <div style={{ fontSize: "0.94rem", fontWeight: 800, fontFamily: "monospace", color: "#38bdf8", letterSpacing: "0.06em", marginTop: "2px" }}>
              {result.ulpin}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            style={{
              background: copied ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.06)",
              border: copied ? "1px solid rgba(16, 185, 129, 0.5)" : "1px solid rgba(255, 255, 255, 0.12)",
              color: copied ? "#34d399" : "#cbd5e1",
              borderRadius: "6px",
              padding: "5px 8px",
              fontSize: "0.68rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontWeight: 600,
              transition: "all 0.15s ease",
            }}
            title="Copy ULPIN"
          >
            {copied ? <Check style={{ width: "12px", height: "12px" }} /> : <Copy style={{ width: "12px", height: "12px" }} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Spatial & Cadastral Details Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            fontSize: "0.72rem",
          }}
        >
          <div
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "6px",
              padding: "7px 9px",
            }}
          >
            <div style={{ color: "#64748b", fontSize: "0.62rem", textTransform: "uppercase", fontWeight: 600 }}>
              Survey Number
            </div>
            <div style={{ color: "#f1f5f9", fontWeight: 600, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {result.survey_number}
            </div>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "6px",
              padding: "7px 9px",
            }}
          >
            <div style={{ color: "#64748b", fontSize: "0.62rem", textTransform: "uppercase", fontWeight: 600 }}>
              Parcel Area
            </div>
            <div style={{ color: "#f1f5f9", fontWeight: 600, marginTop: "2px" }}>
              {result.area_sqm ? `${result.area_sqm.toFixed(2)} m²` : "N/A"}
            </div>
          </div>

          <div
            style={{
              gridColumn: "span 2",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "6px",
              padding: "7px 9px",
            }}
          >
            <div style={{ color: "#64748b", fontSize: "0.62rem", textTransform: "uppercase", fontWeight: 600 }}>
              Registered Centroid Coordinates
            </div>
            <div style={{ color: "#38bdf8", fontWeight: 600, fontFamily: "monospace", marginTop: "2px", fontSize: "0.74rem" }}>
              {result.latitude.toFixed(6)}° N, {result.longitude.toFixed(6)}° E
            </div>
          </div>
        </div>

        {/* 3D Prototype Availability Status Banner */}
        <div
          style={{
            padding: "8px 10px",
            borderRadius: "6px",
            background: result.has_3d_prototype
              ? "rgba(16, 185, 129, 0.12)"
              : "rgba(245, 158, 11, 0.12)",
            border: result.has_3d_prototype
              ? "1px solid rgba(16, 185, 129, 0.35)"
              : "1px solid rgba(245, 158, 11, 0.35)",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          {result.has_3d_prototype ? (
            <Building2 style={{ width: "16px", height: "16px", color: "#34d399", marginTop: "1px", flexShrink: 0 }} />
          ) : (
            <AlertCircle style={{ width: "16px", height: "16px", color: "#fbbf24", marginTop: "1px", flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "0.74rem",
                fontWeight: 700,
                color: result.has_3d_prototype ? "#34d399" : "#fbbf24",
              }}
            >
              {result.has_3d_prototype ? "3D Prototype Available" : "3D Prototype Not Generated"}
            </div>
            <div style={{ fontSize: "0.66rem", color: "#94a3b8", marginTop: "2px" }}>
              {result.has_3d_prototype
                ? `${result.building_name || result.building_code || "Residential Building"} (${result.vertical_unit_count} vertical strata units)`
                : "2D Cadastral reference polygon is mapped on ground plane. 3D strata model has not been generated for this reference parcel."}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          {onFlyToParcel && (
            <button
              type="button"
              onClick={onFlyToParcel}
              style={{
                flex: 1,
                background: "rgba(56, 189, 248, 0.15)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                color: "#38bdf8",
                borderRadius: "6px",
                padding: "8px 10px",
                fontSize: "0.74rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
            >
              <Compass style={{ width: "13px", height: "13px" }} />
              <span>Fly to Parcel</span>
            </button>
          )}

          {result.has_3d_prototype && onInspect3D && (
            <button
              type="button"
              onClick={onInspect3D}
              style={{
                flex: 1.2,
                background: "rgba(16, 185, 129, 0.2)",
                border: "1px solid rgba(16, 185, 129, 0.5)",
                color: "#34d399",
                borderRadius: "6px",
                padding: "8px 10px",
                fontSize: "0.74rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
            >
              <Building2 style={{ width: "13px", height: "13px" }} />
              <span>Inspect 3D Strata</span>
            </button>
          )}
        </div>

        {/* Provenance and Disclaimer Note */}
        <div
          style={{
            fontSize: "0.62rem",
            color: "#64748b",
            lineHeight: 1.35,
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            paddingTop: "8px",
            fontStyle: "italic",
          }}
        >
          {result.disclaimer || "Synthetic/reference data — not a live government land-record lookup."}
        </div>
      </div>
    </div>
  );
};
