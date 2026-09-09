import sys
sys.path.insert(0, r"C:\Users\jagad\OneDrive\Desktop\SIH26011-3D-ULPIN")
from backend.app.db import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    print("=== Database Integrity & Counts Check ===")
    parcels_count = db.execute(text("SELECT count(*) FROM parcels;")).scalar()
    buildings_count = db.execute(text("SELECT count(*) FROM buildings;")).scalar()
    units_count = db.execute(text("SELECT count(*) FROM vertical_units;")).scalar()
    audit_count = db.execute(text("SELECT count(*) FROM verification_audit;")).scalar()
    evidence_count = db.execute(text("SELECT count(*) FROM source_evidence;")).scalar()

    print(f"Parcels: {parcels_count} (Expected: 1)")
    print(f"Buildings: {buildings_count} (Expected: 1)")
    print(f"Vertical Units: {units_count} (Expected: 6)")
    print(f"Verification Audit: {audit_count} (Expected: 6)")
    print(f"Source Evidence: {evidence_count} (Expected: 6)")

    units_q = text("""
        SELECT 
            unit_sequence,
            prototype_ulpin_3d,
            tier_code,
            floor_code,
            status,
            ST_GeometryType(geom_3d) AS geom_type,
            ST_SRID(geom_3d) AS srid
        FROM vertical_units
        ORDER BY unit_sequence;
    """)
    rows = db.execute(units_q).mappings().all()
    for r in rows:
        print(f"  Seq {r['unit_sequence']}: {r['prototype_ulpin_3d']} | Status: {r['status']:<12} | {r['geom_type']} (SRID {r['srid']})")
finally:
    db.close()
