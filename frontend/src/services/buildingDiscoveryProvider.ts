/**
 * Phase 3.11C: Robust Building Discovery Provider
 * Identifies and normalizes OpenStreetMap building footprint candidates
 * using direct building detection, progressive radius expansion (180m -> 300m -> 500m),
 * candidate proximity tiering, and in-memory caching.
 */
import type { BuildingCandidate, LocationSearchResult } from "../types/cadastre";

export interface IBuildingDiscoveryProvider {
  discoverBuildings(
    latitude: number,
    longitude: number,
    searchContext?: LocationSearchResult | null,
    radiusMeters?: number
  ): Promise<BuildingCandidate[]>;
}

// Canonical OSM Way 356027047 geometry in EPSG:4326 WGS84 for Surya Heights demo fallback
const CANONICAL_SURYA_WGS84_FOOTPRINT: [number, number][] = [
  [78.361905, 17.464805],
  [78.361895, 17.464951],
  [78.362114, 17.464965],
  [78.362124, 17.464819],
  [78.361905, 17.464805],
];

/**
 * Calculates haversine distance in meters between two lat/lon coordinates.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates planar geodesic area of a polygon in square meters using local projection.
 */
export function calculatePolygonAreaSqm(
  coords: [number, number][],
  centerLat?: number
): number {
  if (!coords || coords.length < 3) return 0;
  const lat = centerLat !== undefined ? centerLat : coords[0][1];
  if (isNaN(lat)) return 0;

  const latToMeters = 111320;
  const lonToMeters = 111320 * Math.cos((lat * Math.PI) / 180);

  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const x1 = coords[i][0] * lonToMeters;
    const y1 = coords[i][1] * latToMeters;
    const x2 = coords[j][0] * lonToMeters;
    const y2 = coords[j][1] * latToMeters;
    area += x1 * y2 - x2 * y1;
  }
  return Math.round(Math.abs(area) / 2);
}

interface CacheEntry {
  timestamp: number;
  candidates: BuildingCandidate[];
}

/**
 * OpenStreetMap Overpass Building Discovery Provider with Progressive Search & Direct Matching
 */
export class OverpassBuildingDiscoveryProvider implements IBuildingDiscoveryProvider {
  private timeoutMs: number;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTtlMs: number = 10 * 60 * 1000; // 10 minutes cache TTL

  constructor(timeoutMs: number = 4500) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Clears in-memory query cache (useful for tests)
   */
  public clearCache(): void {
    this.cache.clear();
  }

  async discoverBuildings(
    latitude: number,
    longitude: number,
    searchContext?: LocationSearchResult | null,
    radiusMeters?: number
  ): Promise<BuildingCandidate[]> {
    if (isNaN(latitude) || isNaN(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return [];
    }

    // 1. Check in-memory cache
    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}_${searchContext?.osmId || ""}_${radiusMeters || "prog"}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.candidates;
    }

