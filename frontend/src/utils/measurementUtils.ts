/**
 * Phase 3.6B: Interactive 3D Measurement & Spatial Interrogation Utilities.
 * Pure computational geometry and measurement state functions operating in EPSG:32644.
 */
import type {
  MeasuredPoint,
  MeasurementResult,
  MeasurementState,
  MeasurementMode,
  CoordinateHUDState,
} from "../types/cadastre";

export const DEFAULT_MEASUREMENT_STATE: MeasurementState = {
  mode: "OFF",
  pointA: null,
  pointB: null,
  result: null,
  statusMessage: null,
};

export const DEFAULT_COORD_HUD_STATE: CoordinateHUDState = {
  enabled: true,
  currentCoords: null,
};

/**
 * Calculates 3D Euclidean distance in meters between two points in EPSG:32644.
 * Formula: D_3D = sqrt((X2 - X1)^2 + (Y2 - Y1)^2 + (Z2 - Z1)^2)
 */
export function calculate3DDistance(p1: MeasuredPoint, p2: MeasuredPoint): number {
  const dx = p2.easting - p1.easting;
  const dy = p2.northing - p1.northing;
  const dz = p2.elevation - p1.elevation;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Number(dist.toFixed(2));
}

/**
 * Calculates Horizontal 2D distance in meters in EPSG:32644.
 * Formula: D_2D = sqrt((X2 - X1)^2 + (Y2 - Y1)^2)
 */
export function calculateHorizontalDistance(p1: MeasuredPoint, p2: MeasuredPoint): number {
  const dx = p2.easting - p1.easting;
  const dy = p2.northing - p1.northing;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Number(dist.toFixed(2));
}

/**
 * Calculates Vertical Differential (Delta Z) in meters.
 * Formula: Delta_Z = |Z2 - Z1|
 */
export function calculateDeltaZ(p1: MeasuredPoint, p2: MeasuredPoint): number {
  const dz = Math.abs(p2.elevation - p1.elevation);
  return Number(dz.toFixed(2));
}

/**
 * Computes all 3 measurement metrics for a pair of measured 3D points.
 */
export function computeMeasurementResult(
  p1: MeasuredPoint,
  p2: MeasuredPoint
): MeasurementResult {
  return {
    distance3D: calculate3DDistance(p1, p2),
    horizontalDistance: calculateHorizontalDistance(p1, p2),
    deltaZ: calculateDeltaZ(p1, p2),
  };
}

/**
 * Transitions the measurement subsystem to a new mode.
 */
export function setMeasurementMode(
  current: MeasurementState,
  mode: MeasurementMode
): MeasurementState {
  if (mode === "OFF") {
    return {
      ...DEFAULT_MEASUREMENT_STATE,
    };
  }

  // If we already have 2 points measured, recompute results for the new mode
  let result = current.result;
  if (current.pointA && current.pointB) {
    result = computeMeasurementResult(current.pointA, current.pointB);
  }

  return {
    ...current,
    mode,
    result,
    statusMessage: current.pointA
      ? current.pointB
        ? "Measurement active."
        : "Point A recorded. Click second point for measurement."
      : "Mode active. Click first 3D scene point.",
  };
}

/**
 * Registers a clicked 3D point in the measurement state.
 */
export function addMeasurementPoint(
  current: MeasurementState,
  point: MeasuredPoint
): MeasurementState {
  if (current.mode === "OFF") {
    return current;
  }

  if (!current.pointA || (current.pointA && current.pointB)) {
    // Start new measurement pair with Point A
    return {
      ...current,
      pointA: point,
      pointB: null,
      result: null,
      statusMessage: "Point A recorded. Click second point for measurement.",
    };
  }

  // Record Point B and compute results
  const result = computeMeasurementResult(current.pointA, point);
  return {
    ...current,
    pointB: point,
    result,
    statusMessage: "Measurement complete.",
  };
}

/**
 * Clears current measured points and results while preserving active measurement mode.
 */
export function clearMeasurement(current: MeasurementState): MeasurementState {
  return {
    ...current,
    pointA: null,
    pointB: null,
    result: null,
    statusMessage: current.mode !== "OFF" ? "Points cleared. Click first 3D scene point." : null,
  };
}

/**
 * Completely resets measurement state to default.
 */
export function resetMeasurementState(): MeasurementState {
  return { ...DEFAULT_MEASUREMENT_STATE };
}
