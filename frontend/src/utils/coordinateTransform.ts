/**
 * Coordinate Transformation Utility (EPSG:32644 UTM Zone 44N -> WGS84 Geographic)
 */
import proj4 from "proj4";

// Define EPSG:32644 (UTM Zone 44N, WGS84 ellipsoid)
proj4.defs(
  "EPSG:32644",
  "+proj=utm +zone=44 +datum=WGS84 +units=m +no_defs +type=crs"
);

/**
 * Canonical Visual Ground Elevation for the demonstration dataset.
 * The stored prototype Z elevation of the ground surface is 540.00 m.
 * In Cesium's EllipsoidTerrainProvider visualization, this is mapped to 0.00 m
 * so that the building sits physically on the ground plane/parcel surface.
 */
export const CANONICAL_VISUAL_GROUND_Z = 540.0;

/**
 * Transforms stored prototype vertical elevation Z (m) into Cesium local visual rendering height (m).
 * render_z = prototype_z - ground_z
 */
export function prototypeZToViewerHeight(
  prototypeZ: number,
  groundZ: number = CANONICAL_VISUAL_GROUND_Z
): number {
  return prototypeZ - groundZ;
}

/**
 * Transforms Cesium local visual rendering height (m) back to stored prototype vertical elevation Z (m).
 * prototype_z = viewer_height + ground_z
 */
export function viewerHeightToPrototypeZ(
  viewerHeight: number,
  groundZ: number = CANONICAL_VISUAL_GROUND_Z
): number {
  return viewerHeight + groundZ;
}

/**
 * Transforms a single [X, Y, Z] coordinate from EPSG:32644 to WGS84 [Longitude, Latitude, Height_m].
 */
export function transform32644ToWGS84(
  x: number,
  y: number,
  z: number = 0
): [number, number, number] {
  const [lon, lat] = proj4("EPSG:32644", "EPSG:4326", [x, y]);
  return [lon, lat, z];
}

/**
 * Transforms an array of 2D coordinates [[x, y], ...] to WGS84 [[lon, lat], ...].
 */
export function transform2DCoordinates(coords: number[][]): [number, number][] {
  return coords.map(([x, y]) => {
    const [lon, lat] = proj4("EPSG:32644", "EPSG:4326", [x, y]);
    return [lon, lat];
  });
}

/**
 * Transforms 3D PolyhedralSurface facet rings to WGS84 coordinates.
 */
export function transformPolyhedralCoordinates(
  faces: number[][][][]
): [number, number, number][][][] {
  return faces.map((face) =>
    face.map((ring) =>
      ring.map(([x, y, z]) => transform32644ToWGS84(x, y, z))
    )
  );
}

/**
 * Transforms WGS84 Geographic coordinates [Longitude, Latitude, Height_m] to EPSG:32644 [Easting, Northing, Elevation_m].
 */
export function transformWGS84To32644(
  lon: number,
  lat: number,
  height: number = 0
): [number, number, number] {
  const [easting, northing] = proj4("EPSG:4326", "EPSG:32644", [lon, lat]);
  return [easting, northing, height];
}

