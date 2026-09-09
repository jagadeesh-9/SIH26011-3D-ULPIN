"""
Service layer for business logic, 3D ULPIN generation, spatial validation, and lifecycle state transitions.
"""
import json
import re
import uuid
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.app.repositories.spatial_repository import SpatialRepository
from backend.app.schemas.responses import (
    HealthResponse,
    ParcelResponse,
    ParcelULPINLookupResponse,
    BuildingResponse,
    VerticalUnitResponse,
    SourceEvidenceResponse,
    VerificationAuditResponse,
    GeometryPayload,
    ValidationResponse,
    CheckItem,
    ConflictItem,
    EvidenceDetailItem,
    ProvenanceStep,
    UnitEvidenceProvenanceResponse,
    VerticalStructureResponse,
    VerticalTaxonomyClassification
)
from backend.app.schemas.requests import (
    VerticalUnitCreateRequest,
    VerticalUnitTransitionRequest
)
from backend.app.services.decomposition_service import (
    classify_vertical_taxonomy,
    VerticalPropertyDecompositionService
)


def parse_polyhedralsurface_ewkt(ewkt: Optional[str]) -> Dict[str, Any]:
    """
    Parses PostGIS PolyhedralSurfaceZ EWKT into a structured 3D geometry payload
    preserving all 3D vertices [X, Y, Z] across all polygonal facets.
    """
    if not ewkt:
        return {"type": "PolyhedralSurface", "coordinates": []}
    
    # Remove SRID prefix if present
    wkt_part = ewkt.split(";", 1)[-1] if ";" in ewkt else ewkt
    
    # Extract contents inside POLYHEDRALSURFACE Z ( ... )
    match = re.search(r"POLYHEDRALSURFACE\s*Z?\s*\((.*)\)", wkt_part, re.DOTALL | re.IGNORECASE)
    if not match:
        return {"type": "PolyhedralSurface", "coordinates": []}
    
    body = match.group(1).strip()
    
    # Find all polygon face rings: ((x y z, x y z, ...))
    face_matches = re.findall(r"\(\(([^()]+)\)\)", body)
    faces = []
    for face_str in face_matches:
        ring = []
        for pt_str in face_str.strip().split(","):
            parts = pt_str.strip().split()
            if len(parts) >= 3:
                ring.append([float(parts[0]), float(parts[1]), float(parts[2])])
            elif len(parts) == 2:
                ring.append([float(parts[0]), float(parts[1]), 0.0])
        if ring:
            faces.append([ring])
            
    return {
        "type": "PolyhedralSurface",
        "coordinates": faces
    }


