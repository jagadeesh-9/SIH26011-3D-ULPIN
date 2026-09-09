"""
Unit and API integration tests for Phase 1-5: Search by ULPIN / Bhu-Aadhaar lookup.
Tests 1-8 verify deterministic retrieval, 14-char format validation, WGS84 coordinates,
3D prototype detection, idempotency, and registry preservation.
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models.entities import Parcel, Building, VerticalUnit

client = TestClient(app)


def test_1_valid_known_ulpin_returns_correct_parcel():
    """TEST 1: Valid known ULPIN returns correct parcel metadata from reference registry."""
    ulpin = "36A1B2C3D4E5F9"
    response = client.get(f"/api/parcels/by-ulpin/{ulpin}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert data["found"] is True
    assert data["ulpin"] == ulpin
    assert "parcel_id" in data
    assert "survey_number" in data
    assert data["state"] == "Telangana" or "Telangana" in data["state"]
    assert data["source"] == "Prototype ULPIN Reference Registry"
    assert "disclaimer" in data


def test_2_unknown_valid_format_ulpin_returns_404():
    """TEST 2: Unknown valid-format ULPIN returns a clean 404/not found response."""
    unknown_ulpin = "36000000000000"
    response = client.get(f"/api/parcels/by-ulpin/{unknown_ulpin}")
    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


def test_3_invalid_ulpin_returns_validation_error():
    """TEST 3: Invalid ULPIN (short, long, invalid characters) returns 400 validation error."""
    invalid_inputs = ["12345", "ABC", "36982341201", "36982341201B3E99", "36@1B2C3D4E5F9"]
    for inv in invalid_inputs:
        response = client.get(f"/api/parcels/by-ulpin/{inv}")
        assert response.status_code == 400, f"Expected 400 for '{inv}', got {response.status_code}"
        data = response.json()
        assert "valid 14-character" in data["detail"].lower()


def test_4_ulpin_lookup_returns_correct_centroid_coordinates():
    """TEST 4: ULPIN lookup returns valid WGS84 centroid latitude and longitude."""
    ulpin = "36A1B2C3D4E5F9"
    response = client.get(f"/api/parcels/by-ulpin/{ulpin}")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["latitude"], (float, int))
    assert isinstance(data["longitude"], (float, int))
    # Hyderabad range approx: Lat 17.0 - 18.0, Lon 78.0 - 79.0
    assert 17.0 <= data["latitude"] <= 18.0
    assert 78.0 <= data["longitude"] <= 79.0


def test_5_ulpin_lookup_returns_correct_building_relationship():
    """TEST 5: ULPIN lookup returns correct building relationship if present on parcel."""
    ulpin = "36A1B2C3D4E5F9"
    response = client.get(f"/api/parcels/by-ulpin/{ulpin}")
    assert response.status_code == 200
    data = response.json()
    assert data["building_id"] is not None
    assert data["building_code"] is not None
    assert "SURYA" in data["building_code"]


def test_6_existing_3d_prototype_detected():
    """TEST 6: Existing 3D prototype availability is accurately flagged in response."""
    # Surya Heights has 3D prototype generated
    response_surya = client.get("/api/parcels/by-ulpin/36A1B2C3D4E5F9")
    assert response_surya.status_code == 200
    data_surya = response_surya.json()
    assert data_surya["has_3d_prototype"] is True
    assert data_surya["vertical_unit_count"] > 0

    # Test reference parcel 36982341201B3E without vertical units initially
    response_ref = client.get("/api/parcels/by-ulpin/36982341201B3E")
    assert response_ref.status_code == 200
    data_ref = response_ref.json()
    assert isinstance(data_ref["has_3d_prototype"], bool)


def test_7_lookup_is_read_only_and_creates_no_duplicates():
    """TEST 7: ULPIN lookup is strictly read-only and does not mutate or duplicate records."""
    db = SessionLocal()
    try:
        initial_parcel_count = db.query(Parcel).count()
        initial_building_count = db.query(Building).count()

        # Perform multiple lookups
        client.get("/api/parcels/by-ulpin/36A1B2C3D4E5F9")
        client.get("/api/parcels/by-ulpin/36982341201B3E")
        client.get("/api/parcels/by-ulpin/36000000000000")

        post_parcel_count = db.query(Parcel).count()
        post_building_count = db.query(Building).count()

        assert post_parcel_count == initial_parcel_count, "Lookup must not insert duplicate parcels"
        assert post_building_count == initial_building_count, "Lookup must not insert duplicate buildings"
    finally:
        db.close()


def test_8_existing_surya_heights_registry_unchanged():
    """TEST 8: Canonical Surya Heights demonstration records remain completely intact."""
    db = SessionLocal()
    try:
        surya_parcel = db.query(Parcel).filter(Parcel.ulpin_2d == "36A1B2C3D4E5F9").first()
        assert surya_parcel is not None
        assert surya_parcel.survey_number.startswith("SY-142/OSM")
        assert len(surya_parcel.buildings) >= 1
        assert len(surya_parcel.vertical_units) >= 8
    finally:
        db.close()
