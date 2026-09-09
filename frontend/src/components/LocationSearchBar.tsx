import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  X,
  Loader2,
  MapPin,
  Building2,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import type { LocationSearchResult, ParcelULPINLookupResult, SearchMode } from "../types/cadastre";
import { defaultLocationSearchProvider, CANONICAL_DEMO_PRESETS } from "../services/locationSearchProvider";
import { lookupParcelByULPIN } from "../api/cadastreApi";

export const CANONICAL_ULPIN_PRESETS: {
  ulpin: string;
  name: string;
  location: string;
  modelAvailable: boolean;
}[] = [
  {
    ulpin: "36A1B2C3D4E5F9",
    name: "Surya Heights — G+5 + Basement (OSM Reference Anchor)",
    location: "Kondapur, Hyderabad",
    modelAvailable: true,
  },
  {
    ulpin: "36982341201B3E",
    name: "Moosapet Reference Cadastral Parcel",
    location: "Moosapet, Hyderabad",
    modelAvailable: false,
  },
  {
    ulpin: "27A8B9C3D4E5F6",
    name: "Tech Residency Tower A (Synthetic Research Strata)",
    location: "Tech City, Hyderabad",
    modelAvailable: true,
  },
];

interface LocationSearchBarProps {
  onSelectLocation: (result: LocationSearchResult) => void;
  onClearLocation?: () => void;
  activeLocation?: LocationSearchResult | null;
  onSelectULPIN?: (result: ParcelULPINLookupResult) => void;
  onClearULPIN?: () => void;
  activeULPIN?: ParcelULPINLookupResult | null;
}

