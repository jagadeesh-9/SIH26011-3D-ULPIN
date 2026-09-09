"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 2.9: Explainable AI-Assisted 3D Candidate Extraction Service

This service acts strictly as an AI CANDIDATE PROPOSER and EXPLAINABILITY ENGINE.
It generates explainable 3D vertical property candidate hypotheses from spatial evidence
(LiDAR point clouds, building extractions, BIM/CAD metadata).

DISCLAIMER:
Research Prototype Only.
The AI component is an algorithmic proposer and DOES NOT possess verification authority.
It does not perform legal title determination, ownership certification, or official ULPIN assignment.
Human-in-the-loop verification by an authorized surveyor or revenue official remains mandatory.
"""
import os
import json
import uuid
import math
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from shapely.geometry import shape, Polygon, box
from shapely import wkt
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.schemas.responses import (
    AICandidateFeatureVector,
    AICandidateProposal,
    AICandidateAnalysisResponse,
    AIProposeCandidatesResponse
)
from backend.app.schemas.requests import AIProposeCandidatesRequest
from scripts.reconstruct_3d_units import build_polyhedralsurface_wkt_from_footprint


class AICandidateService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db

    def extract_features_from_geometry_and_points(
        self,
        footprint_poly: Polygon,
        z_min: float,
        z_max: float,
        ground_z: float = 540.0,
        roof_z: float = 549.5,
        las_z_coords: Optional[np.ndarray] = None,
        las_x_coords: Optional[np.ndarray] = None,
        las_y_coords: Optional[np.ndarray] = None,
        source_evidence_type: str = "LIDAR_POINTCLOUD",
        is_synthetic: bool = True
    ) -> AICandidateFeatureVector:
        """
        Extracts spatial, geometric, vertical, and point-cloud statistical features
        for a vertical unit candidate interval.
        """
        # 1. Geometric Features
        area = float(footprint_poly.area)
        perimeter = float(footprint_poly.length)
        compactness = (4.0 * math.pi * area) / (perimeter ** 2) if perimeter > 0 else 0.0
        
        minx, miny, maxx, maxy = footprint_poly.bounds
        width = float(maxx - minx)
        length = float(maxy - miny)
        aspect_ratio = float(min(width, length) / max(width, length)) if max(width, length) > 0 else 1.0
        
        centroid = footprint_poly.centroid
        centroid_x = float(centroid.x)
        centroid_y = float(centroid.y)

        # 2. Vertical Features
        interval_height = float(z_max - z_min)
        building_total_height = max(roof_z - ground_z, 1.0)
        relative_height_ratio = float(max(0.0, (z_min - ground_z)) / building_total_height)

        # 3. Point Cloud Statistical Features
        point_count = 0
        point_density = 0.0
        z_mean = float((z_min + z_max) / 2.0)
        z_std = 0.0
        z_p25 = float(z_min + 0.25 * interval_height)
        z_p50 = float(z_min + 0.50 * interval_height)
        z_p75 = float(z_min + 0.75 * interval_height)
        z_p90 = float(z_min + 0.90 * interval_height)
        peak_prominence_ratio = 1.0

        if las_z_coords is not None:
            if len(las_z_coords) > 0:
                if las_x_coords is not None and las_y_coords is not None:
                    # Spatial mask
                    in_bbox = (
                        (las_x_coords >= minx - 0.5) & (las_x_coords <= maxx + 0.5) &
                        (las_y_coords >= miny - 0.5) & (las_y_coords <= maxy + 0.5) &
                        (las_z_coords >= z_min - 0.05) & (las_z_coords <= z_max + 0.05)
                    )
                    interval_z = las_z_coords[in_bbox]
                else:
                    in_z = (las_z_coords >= z_min - 0.05) & (las_z_coords <= z_max + 0.05)
                    interval_z = las_z_coords[in_z]

                point_count = int(len(interval_z))
                volume_m3 = max(area * interval_height, 0.1)
                point_density = float(point_count / volume_m3)

                if point_count > 0:
                    z_mean = float(np.mean(interval_z))
                    z_std = float(np.std(interval_z))
                    z_p25 = float(np.percentile(interval_z, 25))
                    z_p50 = float(np.percentile(interval_z, 50))
                    z_p75 = float(np.percentile(interval_z, 75))
                    z_p90 = float(np.percentile(interval_z, 90))

                    # Baseline density comparison
                    total_bldg_vol = area * building_total_height
                    mean_bldg_density = len(las_z_coords) / max(total_bldg_vol, 1.0)
                    peak_prominence_ratio = float(point_density / max(mean_bldg_density, 0.001))
                else:
                    peak_prominence_ratio = 0.5
            else:
                point_count = 0
                point_density = 0.0
                peak_prominence_ratio = 0.5
        elif source_evidence_type in ["BIM_IFC", "ARCHITECTURAL_PLAN_2D", "CORS_GNSS_SURVEY"]:
            # Structural/CAD models have deterministic volumetric representation
            point_count = 1000
            volume_m3 = max(area * interval_height, 0.1)
            point_density = float(point_count / volume_m3)
            peak_prominence_ratio = 2.5

        return AICandidateFeatureVector(
            footprint_area_sqm=round(area, 2),
            footprint_perimeter_m=round(perimeter, 2),
            footprint_compactness=round(compactness, 4),
            aspect_ratio=round(aspect_ratio, 4),
            centroid_x=round(centroid_x, 3),
            centroid_y=round(centroid_y, 3),
            z_min=round(z_min, 2),
            z_max=round(z_max, 2),
            height_interval_m=round(interval_height, 2),
            relative_height_ratio=round(relative_height_ratio, 4),
            point_count=point_count,
            point_density_pts_m3=round(point_density, 2),
            z_mean=round(z_mean, 2),
            z_std=round(z_std, 3),
            z_p25=round(z_p25, 2),
            z_p50=round(z_p50, 2),
            z_p75=round(z_p75, 2),
            z_p90=round(z_p90, 2),
            peak_prominence_ratio=round(peak_prominence_ratio, 2),
            source_evidence_type=source_evidence_type,
            is_synthetic=is_synthetic
        )

    def classify_and_explain_candidate(
        self,
        features: AICandidateFeatureVector,
        ground_z: float = 540.0,
        roof_z: float = 549.5,
        candidate_index: int = 1,
        building_id: str = "TOWER-A"
    ) -> Tuple[str, str, str, str, str, str, float, List[str], List[str], Dict[str, Any]]:
        """
        Classifies candidate strata tier, unit type, and floor code,
        evaluates underground safety, generates explainability rationale, and calculates
        prototype candidate confidence.
        """
        z_min = features.z_min
        z_max = features.z_max
        height = features.height_interval_m
        src = features.source_evidence_type
        
        explanation: List[str] = []
        review_flags: List[str] = ["AI_PROPOSED_CANDIDATE", "HUMAN_VERIFICATION_REQUIRED"]
        underground_safety: Dict[str, Any] = {"is_safe": True, "notes": "Evidence compatible with stratum"}

        # 1. Stratum & Tier Classification
        if z_max <= ground_z + 0.05:
            # Underground / Subsurface
            if src == "LIDAR_POINTCLOUD":
                # STRICT HARD CONSTRAINT: Optical LiDAR cannot penetrate underground
                underground_safety = {
                    "is_safe": False,
                    "violation": "Optical airborne LiDAR cannot detect underground geometry.",
                    "requires_evidence": ["BIM_IFC", "ARCHITECTURAL_PLAN_2D", "CORS_GNSS_SURVEY"]
                }
                review_flags.append("FLAG_REJECT_UNDERGROUND_LIDAR")
                tier_code = "SB"
                floor_code = f"B0{candidate_index}"
                candidate_type = "BASEMENT"
                suggested_unit_type = "COMMERCIAL"
                suggested_label = f"Proposed Basement Candidate ({floor_code})"
                explanation.append(
                    "⚠️ VIOLATION: Airborne optical LiDAR cannot detect underground subterranean spaces. "
                    "Proposal requires BIM/IFC or architectural plan evidence before cadastral review."
                )
            elif height <= 2.5 or "UTILITY" in src or "CORS" in src:
                tier_code = "UT"
                floor_code = f"UT0{candidate_index}"
                candidate_type = "UNDERGROUND_UTILITY"
                suggested_unit_type = "UTILITY_CORRIDOR"
                suggested_label = f"Subsurface Utility Corridor ({floor_code})"
                explanation.append(f"Subsurface utility conduit hypothesis (Z: {z_min}m to {z_max}m) derived from {src}.")
            else:
                tier_code = "SB"
                floor_code = f"B0{candidate_index}"
                candidate_type = "BASEMENT"
                suggested_unit_type = "PARKING" if height >= 3.0 else "COMMERCIAL"
                suggested_label = f"Underground Substructure ({floor_code})"
                explanation.append(f"Subterranean basement structural hypothesis (Z: {z_min}m to {z_max}m) supported by {src}.")

        elif z_min <= ground_z + 0.5:
            # Ground Level
            tier_code = "F"
            floor_code = "F00"
            candidate_type = "GROUND_FLOOR"
            suggested_unit_type = "COMMERCIAL"
            suggested_label = "Ground Floor Commercial Lobby & Entry"
            explanation.append(f"Ground-level interface detected at elevation {z_min:.2f}m (ground datum: {ground_z:.2f}m).")
            explanation.append(f"Floor height interval ({height:.2f}m) conforms to standard ground lobby priors.")

        elif z_min >= roof_z - 0.5:
            # Rooftop / Elevated
            tier_code = "AR"
            floor_code = "RF01"
            candidate_type = "ROOFTOP"
            suggested_unit_type = "COMMON_CIRCULATION"
            suggested_label = "Rooftop Structure & Terrace Candidate"
            explanation.append(f"Rooftop structural termination detected above main building envelope at {z_min:.2f}m.")

        else:
            # Upper Floor
            tier_code = "F"
            floor_num = candidate_index
            floor_code = f"F{floor_num:02d}"
            candidate_type = "UPPER_FLOOR"
            suggested_unit_type = "RESIDENTIAL"
            suggested_label = f"Upper Storey Floor Candidate ({floor_code})"
            explanation.append(f"Intermediate vertical floor interval detected from {z_min:.2f}m to {z_max:.2f}m.")

        # 2. Point Density & Geometric Explanations
        if features.peak_prominence_ratio >= 1.8:
            explanation.append(
                f"Strong vertical structural density peak detected (prominence ratio: {features.peak_prominence_ratio:.2f}x baseline)."
            )
        elif features.peak_prominence_ratio >= 1.0:
            explanation.append(
                f"Moderate structural point density support (prominence ratio: {features.peak_prominence_ratio:.2f}x)."
            )
        else:
            explanation.append("Low local point density support; requires human reviewer attention.")
            review_flags.append("LOW_POINT_DENSITY_WARNING")

        if 2.7 <= height <= 3.8:
            explanation.append(f"Storey interval height ({height:.2f}m) conforms to standard architectural storey priors (2.7m - 3.8m).")
        else:
            explanation.append(f"Non-standard vertical interval height ({height:.2f}m); flagged for review.")
            review_flags.append("NON_STANDARD_HEIGHT_INTERVAL")

        if features.footprint_compactness >= 0.70:
            explanation.append(f"Horizontal footprint demonstrates high structural regularity (compactness: {features.footprint_compactness:.2f}).")

        explanation.append(f"Evidence source: {src} (marked as SYNTHETIC research prototype data).")

        # 3. Calculate Prototype Candidate Confidence
        # Heuristic scoring based on multi-factor feature support
        score = 0.0
        
        # Density peak contribution (0.0 to 0.35)
        if features.peak_prominence_ratio >= 2.0:
            score += 0.35
        elif features.peak_prominence_ratio >= 1.2:
            score += 0.25
        else:
            score += 0.10

        # Height prior conformity (0.0 to 0.25)
        if 2.8 <= height <= 3.5:
            score += 0.25
        elif 2.5 <= height <= 4.0:
            score += 0.15
        else:
            score += 0.05

        # Footprint regularity (0.0 to 0.20)
        if features.footprint_compactness >= 0.70:
            score += 0.20
        elif features.footprint_compactness >= 0.50:
            score += 0.12
        else:
            score += 0.05

        # Evidence compatibility (0.0 to 0.20)
        if not underground_safety["is_safe"]:
            score = min(score, 0.20)  # Penalize unsafe underground LiDAR proposals
        else:
            score += 0.20

        score = round(min(max(score, 0.10), 0.98), 2)

        if score >= 0.75:
            confidence = "HIGH"
        elif score >= 0.50:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        return (
            tier_code,
            floor_code,
            candidate_type,
            suggested_unit_type,
            suggested_label,
            confidence,
            score,
            explanation,
            review_flags,
            underground_safety
        )

    def propose_candidates(
        self,
        req: AIProposeCandidatesRequest
    ) -> AIProposeCandidatesResponse:
        """
        Executes explainable AI candidate extraction from building extraction / LiDAR evidence.
        """
        extraction_path = req.extraction_json_path or "data/processed/tower_a_building_extraction.json"
        las_path = req.las_path or "data/simulated/prototype_tower_a.las"

        if not os.path.exists(extraction_path):
            raise FileNotFoundError(f"Extraction evidence JSON not found at: {extraction_path}")

        with open(extraction_path, "r", encoding="utf-8") as f:
            ext_data = json.load(f)

        parent_ulpin = ext_data.get("parent_parcel_ulpin_2d", req.parcel_ulpin or "27A8B9C3D4E5F6")
        bldg_code = ext_data.get("building_id", req.building_id or "TOWER-A")
        
        bldg_cand = ext_data.get("building_candidate", {})
        if "coordinates_epsg32644" in bldg_cand:
            coords = bldg_cand["coordinates_epsg32644"]
            footprint_poly = Polygon(coords)
        elif "footprint_2d" in ext_data and "geojson" in ext_data["footprint_2d"]:
            footprint_poly = shape(ext_data["footprint_2d"]["geojson"])
        elif "footprint_2d" in ext_data and "coordinates" in ext_data["footprint_2d"]:
            coords = ext_data["footprint_2d"]["coordinates"]
            if isinstance(coords[0][0], (list, tuple)):
                coords = coords[0]
            footprint_poly = Polygon(coords)
        else:
            footprint_poly = box(219404.953, 1932502.447, 219425.050, 1932517.553)
        
        ground_z = float(ext_data["vertical_extent"]["ground_z_m"])
        roof_z = float(ext_data["vertical_extent"]["roof_z_m"])
        
        # Load LAS points if available
        las_z, las_x, las_y = None, None, None
        if os.path.exists(las_path):
            import laspy
            with laspy.open(las_path) as reader:
                las = reader.read()
            classes = np.array(las.classification, dtype=np.uint8)
            bldg_mask = (classes == 6)
            las_z = np.array(las.z[bldg_mask], dtype=np.float64)
            las_x = np.array(las.x[bldg_mask], dtype=np.float64)
            las_y = np.array(las.y[bldg_mask], dtype=np.float64)

        # Build candidate vertical levels
        # Standard storey segmentation intervals
        levels_data = ext_data.get("candidate_structural_levels", [])
        if len(levels_data) >= 2:
            elevations = [float(l["elevation_m"]) for l in levels_data]
            elevations = sorted(list(set(elevations)))
        else:
            # Synthetic 3-level intervals
            elevations = [ground_z, ground_z + 3.5, ground_z + 6.5, roof_z]

        footprint_coords = list(footprint_poly.exterior.coords)

        proposals: List[AICandidateProposal] = []
        for i in range(len(elevations) - 1):
            z_low = elevations[i]
            z_high = elevations[i + 1]

            features = self.extract_features_from_geometry_and_points(
                footprint_poly=footprint_poly,
                z_min=z_low,
                z_max=z_high,
                ground_z=ground_z,
                roof_z=roof_z,
                las_z_coords=las_z,
                las_x_coords=las_x,
                las_y_coords=las_y,
                source_evidence_type=req.source_evidence_type,
                is_synthetic=True
            )

            (
                tier_code,
                floor_code,
                cand_type,
                unit_type,
                label,
                confidence,
                score,
                explanation,
                review_flags,
                underground_safety
            ) = self.classify_and_explain_candidate(
                features=features,
                ground_z=ground_z,
                roof_z=roof_z,
                candidate_index=i,
                building_id=bldg_code
            )

            if score < req.confidence_threshold:
                continue

            # Build watertight 3D solid geometry WKT
            geom_wkt_res, _ = build_polyhedralsurface_wkt_from_footprint(
                footprint_coords=footprint_coords,
                z_min=z_low,
                z_max=z_high
            )

            proposal = AICandidateProposal(
                candidate_id=f"AI-CANDIDATE-{bldg_code}-{floor_code}",
                candidate_type=cand_type,
                tier_code=tier_code,
                floor_code=floor_code,
                suggested_label=label,
                suggested_unit_type=unit_type,
                z_min=z_low,
                z_max=z_high,
                confidence=confidence,
                confidence_score=score,
                confidence_label="PROTOTYPE_CANDIDATE_CONFIDENCE",
                explanation=explanation,
                review_flags=review_flags,
                features=features,
                geom_wkt=geom_wkt_res,
                status="PROPOSED"
            )
            proposals.append(proposal)

        return AIProposeCandidatesResponse(
            dataset_name=os.path.basename(extraction_path),
            parent_parcel_ulpin=parent_ulpin,
            total_candidates_proposed=len(proposals),
            method="STATISTICAL_FEATURE_RANKING_HYBRID",
            model_version="2.9.0-prototype",
            is_synthetic=True,
            proposals=proposals,
            disclaimer=(
                "AI Candidate proposals are algorithmic hypotheses derived from spatial evidence. "
                "All candidates are initialized in PROPOSED status and require PostGIS/SFCGAL geometric validation "
                "and statutory human verification before acceptance."
            ),
            proposed_at=datetime.utcnow()
        )

    def analyze_vertical_unit(self, unit_id: uuid.UUID) -> AICandidateAnalysisResponse:
        """
        Retrieves an existing vertical unit from the database, computes AI feature representations,
        evaluates prototype confidence, and returns explainable rationale.
        """
        if not self.db:
            raise ValueError("Database session required for analyze_vertical_unit.")

        query = text("""
            SELECT 
                vu.id,
                vu.prototype_ulpin_3d,
                vu.tier_code,
                vu.floor_code,
                vu.unit_label,
                vu.unit_type,
                vu.z_min,
                vu.z_max,
                vu.status,
                ST_AsText(vu.geom_3d) AS geom_wkt,
                ST_AsGeoJSON(ST_Envelope(vu.geom_3d)) AS bbox_json,
                ST_Area(ST_Envelope(vu.geom_3d)) AS approx_area,
                se.source_type,
                se.dataset_name
            FROM vertical_units vu
            LEFT JOIN source_evidence se ON vu.id = se.unit_id
            WHERE vu.id = :unit_id;
        """)

        row = self.db.execute(query, {"unit_id": str(unit_id)}).mappings().first()
        if not row:
            raise LookupError(f"Vertical unit {unit_id} not found in database.")

        z_min = float(row["z_min"])
        z_max = float(row["z_max"])
        tier_code = row["tier_code"]
        floor_code = row["floor_code"]
        status = row["status"]
        src_type = row["source_type"] or "LIDAR_POINTCLOUD"

        # Construct footprint proxy from bbox or geometry
        bbox_json = row.get("bbox_json")
        if bbox_json:
            bbox_geom = shape(json.loads(bbox_json))
            footprint_poly = Polygon(bbox_geom.exterior.coords)
        else:
            footprint_poly = box(219450, 1932505, 219470, 1932520)

        features = self.extract_features_from_geometry_and_points(
            footprint_poly=footprint_poly,
            z_min=z_min,
            z_max=z_max,
            ground_z=540.0,
            roof_z=549.5,
            source_evidence_type=src_type,
            is_synthetic=True
        )

        (
            tier,
            floor,
            cand_type,
            unit_type,
            label,
            confidence,
            score,
            explanation,
            review_flags,
            underground_safety
        ) = self.classify_and_explain_candidate(
            features=features,
            ground_z=540.0,
            roof_z=549.5,
            candidate_index=1,
            building_id="TOWER"
        )

        # Reflect verified or rejected state in flags
        if status == "VERIFIED":
            review_flags.append("STATUS_HUMAN_VERIFIED")
        elif status == "REJECTED":
            review_flags.append("STATUS_HUMAN_REJECTED")

        return AICandidateAnalysisResponse(
            unit_id=row["id"],
            prototype_ulpin_3d=row["prototype_ulpin_3d"],
            tier_code=tier_code,
            floor_code=floor_code,
            candidate_type=cand_type,
            status=status,
            confidence=confidence,
            confidence_score=score,
            confidence_label="PROTOTYPE_CANDIDATE_CONFIDENCE",
            explanation=explanation,
            review_flags=review_flags,
            features=features,
            underground_safety=underground_safety,
            disclaimer=(
                "This AI analysis is a research prototype candidate intelligence assessment only. "
                "It does not perform legal ownership determination, cadastral certification, or official ULPIN assignment. "
                "Human verification by an authorized surveyor or revenue official is mandatory."
            ),
            evaluated_at=datetime.utcnow()
        )