    try {
      let candidates: BuildingCandidate[] = [];

      // 2. Direct Building Result Detection (Phase 2)
      if (searchContext && this.isDirectBuildingResult(searchContext)) {
        const directCandidate = await this.fetchDirectBuildingCandidate(searchContext);
        if (directCandidate) {
          candidates.push(directCandidate);
        }
      }

      // 3. Progressive Building Discovery if no candidates found yet or to complement direct result
      if (candidates.length === 0) {
        if (radiusMeters && radiusMeters > 0) {
          // Explicit single radius requested
          candidates = await this.queryOverpassRadius(latitude, longitude, radiusMeters);
        } else {
          // Progressive search strategy: 180m -> 300m -> 500m
          const progressiveRadii = [180, 300, 500];
          for (const rad of progressiveRadii) {
            const found = await this.queryOverpassRadius(latitude, longitude, rad);
            if (found.length > 0) {
              candidates = found;
              break; // Stop progressive expansion as soon as candidates are discovered
            }
          }
        }
      }

      // 4. Candidate Ranking & Proximity Tiering (Phase 4)
      candidates = this.rankAndNormalizeCandidates(candidates, latitude, longitude);

      // 5. Fallback for Surya Heights demo if offline / fallback
      if (candidates.length === 0) {
        candidates = this.getFallbackCandidates(latitude, longitude);
      }

      // Store in cache
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        candidates,
      });

      return candidates;
    } catch (err: any) {
      // If network fails, try fallback
      const fallback = this.getFallbackCandidates(latitude, longitude);
      if (fallback.length > 0) {
        return fallback;
      }
      throw err;
    }
  }

  /**
   * Determines if a search result directly represents an OSM building.
   */
  private isDirectBuildingResult(result: LocationSearchResult): boolean {
    if (result.category === "building" || result.isReferenceBuilding) return true;
    if (result.osmType === "way" && result.type && ["apartments", "residential", "house", "commercial", "building", "monument", "historic", "yes"].includes(result.type)) {
      return true;
    }
    if (result.osmId && (result.osmId.startsWith("way/") || result.osmId.startsWith("relation/")) && result.category === "building") {
      return true;
    }
    return false;
  }

  /**
   * Directly fetches the geometry and metadata of an OSM building entity.
   */
  private async fetchDirectBuildingCandidate(result: LocationSearchResult): Promise<BuildingCandidate | null> {
    const rawOsmId = result.osmId || "";
    let osmType = result.osmType || "way";
    let numericId = "";

    if (rawOsmId.includes("/")) {
      const parts = rawOsmId.split("/");
      osmType = parts[0] as any;
      numericId = parts[1];
    } else if (/^\d+$/.test(rawOsmId)) {
      numericId = rawOsmId;
    }

    if (!numericId) return null;

    const query = `[out:json][timeout:6];(${osmType}(${numericId}););out geom;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "SIH26011-3D-ULPIN/1.0",
        },
      });

      clearTimeout(timer);

      if (!response.ok) return null;
      const data = await response.json();
      if (!data || !Array.isArray(data.elements) || data.elements.length === 0) return null;

      const el = data.elements[0];
      if (!Array.isArray(el.geometry) || el.geometry.length < 3) return null;

      const footprint: [number, number][] = el.geometry.map((pt: any) => [
        parseFloat(pt.lon),
        parseFloat(pt.lat),
      ]);

      let sumLat = 0;
      let sumLon = 0;
      el.geometry.forEach((pt: any) => {
        sumLat += pt.lat;
        sumLon += pt.lon;
      });
      const cLat = sumLat / el.geometry.length;
      const cLon = sumLon / el.geometry.length;

      const dist = calculateDistanceMeters(result.latitude, result.longitude, cLat, cLon);
      const area = calculatePolygonAreaSqm(footprint, cLat);
      const isSurya =
        el.id === 356027047 ||
        (Math.abs(cLat - 17.464877) < 0.0003 && Math.abs(cLon - 78.361956) < 0.0003);

      const tags = el.tags || {};
      const buildingType = tags.building && tags.building !== "yes" ? tags.building : (result.type || "building");
      const buildingName = tags.name || tags["addr:housename"] || result.displayName.split(",")[0] || undefined;
      const levels = tags["building:levels"] ? parseInt(tags["building:levels"], 10) : undefined;

      return {
        id: `osm-${el.type || osmType}-${el.id || numericId}`,
        osmId: `${el.type || osmType}/${el.id || numericId}`,
        osmType: el.type || osmType,
        source: "OpenStreetMap",
        name: buildingName,
        buildingType,
        levels,
        centroid: {
          latitude: Number(cLat.toFixed(6)),
          longitude: Number(cLon.toFixed(6)),
        },
        footprintCoordinates: footprint,
        approxAreaSqm: area || 250,
        distanceMeters: dist,
        modelAvailable: isSurya,
        buildingCode: isSurya ? "APARTMENT-SURYA-OSM" : undefined,
        parcelId: isSurya ? "36A1B2C3D4E5F9" : undefined,
        isDirectMatch: true,
        proximityTier: "EXACT_OR_VERY_NEAR",
        searchRadiusUsedMeters: 0,
        tags,
        attribution: "© OpenStreetMap contributors",
      };
    } catch {
      clearTimeout(timer);
      return null;
    }
  }

  /**
   * Queries Overpass API for building footprints within a specific radius around coordinates.
   */
  private async queryOverpassRadius(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<BuildingCandidate[]> {
    const query = `[out:json][timeout:6];(way["building"](around:${radiusMeters},${latitude},${longitude}););out geom 15;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "SIH26011-3D-ULPIN/1.0",
        },
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Overpass API returned status: ${response.status}`);
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.elements)) {
        return [];
      }

      const candidates: BuildingCandidate[] = [];

      for (const el of data.elements) {
        if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 3) {
          const footprint: [number, number][] = el.geometry.map((pt: any) => [
            parseFloat(pt.lon),
            parseFloat(pt.lat),
          ]);

          let sumLat = 0;
          let sumLon = 0;
          el.geometry.forEach((pt: any) => {
            sumLat += pt.lat;
            sumLon += pt.lon;
          });
          const cLat = sumLat / el.geometry.length;
          const cLon = sumLon / el.geometry.length;

          const dist = calculateDistanceMeters(latitude, longitude, cLat, cLon);
          const area = calculatePolygonAreaSqm(footprint, cLat);

          const isSurya =
            el.id === 356027047 ||
            (Math.abs(cLat - 17.464877) < 0.0003 && Math.abs(cLon - 78.361956) < 0.0003);

          const tags = el.tags || {};
          const buildingType = tags.building && tags.building !== "yes" ? tags.building : "building";
          const buildingName = tags.name || tags["addr:housename"] || undefined;
          const levels = tags["building:levels"] ? parseInt(tags["building:levels"], 10) : undefined;

          candidates.push({
            id: `osm-way-${el.id}`,
            osmId: `way/${el.id}`,
            osmType: "way",
            source: "OpenStreetMap",
            name: buildingName,
            buildingType,
            levels,
            centroid: {
              latitude: Number(cLat.toFixed(6)),
              longitude: Number(cLon.toFixed(6)),
            },
            footprintCoordinates: footprint,
            approxAreaSqm: area || 250,
            distanceMeters: dist,
            modelAvailable: isSurya,
            buildingCode: isSurya ? "APARTMENT-SURYA-OSM" : undefined,
            parcelId: isSurya ? "36A1B2C3D4E5F9" : undefined,
            searchRadiusUsedMeters: radiusMeters,
            tags,
            attribution: "© OpenStreetMap contributors",
          });
        }
      }

      return candidates;
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        throw new Error("Overpass API request timed out");
      }
      throw err;
    }
  }

  /**
   * Normalizes and ranks candidates based on direct match, distance, and tag completeness.
   */
  private rankAndNormalizeCandidates(
    candidates: BuildingCandidate[],
    searchLat: number,
    searchLon: number
  ): BuildingCandidate[] {
    // Remove duplicates by osmId
    const uniqueMap = new Map<string, BuildingCandidate>();
    for (const c of candidates) {
      if (!uniqueMap.has(c.osmId)) {
        uniqueMap.set(c.osmId, c);
      }
    }

    const normalized = Array.from(uniqueMap.values()).map((c) => {
      const dist =
        c.distanceMeters !== undefined
          ? c.distanceMeters
          : calculateDistanceMeters(searchLat, searchLon, c.centroid.latitude, c.centroid.longitude);
      const isVeryNear = dist <= 30 || c.isDirectMatch === true;

      return {
        ...c,
        distanceMeters: dist,
        proximityTier: (isVeryNear ? "EXACT_OR_VERY_NEAR" : "NEARBY") as "EXACT_OR_VERY_NEAR" | "NEARBY",
      };
    });

    // Ranking algorithm:
    // 1. Direct match first
    // 2. Ascending distance
    // 3. Named buildings or specific types before generic "building"
    // 4. Larger footprint area
    normalized.sort((a, b) => {
      if (a.isDirectMatch && !b.isDirectMatch) return -1;
      if (!a.isDirectMatch && b.isDirectMatch) return 1;

      if (a.distanceMeters !== b.distanceMeters) {
        return a.distanceMeters - b.distanceMeters;
      }

      const aHasName = !!a.name;
      const bHasName = !!b.name;
      if (aHasName && !bHasName) return -1;
      if (!aHasName && bHasName) return 1;

      return (b.approxAreaSqm || 0) - (a.approxAreaSqm || 0);
    });

    return normalized;
  }

  /**
   * Provides fallback candidate data if external network request is unavailable.
   */
  private getFallbackCandidates(latitude: number, longitude: number): BuildingCandidate[] {
    const isNearSurya =
      Math.abs(latitude - 17.464877) < 0.0015 && Math.abs(longitude - 78.361956) < 0.0015;

    if (isNearSurya) {
      const dist = calculateDistanceMeters(latitude, longitude, 17.464877, 78.361956);
      return [
        {
          id: "osm-way-356027047",
          osmId: "way/356027047",
          osmType: "way",
          source: "OpenStreetMap",
          name: "Surya Heights",
          buildingType: "apartments",
          centroid: {
            latitude: 17.464877,
            longitude: 78.361956,
          },
          footprintCoordinates: CANONICAL_SURYA_WGS84_FOOTPRINT,
          approxAreaSqm: 384,
          distanceMeters: dist,
          modelAvailable: true,
          buildingCode: "APARTMENT-SURYA-OSM",
          parcelId: "36A1B2C3D4E5F9",
          isDirectMatch: dist <= 30,
          proximityTier: dist <= 30 ? "EXACT_OR_VERY_NEAR" : "NEARBY",
          attribution: "© OpenStreetMap contributors",
        },
      ];
    }

    return [];
  }
}

// Export default singleton instance
export const defaultBuildingDiscoveryProvider = new OverpassBuildingDiscoveryProvider();