export const LocationSearchBar: React.FC<LocationSearchBarProps> = ({
  onSelectLocation,
  onClearLocation,
  activeLocation,
  onSelectULPIN,
  onClearULPIN,
  activeULPIN,
}) => {
  const [searchMode, setSearchMode] = useState<SearchMode>("ADDRESS");
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Sync query when activeLocation or activeULPIN changes from outside
  useEffect(() => {
    if (searchMode === "ADDRESS" && activeLocation) {
      setQuery(activeLocation.displayName.split(",")[0]);
    } else if (searchMode === "ULPIN" && activeULPIN) {
      setQuery(activeULPIN.ulpin);
    }
  }, [activeLocation, activeULPIN, searchMode]);

  // Click outside listener to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target as Node)) {
        setIsModeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitchMode = (newMode: SearchMode) => {
    setSearchMode(newMode);
    setIsModeDropdownOpen(false);
    setQuery("");
    setResults([]);
    setError(null);
    setHasSearched(false);
    setIsOpen(false);
    if (newMode === "ADDRESS" && onClearULPIN) {
      onClearULPIN();
    } else if (newMode === "ULPIN" && onClearLocation) {
      onClearLocation();
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const executeAddressSearch = async (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await defaultLocationSearchProvider.search(trimmed);
      setResults(data);
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (err: any) {
      console.warn("Location geocoding error:", err);
      setError(err?.message || "Unable to search location. Please try again.");
      setResults([]);
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const executeULPINLookup = async (ulpinToLookup: string) => {
    const clean = ulpinToLookup.trim().toUpperCase();
    if (!clean) {
      setError("Enter a valid 14-character ULPIN.");
      setIsOpen(true);
      return;
    }

    // Strict 14-character alphanumeric validation before backend query
    if (clean.length !== 14 || !/^[A-Z0-9]{14}$/.test(clean)) {
      setError("Enter a valid 14-character ULPIN.");
      setIsOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await lookupParcelByULPIN(clean);
      setIsOpen(false);
      setError(null);
      if (onSelectULPIN) {
        onSelectULPIN(res);
      }
    } catch (err: any) {
      console.warn("ULPIN lookup error:", err);
      setError(err.message || "No registered prototype/reference parcel was found for this ULPIN.");
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setError(null);

    if (searchMode === "ULPIN") {
      // Auto-uppercase and filter alphanumeric for ULPIN mode
      const sanitized = value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 14).toUpperCase();
      setQuery(sanitized);
      setHasSearched(false);
    } else {
      setQuery(value);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (value.trim().length >= 2) {
        setIsLoading(true);
        setIsOpen(true);
        debounceTimerRef.current = setTimeout(() => {
          executeAddressSearch(value);
        }, 400);
      } else {
        setResults([]);
        setHasSearched(false);
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (searchMode === "ADDRESS") {
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (searchMode === "ADDRESS") {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchMode === "ULPIN") {
        executeULPINLookup(query);
      } else {
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelectAddress(results[selectedIndex]);
        } else if (query.trim().length >= 2) {
          executeAddressSearch(query);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleSelectAddress = (result: LocationSearchResult) => {
    setQuery(result.displayName.split(",")[0]);
    setIsOpen(false);
    onSelectLocation(result);
  };

  const handleSelectULPINPreset = (preset: { ulpin: string }) => {
    setQuery(preset.ulpin);
    executeULPINLookup(preset.ulpin);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setIsOpen(false);
    setHasSearched(false);
    if (searchMode === "ADDRESS" && onClearLocation) {
      onClearLocation();
    } else if (searchMode === "ULPIN" && onClearULPIN) {
      onClearULPIN();
    }
    inputRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className="location-search-bar-container"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "480px",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Integrated Search Container */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          background: "rgba(15, 23, 42, 0.90)",
          backdropFilter: "blur(12px)",
          border: error
            ? "1px solid rgba(239, 68, 68, 0.6)"
            : "1px solid rgba(56, 189, 248, 0.32)",
          borderRadius: "8px",
          padding: "3px 6px",
          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.35)",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        {/* Mode Selector Dropdown Button */}
        <div ref={modeDropdownRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
            style={{
              background: searchMode === "ULPIN" ? "rgba(16, 185, 129, 0.18)" : "rgba(56, 189, 248, 0.15)",
              border: searchMode === "ULPIN" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(56, 189, 248, 0.35)",
              borderRadius: "5px",
              padding: "3px 8px",
              color: searchMode === "ULPIN" ? "#34d399" : "#38bdf8",
              fontSize: "0.72rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginRight: "6px",
              whiteSpace: "nowrap",
            }}
            title="Switch Search Mode"
          >
            {searchMode === "ULPIN" ? (
              <span>🏢 ULPIN</span>
            ) : (
              <span>📍 Address</span>
            )}
            <ChevronDown style={{ width: "12px", height: "12px", opacity: 0.8 }} />
          </button>

          {/* Mode Switcher Popover */}
          {isModeDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                background: "rgba(15, 23, 42, 0.98)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: "6px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
                zIndex: 1001,
                minWidth: "180px",
                padding: "4px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <div
                style={{
                  padding: "4px 8px",
                  fontSize: "0.64rem",
                  color: "#64748b",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Search Mode
              </div>
              <button
                type="button"
                onClick={() => handleSwitchMode("ADDRESS")}
                style={{
                  background: searchMode === "ADDRESS" ? "rgba(56, 189, 248, 0.15)" : "transparent",
                  border: "none",
                  borderRadius: "4px",
                  padding: "6px 8px",
                  textAlign: "left",
                  color: searchMode === "ADDRESS" ? "#38bdf8" : "#cbd5e1",
                  fontSize: "0.72rem",
                  fontWeight: searchMode === "ADDRESS" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <MapPin style={{ width: "13px", height: "13px", color: "#38bdf8" }} />
                <span>Address / Location</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchMode("ULPIN")}
                style={{
                  background: searchMode === "ULPIN" ? "rgba(16, 185, 129, 0.15)" : "transparent",
                  border: "none",
                  borderRadius: "4px",
                  padding: "6px 8px",
                  textAlign: "left",
                  color: searchMode === "ULPIN" ? "#34d399" : "#cbd5e1",
                  fontSize: "0.72rem",
                  fontWeight: searchMode === "ULPIN" ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Building2 style={{ width: "13px", height: "13px", color: "#34d399" }} />
                <span>ULPIN / Bhu-Aadhaar</span>
              </button>
            </div>
          )}
        </div>

        {/* Search Input Box */}
        <Search
          style={{
            width: "14px",
            height: "14px",
            color: searchMode === "ULPIN" ? "#34d399" : "#38bdf8",
            marginRight: "6px",
            flexShrink: 0,
          }}
        />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={
            searchMode === "ULPIN"
              ? "Enter 14-char ULPIN (e.g. 36A1B2C3D4E5F9)..."
              : "Search address / location (e.g. Kondapur, Moosapet)..."
          }
          maxLength={searchMode === "ULPIN" ? 14 : undefined}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#f8fafc",
            fontSize: "0.78rem",
            fontWeight: 500,
            fontFamily: searchMode === "ULPIN" ? "monospace" : "inherit",
            letterSpacing: searchMode === "ULPIN" ? "0.04em" : "normal",
          }}
        />

        {searchMode === "ULPIN" && (
          <button
            type="button"
            onClick={() => executeULPINLookup(query)}
            disabled={isLoading}
            style={{
              background: "rgba(16, 185, 129, 0.25)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#34d399",
              borderRadius: "4px",
              padding: "3px 8px",
              fontSize: "0.70rem",
              fontWeight: 700,
              cursor: "pointer",
              marginRight: "4px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {isLoading ? (
              <Loader2 style={{ width: "11px", height: "11px", animation: "spin 1s linear infinite" }} />
            ) : null}
            <span>Search</span>
          </button>
        )}

        {isLoading && searchMode === "ADDRESS" ? (
          <Loader2
            style={{
              width: "14px",
              height: "14px",
              color: "#38bdf8",
              animation: "spin 1s linear infinite",
              flexShrink: 0,
            }}
          />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
              alignItems: "center",
            }}
            title="Clear search"
          >
            <X style={{ width: "14px", height: "14px" }} />
          </button>
        ) : null}
      </div>

      {/* Autocomplete / Presets / Error Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "rgba(15, 23, 42, 0.96)",
            backdropFilter: "blur(16px)",
            border: searchMode === "ULPIN" ? "1px solid rgba(52, 211, 153, 0.3)" : "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.55)",
            maxHeight: "320px",
            overflowY: "auto",
            zIndex: 1000,
          }}
        >
          {/* SEARCH MODE: ADDRESS */}
          {searchMode === "ADDRESS" ? (
            isLoading && results.length === 0 ? (
              <div style={{ padding: "14px 12px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <Loader2 style={{ width: "14px", height: "14px", color: "#38bdf8", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Searching locations on OpenStreetMap...</span>
              </div>
            ) : error ? (
              <div style={{ padding: "14px 12px", textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", color: "#f87171", fontSize: "0.76rem", fontWeight: 600, marginBottom: "4px" }}>
                  <AlertTriangle style={{ width: "14px", height: "14px" }} />
                  <span>Unable to search location.</span>
                </div>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{error}</div>
              </div>
            ) : results.length > 0 ? (
              <div style={{ padding: "4px 0" }}>
                <div
                  style={{
                    padding: "4px 10px",
                    fontSize: "0.66rem",
                    color: "#64748b",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Matching Locations ({results.length})</span>
                  <span style={{ color: "#38bdf8", fontWeight: 400 }}>Nominatim</span>
                </div>

                {results.map((result, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={result.id || idx}
                      onClick={() => handleSelectAddress(result)}
                      style={{
                        padding: "8px 10px",
                        cursor: "pointer",
                        background: isSelected ? "rgba(56, 189, 248, 0.15)" : "transparent",
                        borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        transition: "background 0.15s",
                      }}
                    >
                      {result.modelAvailable ? (
                        <Building2 style={{ width: "16px", height: "16px", color: "#34d399", marginTop: "2px", flexShrink: 0 }} />
                      ) : (
                        <MapPin style={{ width: "16px", height: "16px", color: "#38bdf8", marginTop: "2px", flexShrink: 0 }} />
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color: isSelected ? "#38bdf8" : "#f8fafc",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {result.displayName}
                        </div>

                        <div
                          style={{
                            fontSize: "0.70rem",
                            color: "#94a3b8",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginTop: "2px",
                          }}
                        >
                          <span>
                            {result.latitude.toFixed(4)}°N, {result.longitude.toFixed(4)}°E
                          </span>
                          {result.osmId && (
                            <span style={{ color: "#64748b", fontFamily: "monospace" }}>
                              OSM: {result.osmId}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ flexShrink: 0 }}>
                        {result.modelAvailable ? (
                          <span
                            style={{
                              background: "rgba(16, 185, 129, 0.2)",
                              color: "#34d399",
                              border: "1px solid rgba(16, 185, 129, 0.4)",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              fontSize: "0.64rem",
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            ✓ 3D Model
                          </span>
                        ) : (
                          <span
                            style={{
                              background: "rgba(100, 116, 139, 0.2)",
                              color: "#94a3b8",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              fontSize: "0.64rem",
                              fontWeight: 500,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Map Ref
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : hasSearched ? (
              <div style={{ padding: "16px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "0.78rem", color: "#f87171", fontWeight: 600, marginBottom: "4px" }}>
                  No matching location found.
                </div>
                <div style={{ fontSize: "0.70rem", color: "#94a3b8" }}>
                  Check address spelling or try broader terms (e.g. "Banjara Hills", "Secunderabad", "Moosapet").
                </div>
              </div>
            ) : (
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Quick Location Presets:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {CANONICAL_DEMO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectAddress(preset)}
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "4px",
                        padding: "5px 8px",
                        textAlign: "left",
                        color: "#cbd5e1",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{preset.displayName.split(",")[0]}</span>
                      <span style={{ color: preset.modelAvailable ? "#34d399" : "#64748b", fontSize: "0.65rem", fontWeight: preset.modelAvailable ? 700 : 400 }}>
                        {preset.modelAvailable ? "3D Available" : "Map Only"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
          ) : (
            /* SEARCH MODE: ULPIN / BHU-AADHAAR */
            <div style={{ padding: "10px 12px" }}>
              {error ? (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "6px",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f87171", fontSize: "0.76rem", fontWeight: 700 }}>
                    <AlertTriangle style={{ width: "14px", height: "14px" }} />
                    <span>ULPIN Lookup Notice</span>
                  </div>
                  <div style={{ fontSize: "0.70rem", color: "#fca5a5", marginTop: "4px" }}>
                    {error}
                  </div>
                </div>
              ) : null}

              <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: "6px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Reference ULPIN Registry Presets:
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {CANONICAL_ULPIN_PRESETS.map((preset) => (
                  <button
                    key={preset.ulpin}
                    type="button"
                    onClick={() => handleSelectULPINPreset(preset)}
                    style={{
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "6px",
                      padding: "7px 10px",
                      textAlign: "left",
                      color: "#cbd5e1",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 800, color: "#38bdf8", fontSize: "0.78rem" }}>
                        {preset.ulpin}
                      </span>
                      <span
                        style={{
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: "4px",
                          background: preset.modelAvailable ? "rgba(16, 185, 129, 0.2)" : "rgba(100, 116, 139, 0.2)",
                          color: preset.modelAvailable ? "#34d399" : "#94a3b8",
                        }}
                      >
                        {preset.modelAvailable ? "✓ 3D Available" : "Map Reference"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.70rem", color: "#e2e8f0", fontWeight: 600 }}>
                      {preset.name}
                    </div>
                    <div style={{ fontSize: "0.64rem", color: "#94a3b8" }}>
                      {preset.location}
                    </div>
                  </button>
                ))}
              </div>

              <div
                style={{
                  marginTop: "10px",
                  paddingTop: "6px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                  fontSize: "0.62rem",
                  color: "#64748b",
                  lineHeight: 1.3,
                }}
              >
                Source: Prototype ULPIN Reference Registry (Synthetic Demonstration Data).
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
