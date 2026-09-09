import React from "react";
import { Building2 } from "lucide-react";
import type { Parcel, LocationSearchResult, ParcelULPINLookupResult } from "../types/cadastre";
import { LocationSearchBar } from "./LocationSearchBar";

interface HeaderProps {
  parcels: Parcel[];
  selectedParcel: Parcel | null;
  onSelectParcel: (parcel: Parcel) => void;
  isConnected: boolean;
  onOpenIngestion?: () => void;
  onSelectLocation?: (result: LocationSearchResult) => void;
  onClearLocation?: () => void;
  activeLocation?: LocationSearchResult | null;
  onSelectULPIN?: (result: ParcelULPINLookupResult) => void;
  onClearULPIN?: () => void;
  activeULPIN?: ParcelULPINLookupResult | null;
}

export const Header: React.FC<HeaderProps> = ({
  parcels,
  selectedParcel,
  onSelectParcel,
  isConnected,
  onOpenIngestion,
  onSelectLocation,
  onClearLocation,
  activeLocation,
  onSelectULPIN,
  onClearULPIN,
  activeULPIN,
}) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand-logo">
          <span style={{ fontSize: "1.45rem", lineHeight: 1 }}>🇮🇳</span>
          <div className="brand-text">
            <h1 style={{ fontSize: "1.02rem", fontWeight: 800, letterSpacing: "-0.01em", color: "#f8fafc" }}>
              3D CADASTRAL PROPERTY
            </h1>
            <span className="brand-subtitle" style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
              India · Hyderabad, Telangana — Surya Heights
            </span>
          </div>
        </div>
        <span className="badge prototype-badge" style={{ marginLeft: "6px" }}>Research Prototype</span>
      </div>

      <div className="header-center" style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, maxWidth: "680px", justifyContent: "center" }}>
        {onSelectLocation && (
          <LocationSearchBar
            onSelectLocation={onSelectLocation}
            onClearLocation={onClearLocation}
            activeLocation={activeLocation}
            onSelectULPIN={onSelectULPIN}
            onClearULPIN={onClearULPIN}
            activeULPIN={activeULPIN}
          />
        )}

        {parcels.length > 1 && selectedParcel && (
          <div className="parcel-selector-container">
            <Building2 style={{ width: "14px", height: "14px", color: "#38bdf8" }} />
            <select
              className="parcel-select"
              value={selectedParcel.id}
              onChange={(e) => {
                const found = parcels.find((p) => p.id === e.target.value);
                if (found) onSelectParcel(found);
              }}
              title="Switch Demonstration Property"
            >
              {parcels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ulpin_2d === "36A1B2C3D4E5F9"
                    ? "Surya Heights — G+5 + Basement"
                    : p.ulpin_2d === "36A1B2C3D4E5F8"
                    ? "Surya Heights (Synthetic)"
                    : `${p.ulpin_2d}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="header-right">
        {onOpenIngestion && (
          <button
            type="button"
            className="chip ingestion-btn-chip"
            onClick={onOpenIngestion}
            style={{
              backgroundColor: "rgba(30, 41, 59, 0.8)",
              color: "#38bdf8",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "6px",
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: "0.76rem",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontWeight: 600
            }}
            title="Open Ingestion & Dataset Tools"
          >
            <span>Technical Workspace</span>
          </button>
        )}

        <div
          className={`chip status-chip ${isConnected ? "online" : "offline"}`}
          style={{ padding: "4px 8px", fontSize: "0.72rem" }}
          title={isConnected ? "3D Solid Cadastral Engine Online" : "Connecting..."}
        >
          <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: isConnected ? "#10b981" : "#ef4444" }} />
          <span>{isConnected ? "Connected" : "Offline"}</span>
        </div>
      </div>
    </header>
  );
};