class SpatialService:
    def __init__(self, db: Session):
        self.repo = SpatialRepository(db)

    def get_health(self) -> HealthResponse:
        """Returns health and PostGIS/SFCGAL engine status."""
        health_data = self.repo.check_health()
        return HealthResponse(
            status="healthy" if health_data["connected"] else "unhealthy",
            database_connected=health_data["connected"],
            postgis_version=health_data["postgis_version"],
            sfcgal_version=health_data["sfcgal_version"],
            canonical_crs="EPSG:32644"
        )

    def get_parcels(self) -> List[ParcelResponse]:
        """Retrieves all parent parcels."""
        records = self.repo.get_parcels()
        result = []
        for parcel, geojson_str, ewkt_str, bldg_count, unit_count in records:
            geom_dict = json.loads(geojson_str) if geojson_str else {}
            result.append(
                ParcelResponse(
                    id=parcel.id,
                    ulpin_2d=parcel.ulpin_2d,
                    survey_number=parcel.survey_number,
                    district=parcel.district,
                    state=parcel.state,
                    village_code=parcel.village_code,
                    area_sqm=float(parcel.area_sqm),
                    geom_2d=GeometryPayload(
                        srid=32644,
                        geometry_type="Polygon",
                        geojson=geom_dict,
                        ewkt=ewkt_str
                    ),
                    building_count=bldg_count,
                    vertical_unit_count=unit_count,
                    created_at=parcel.created_at
                )
            )
        return result

    def get_parcel(self, parcel_id: uuid.UUID) -> ParcelResponse:
        """Retrieves a single parcel by UUID or raises 404."""
        record = self.repo.get_parcel_by_id(parcel_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parcel with ID {parcel_id} not found."
            )
        parcel, geojson_str, ewkt_str, bldg_count, unit_count = record
        geom_dict = json.loads(geojson_str) if geojson_str else {}
        return ParcelResponse(
            id=parcel.id,
            ulpin_2d=parcel.ulpin_2d,
            survey_number=parcel.survey_number,
            district=parcel.district,
            state=parcel.state,
            village_code=parcel.village_code,
            area_sqm=float(parcel.area_sqm),
            geom_2d=GeometryPayload(
                srid=32644,
                geometry_type="Polygon",
                geojson=geom_dict,
                ewkt=ewkt_str
            ),
            building_count=bldg_count,
            vertical_unit_count=unit_count,
            created_at=parcel.created_at
        )

    def get_parcel_by_ulpin(self, ulpin: str) -> ParcelULPINLookupResponse:
        """
        Looks up a registered land parcel by its 14-character alphanumeric ULPIN / Bhu-Aadhaar.
        Performs strict format validation, retrieves metadata & WGS84 centroid, and determines
        3D prototype availability.
        """
        clean_ulpin = ulpin.strip().upper()
        if not re.match(r"^[A-Z0-9]{14}$", clean_ulpin):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Enter a valid 14-character ULPIN."
            )

        data = self.repo.get_parcel_by_ulpin(clean_ulpin)
        if not data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parcel with ULPIN '{clean_ulpin}' not found in Prototype ULPIN Reference Registry."
            )

        parcel = data["parcel"]
        geom_dict = json.loads(data["geojson"]) if data["geojson"] else {}

        # Build human-readable address description
        address_parts = []
        if parcel.survey_number:
            address_parts.append(f"Survey No. {parcel.survey_number}")
        if parcel.village_code:
            address_parts.append(parcel.village_code)
        if parcel.district:
            address_parts.append(parcel.district)
        if parcel.state:
            address_parts.append(parcel.state)
        address_str = ", ".join(address_parts) if address_parts else f"Parcel {clean_ulpin}, Telangana"

        unit_count = data["vertical_unit_count"]
        has_3d = unit_count > 0

        # WGS84 coordinates from ST_Centroid
        lat = data["centroid_lat"] if data["centroid_lat"] is not None else 17.466502
        lon = data["centroid_lon"] if data["centroid_lon"] is not None else 78.363627

        return ParcelULPINLookupResponse(
            found=True,
            ulpin=clean_ulpin,
            parcel_id=parcel.id,
            survey_number=parcel.survey_number,
            district=parcel.district,
            state=parcel.state,
            village_code=parcel.village_code,
            latitude=lat,
            longitude=lon,
            address=address_str,
            area_sqm=float(parcel.area_sqm),
            geometry=GeometryPayload(
                srid=32644,
                geometry_type="Polygon",
                geojson=geom_dict,
                ewkt=data["ewkt"]
            ),
            building_id=data["building_id"],
            building_code=data["building_code"],
            building_name=data["building_name"],
            has_3d_prototype=has_3d,
            vertical_unit_count=unit_count,
            source="Prototype ULPIN Reference Registry",
            disclaimer="Synthetic/reference data — not a live government land-record lookup."
        )

    def get_buildings_for_parcel(self, parcel_id: uuid.UUID) -> List[BuildingResponse]:
        """Retrieves all buildings on a given parcel."""
        # Validate parcel existence
        self.get_parcel(parcel_id)
        
        records = self.repo.get_buildings_by_parcel(parcel_id)
        result = []
        for bldg, fp_geojson, fp_ewkt, env_ewkt, unit_count in records:
            fp_dict = json.loads(fp_geojson) if fp_geojson else {}
            env_payload = None
            if env_ewkt:
                env_payload = GeometryPayload(
                    srid=32644,
                    geometry_type="PolyhedralSurfaceZ",
                    geojson=parse_polyhedralsurface_ewkt(env_ewkt),
                    ewkt=env_ewkt
                )
            result.append(
                BuildingResponse(
                    id=bldg.id,
                    parcel_id=bldg.parcel_id,
                    building_code=bldg.building_code,
                    building_name=bldg.building_name,
                    total_floors_above=bldg.total_floors_above,
                    total_floors_below=bldg.total_floors_below,
                    footprint_2d=GeometryPayload(
                        srid=32644,
                        geometry_type="Polygon",
                        geojson=fp_dict,
                        ewkt=fp_ewkt
                    ),
                    envelope_3d=env_payload,
                    unit_count=unit_count,
                    created_at=bldg.created_at
                )
            )
        return result

    def get_building_by_id(self, building_id: uuid.UUID) -> BuildingResponse:
        """Retrieves a single building by UUID."""
        res = self.db.execute(
            text("""
                SELECT b.id, b.parcel_id, b.building_code, b.building_name,
                       b.total_floors_above, b.total_floors_below,
                       ST_AsGeoJSON(b.footprint_2d) as fp_geojson,
                       ST_AsEWKT(b.footprint_2d) as fp_ewkt,
                       ST_AsEWKT(b.envelope_3d) as env_ewkt,
                       (SELECT COUNT(*) FROM vertical_units u WHERE u.building_id = b.id) as unit_count,
                       b.created_at
                FROM buildings b
                WHERE b.id = :bldg_id
            """),
            {"bldg_id": str(building_id)}
        ).fetchone()
        if not res:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Building with ID {building_id} not found."
            )
        
        fp_dict = json.loads(res.fp_geojson) if res.fp_geojson else {}
        env_payload = None
        if res.env_ewkt:
            env_payload = GeometryPayload(
                srid=32644,
                geometry_type="PolyhedralSurfaceZ",
                geojson=parse_polyhedralsurface_ewkt(res.env_ewkt),
                ewkt=res.env_ewkt
            )

        return BuildingResponse(
            id=res.id,
            parcel_id=res.parcel_id,
            building_code=res.building_code,
            building_name=res.building_name,
            total_floors_above=res.total_floors_above,
            total_floors_below=res.total_floors_below,
            footprint_2d=GeometryPayload(
                srid=32644,
                geometry_type="Polygon",
                geojson=fp_dict,
                ewkt=res.fp_ewkt
            ),
            envelope_3d=env_payload,
            unit_count=res.unit_count or 0,
            created_at=res.created_at
        )

    def get_vertical_units_for_parcel(self, parcel_id: uuid.UUID) -> List[VerticalUnitResponse]:
        """Retrieves all 3D vertical units for a parcel."""
        # Validate parcel existence
        self.get_parcel(parcel_id)

        records = self.repo.get_vertical_units_by_parcel(parcel_id)
        result = []
        for unit, ewkt_3d_str in records:
            result.append(self._build_unit_response(unit, ewkt_3d_str))
        return result

    def get_vertical_unit(self, unit_id: uuid.UUID) -> VerticalUnitResponse:
        """Retrieves a single vertical unit by UUID or raises 404."""
        record = self.repo.get_vertical_unit_by_id(unit_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vertical unit with ID {unit_id} not found."
            )
        unit, ewkt_3d_str = record
        return self._build_unit_response(unit, ewkt_3d_str)

    def get_sub_units_for_unit(self, parent_unit_id: uuid.UUID) -> List[VerticalUnitResponse]:
        """Retrieves all child sub-units (flats/circulation) under a parent vertical unit."""
        self.get_vertical_unit(parent_unit_id)
        records = self.repo.get_sub_units_by_parent(parent_unit_id)
        result = []
        for unit, ewkt_3d_str in records:
            result.append(self._build_unit_response(unit, ewkt_3d_str))
        return result

    def create_vertical_unit(self, req: VerticalUnitCreateRequest) -> VerticalUnitResponse:
        """
        Validates input, allocates next atomic unit_sequence, generates prototype 3D ULPIN,
        and persists new vertical unit in initial PROPOSED status with an audit entry.
        """
        # 1. Validate parent parcel existence
        parcel_record = self.repo.get_parcel_by_id(req.parcel_id)
        if not parcel_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent parcel with ID {req.parcel_id} not found."
            )
        parcel = parcel_record[0]

        # 2. Validate optional building existence
        if req.building_id:
            bldg = self.repo.get_building_by_id(req.building_id)
            if not bldg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Building with ID {req.building_id} not found."
                )
            if bldg.parcel_id != req.parcel_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Building with ID {req.building_id} does not belong to parcel {req.parcel_id}."
                )

        # 3. Concurrency-safe atomic sequence allocation
        seq = self.repo.allocate_unit_sequence()

        # 4. Construct Prototype 3D ULPIN identifier: {2D_ULPIN}-3D-{TIER_OR_FLOOR}-{SEQUENCE:04d}
        code_segment = req.floor_code if req.floor_code else req.tier_code
        prototype_ulpin_3d = f"{parcel.ulpin_2d}-3D-{code_segment}-{seq:04d}"

        # 5. Persist unit
        try:
            created_record = self.repo.create_vertical_unit(
                parcel_id=req.parcel_id,
                building_id=req.building_id,
                prototype_ulpin_3d=prototype_ulpin_3d,
                tier_code=req.tier_code,
                floor_code=req.floor_code,
                unit_sequence=seq,
                unit_label=req.unit_label,
                unit_type=req.unit_type,
                z_min=req.z_min,
                z_max=req.z_max,
                geom_wkt=req.geom_wkt,
                initial_audit_notes=f"Automated prototype unit generation. Assigned sequence {seq} on parcel {parcel.ulpin_2d}."
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to persist vertical unit: {str(e)}"
            )

        if not created_record:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created vertical unit."
            )

        unit, ewkt_3d = created_record
        return self._build_unit_response(unit, ewkt_3d)

    def transition_vertical_unit(
        self,
        unit_id: uuid.UUID,
        req: VerticalUnitTransitionRequest
    ) -> VerticalUnitResponse:
        """
        Validates state machine rules, verifies actor role permissions (e.g., human-in-the-loop requirement
        for verification), records audit trail entry, and executes status transition.
        """
        record = self.repo.get_vertical_unit_by_id(unit_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vertical unit with ID {unit_id} not found."
            )
        unit, _ = record
        current_status = unit.status
        target_status = req.new_status
        actor_role = req.actor_role

        # 1. Terminal State Checks
        if current_status == "REJECTED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot transition unit from terminal REJECTED status. Rejected units are preserved in audit history."
            )
        if current_status == "VERIFIED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot transition unit from terminal VERIFIED status."
            )
        if current_status == target_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unit is already in '{current_status}' status."
            )

        # 2. State Machine Rule Validation
        if current_status == "PROPOSED":
            if target_status == "VERIFIED":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid transition: Direct PROPOSED -> VERIFIED transition is forbidden. Units must first undergo review (UNDER_REVIEW)."
                )
            if target_status == "REJECTED":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid transition: Units must be in UNDER_REVIEW before being marked REJECTED."
                )
            # PROPOSED -> UNDER_REVIEW is allowed for all roles

        elif current_status == "UNDER_REVIEW":
            if target_status == "VERIFIED":
                # CRITICAL: Automated system validation MUST NOT grant verification!
                if actor_role == "SYSTEM_VALIDATOR":
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Automated validation (SYSTEM_VALIDATOR) cannot grant verification. Verification requires an explicit human reviewer (HUMAN_REVIEWER / LICENSED_SURVEYOR / REVENUE_OFFICIAL)."
                    )
            elif target_status == "REJECTED":
                if not req.rejection_reason_code:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="A structured rejection_reason_code is required when transitioning a unit to REJECTED status."
                    )

        # 3. Map Actor Role and Action for database schema compatibility
        if actor_role in ("HUMAN_REVIEWER", "LICENSED_SURVEYOR"):
            db_role = "LICENSED_SURVEYOR"
        elif actor_role == "REVENUE_OFFICIAL":
            db_role = "REVENUE_OFFICIAL"
        else:
            db_role = "SYSTEM_VALIDATOR"

        if req.action:
            db_action = req.action
        else:
            if target_status == "UNDER_REVIEW":
                db_action = "SURVEYOR_REVIEW"
            elif target_status == "VERIFIED":
                db_action = "OFFICIAL_APPROVAL"
            elif target_status == "REJECTED":
                db_action = "REJECTION"
            else:
                db_action = "SURVEYOR_REVIEW"

        reviewer_name = req.reviewer_name or f"Simulated {actor_role}"
        if req.rejection_reason_code:
            notes_prefix = f"[{req.rejection_reason_code}] "
            review_notes = f"{notes_prefix}{req.review_notes or 'Candidate rejected during human review.'}"
        else:
            review_notes = req.review_notes or f"Transitioned status from {current_status} to {target_status} by {actor_role}."

        updated_record = self.repo.transition_vertical_unit(
            unit_id=unit_id,
            new_status=target_status,
            previous_status=current_status,
            action=db_action,
            reviewer_name=reviewer_name,
            reviewer_role=db_role,
            review_notes=review_notes,
            integrity_hash=req.integrity_hash
        )

        if not updated_record:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated vertical unit after status transition."
            )

        updated_unit, updated_ewkt = updated_record
        return self._build_unit_response(updated_unit, updated_ewkt)

    def validate_vertical_unit(self, unit_id: uuid.UUID) -> ValidationResponse:
        """
        Executes spatial verification checks for a single 3D vertical unit:
        Evaluates geometric closure/solidity, Z-bracket accuracy, parcel containment,
        and 3D volumetric conflict against peer units on the parent parcel.
        """
        metrics = self.repo.get_spatial_validation_metrics(unit_id)
        if not metrics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vertical unit with ID {unit_id} not found."
            )

        u = metrics["unit"]
        peers = metrics["peer_comparisons"]
        checks: List[CheckItem] = []
        conflicts: List[ConflictItem] = []

        # 1. Geometry Validity Check (Closure, Solid, Volume)
        is_closed = bool(u.get("is_closed", False))
        is_solid = bool(u.get("is_solid", False))
        volume = float(u.get("volume_cbm") or 0.0)
        geom_valid = is_closed and is_solid and volume > 0.0

        if geom_valid:
            geom_msg = f"Closed watertight 3D solid geometry verified with positive volume ({volume:.2f} m³)."
        else:
            geom_msg = (
                f"Geometry error: closed={is_closed}, solid={is_solid}, "
                f"volume={volume:.2f} m³ (requires closed solid with positive volume)."
            )
        checks.append(CheckItem(check="geometry_validity", passed=geom_valid, message=geom_msg))

        # 2. Z-Range & Elevation Consistency Check
        z_min = float(u["z_min"])
        z_max = float(u["z_max"])
        z_min_geom = float(u["z_min_geom"])
        z_max_geom = float(u["z_max_geom"])
        z_ordered = z_min < z_max
        z_matches_geom = abs(z_min - z_min_geom) <= 0.01 and abs(z_max - z_max_geom) <= 0.01
        z_valid = z_ordered and z_matches_geom

        if z_valid:
            z_msg = f"Valid vertical elevation bracket (+{z_min:.2f}m to +{z_max:.2f}m MSL, delta Z = {z_max - z_min:.2f}m)."
        elif not z_ordered:
            z_msg = f"Inverted Z range error: z_min ({z_min:.2f}m) >= z_max ({z_max:.2f}m)."
        else:
            z_msg = (
                f"Z bracket mismatch: metadata ({z_min:.2f}m to {z_max:.2f}m) differs from "
                f"geometry ({z_min_geom:.2f}m to {z_max_geom:.2f}m)."
            )
        checks.append(CheckItem(check="z_range", passed=z_valid, message=z_msg))

        # 3. Parcel Footprint Containment Check
        is_within = bool(u.get("is_within_parcel", False))
        if is_within:
            parcel_msg = "Unit 2D footprint projection is completely enclosed within the parent parcel boundary."
        else:
            parcel_msg = "Review Flag: Unit horizontal footprint extends beyond parent parcel boundary (easement or cantilever check required)."
        checks.append(CheckItem(check="parcel_relationship", passed=is_within, message=parcel_msg))

        # 4. 3D Volumetric Conflict Detection
        has_boundary_contact = False
        for peer in peers:
            overlap_vol = float(peer.get("overlap_volume") or 0.0)
            boundary_touch = bool(peer.get("boundary_intersects", False))
            if overlap_vol > 0.001:
                conflicts.append(
                    ConflictItem(
                        conflicting_unit_id=peer["other_id"],
                        conflicting_prototype_ulpin_3d=peer["other_ulpin"],
                        overlap_volume_cbm=overlap_vol,
                        description=f"Volumetric 3D collision of {overlap_vol:.3f} m³ detected with peer unit {peer['other_ulpin']}."
                    )
                )
            elif boundary_touch:
                has_boundary_contact = True

        conflict_free = len(conflicts) == 0
        if conflict_free and has_boundary_contact:
            conflict_msg = "Zero volumetric overlap detected. Shared boundary slab contact with peer units verified without volumetric collision."
        elif conflict_free:
            conflict_msg = "Zero 3D collision or boundary contact detected with peer units."
        else:
            conflict_msg = f"Spatial Conflict: Volumetric overlap detected with {len(conflicts)} peer unit(s)."

        checks.append(CheckItem(check="3d_conflict", passed=conflict_free, message=conflict_msg))

        # Overall validation status
        overall_valid = all(c.passed for c in checks) and len(conflicts) == 0

        return ValidationResponse(
            unit_id=u["id"],
            prototype_ulpin_3d=u["prototype_ulpin_3d"],
            valid=overall_valid,
            checks=checks,
            conflicts=conflicts
        )

    def get_unit_evidence_provenance(self, unit_id: uuid.UUID) -> UnitEvidenceProvenanceResponse:
        """
        Retrieves detailed multi-source evidence intelligence and provenance pipeline
        for a 3D vertical unit, evaluating dataset precision and reconstruction lineage.
        """
        record = self.repo.get_vertical_unit_by_id(unit_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vertical unit with ID {unit_id} not found."
            )
        unit, ewkt_str = record
        
        is_underground = unit.tier_code in ("SB", "UT")
        
        SENSOR_CATEGORY_MAP = {
            "LIDAR_POINTCLOUD": "AIRBORNE_LIDAR_POINTCLOUD",
            "BIM_IFC": "BUILDING_INFORMATION_MODEL",
            "CITYJSON_LOD2": "CITYJSON_LOD2_URBAN_MODEL",
            "DRONE_PHOTOGRAMMETRY": "DRONE_AERIAL_PHOTOGRAMMETRY",
            "ARCHITECTURAL_PLAN_2D": "SANCTIONED_ARCHITECTURAL_PLAN",
            "CORS_GNSS_SURVEY": "HIGH_PRECISION_GNSS_SURVEY",
            "MANUAL_DIGITIZED": "MUNICIPAL_INFRASTRUCTURE_SURVEY"
        }
        
        evidence_items: List[EvidenceDetailItem] = []
        assessment_ranks = []
        
        for ev in getattr(unit, "source_evidence", []):
            h_acc = float(ev.accuracy_horizontal_m) if ev.accuracy_horizontal_m is not None else None
            v_acc = float(ev.accuracy_vertical_m) if ev.accuracy_vertical_m is not None else None
            
            # Rule-based Transparent Prototype Evidence Assessment
            if h_acc is not None and v_acc is not None:
                if h_acc <= 0.05 and v_acc <= 0.05:
                    lvl = "HIGH"
                    rank = 3
                    rationale = f"High precision documented spatial accuracy (H: ±{h_acc:.3f}m, V: ±{v_acc:.3f}m)."
                elif h_acc <= 0.20 and v_acc <= 0.20:
                    lvl = "MEDIUM"
                    rank = 2
                    rationale = f"Moderate precision documented spatial accuracy (H: ±{h_acc:.3f}m, V: ±{v_acc:.3f}m)."
                else:
                    lvl = "LOW"
                    rank = 1
                    rationale = f"Coarse or approximate spatial accuracy (H: ±{h_acc:.3f}m, V: ±{v_acc:.3f}m)."
            else:
                lvl = "UNKNOWN"
                rank = 0
                rationale = "Spatial accuracy metrics not explicitly documented in dataset metadata."
            
            assessment_ranks.append(rank)
            sensor_cat = SENSOR_CATEGORY_MAP.get(ev.source_type, "SPATIAL_DATASET")
            
            evidence_items.append(
                EvidenceDetailItem(
                    id=ev.id,
                    source_type=ev.source_type,
                    dataset_name=ev.dataset_name,
                    file_uri=ev.file_uri,
                    accuracy_horizontal_m=h_acc,
                    accuracy_vertical_m=v_acc,
                    sensor_category=sensor_cat,
                    is_synthetic=True,
                    assessment_level=lvl,
                    assessment_rationale=rationale,
                    metadata_json=ev.metadata_json,
                    created_at=ev.created_at
                )
            )
            
        # Overall unit assessment
        if assessment_ranks:
            max_rank = max(assessment_ranks)
            if max_rank == 3:
                overall_lvl = "HIGH"
            elif max_rank == 2:
                overall_lvl = "MEDIUM"
            elif max_rank == 1:
                overall_lvl = "LOW"
            else:
                overall_lvl = "UNKNOWN"
        else:
            overall_lvl = "UNKNOWN"
            
        overall_label = f"{overall_lvl} (Prototype Assessment)"
        
        # Underground provenance explanation
        underground_note = None
        if is_underground:
            if unit.tier_code == "UT":
                underground_note = "Subsurface utility infrastructure derived from municipal survey/engineering records. Subterranean geometry is not detected by optical airborne LiDAR."
            else:
                underground_note = "Subterranean basement levels derived from structural BIM/IFC engineering models and building sanction plans."
                
        # Construct Step-by-Step Provenance Lineage Pipeline
        datasets_str = ", ".join(e.dataset_name for e in evidence_items) if evidence_items else "Synthetic Cadastral Survey Dataset"
        source_types_str = ", ".join(e.source_type for e in evidence_items) if evidence_items else "ARCHITECTURAL_MODEL"
        
        pipeline: List[ProvenanceStep] = [
            ProvenanceStep(
                step_number=1,
                stage="SOURCE_DATASET",
                name="Multi-Source Evidence Ingestion",
                status="COMPLETED",
                details=f"Ingested {source_types_str} evidence from dataset '{datasets_str}'.",
                timestamp=unit.created_at
            ),
            ProvenanceStep(
                step_number=2,
                stage="EXTRACTION_SEGMENTATION",
                name="Floor Interval & Spatial Extraction",
                status="COMPLETED",
                details=f"Identified floor {unit.floor_code} (Tier {unit.tier_code}) spanning vertical interval +{float(unit.z_min):.2f}m to +{float(unit.z_max):.2f}m (ΔZ = {float(unit.z_max) - float(unit.z_min):.2f}m).",
                timestamp=unit.created_at
            ),
            ProvenanceStep(
                step_number=3,
                stage="3D_SOLID_RECONSTRUCTION",
                name="PolyhedralSurface B-Rep Construction",
                status="COMPLETED",
                details="Constructed watertight 3D solid boundary representation (B-Rep) in canonical CRS EPSG:32644.",
                timestamp=unit.created_at
            ),
            ProvenanceStep(
                step_number=4,
                stage="SPATIAL_VALIDATION",
                name="PostGIS / SFCGAL 3D Spatial Checks",
                status="COMPLETED",
                details="Evaluated solid closure, positive volume, Z-range consistency, and parcel containment.",
                timestamp=unit.updated_at
            ),
            ProvenanceStep(
                step_number=5,
                stage="LIFECYCLE_STATE",
                name="Cadastral Lifecycle Verification",
                status=unit.status,
                details=(
                    "Human licensed surveyor verification completed with official audit record."
                    if unit.status == "VERIFIED"
                    else "Surveyor review in progress by licensed cadastral surveyor."
                    if unit.status == "UNDER_REVIEW"
                    else "Candidate rejected during cadastral review audit."
                    if unit.status == "REJECTED"
                    else "Analytical candidate proposed; requires human surveyor verification to proceed."
                ),
                timestamp=unit.updated_at
            )
        ]
        
        return UnitEvidenceProvenanceResponse(
            unit_id=unit.id,
            prototype_ulpin_3d=unit.prototype_ulpin_3d,
            floor_code=unit.floor_code,
            tier_code=unit.tier_code,
            status=unit.status,
            overall_assessment_level=overall_lvl,
            overall_assessment_label=overall_label,
            is_synthetic_prototype=True,
            is_underground=is_underground,
            underground_provenance_note=underground_note,
            evidence_count=len(evidence_items),
            evidence_records=evidence_items,
            provenance_pipeline=pipeline
        )

    def get_parcel_vertical_structure(self, parcel_id: uuid.UUID) -> VerticalStructureResponse:
        """
        Retrieves the multi-tier vertical property decomposition grouped by taxonomy category.
        """
        units = self.get_vertical_units_for_parcel(parcel_id)
        decomp_service = VerticalPropertyDecompositionService(self.repo.db)
        return decomp_service.get_parcel_vertical_structure(parcel_id, units)

    def _build_unit_response(self, unit, ewkt_str: str) -> VerticalUnitResponse:
        geom_dict = parse_polyhedralsurface_ewkt(ewkt_str)
        
        evidence_list = [
            SourceEvidenceResponse(
                id=ev.id,
                source_type=ev.source_type,
                dataset_name=ev.dataset_name,
                file_uri=ev.file_uri,
                accuracy_horizontal_m=float(ev.accuracy_horizontal_m) if ev.accuracy_horizontal_m is not None else None,
                accuracy_vertical_m=float(ev.accuracy_vertical_m) if ev.accuracy_vertical_m is not None else None,
                metadata_json=ev.metadata_json,
                created_at=ev.created_at
            )
            for ev in getattr(unit, "source_evidence", [])
        ]

        audit_list = [
            VerificationAuditResponse(
                id=aud.id,
                action=aud.action,
                previous_status=aud.previous_status,
                new_status=aud.new_status,
                reviewer_name=aud.reviewer_name,
                reviewer_role=aud.reviewer_role,
                review_notes=aud.review_notes,
                integrity_hash=aud.integrity_hash,
                timestamp=aud.timestamp
            )
            for aud in getattr(unit, "verification_audit", [])
        ]

        taxonomy = classify_vertical_taxonomy(
            tier_code=unit.tier_code,
            unit_type=unit.unit_type,
            floor_code=unit.floor_code,
            unit_label=unit.unit_label
        )

        return VerticalUnitResponse(
            id=unit.id,
            parcel_id=unit.parcel_id,
            building_id=unit.building_id,
            parent_unit_id=getattr(unit, "parent_unit_id", None),
            prototype_ulpin_3d=unit.prototype_ulpin_3d,
            tier_code=unit.tier_code,
            floor_code=unit.floor_code,
            unit_sequence=unit.unit_sequence,
            unit_level=getattr(unit, "unit_level", "STOREY") or "STOREY",
            flat_number=getattr(unit, "flat_number", None),
            unit_label=unit.unit_label,
            unit_type=unit.unit_type,
            z_min=float(unit.z_min),
            z_max=float(unit.z_max),
            status=unit.status,
            geom_3d=GeometryPayload(
                srid=32644,
                geometry_type="PolyhedralSurfaceZ",
                geojson=geom_dict,
                ewkt=ewkt_str
            ),
            taxonomy=taxonomy,
            source_evidence=evidence_list,
            verification_audit=audit_list,
            created_at=unit.created_at,
            updated_at=unit.updated_at
        )

