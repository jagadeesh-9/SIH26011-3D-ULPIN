import sys
sys.path.insert(0, r"C:\Users\jagad\OneDrive\Desktop\SIH26011-3D-ULPIN")
from backend.app.db import SessionLocal
from sqlalchemy import text
from fastapi.testclient import TestClient
from backend.app.main import app

db = SessionLocal()
client = TestClient(app)

print("=================================================================")
print("SIH26011 Phase 1.5 Database & Lifecycle State Machine Verification")
print("=================================================================")

# 1. Check Row Counts & Status Preservation
print("\n1. Vertical Units Preservation & Status Verification:")
units_q = text("""
    SELECT 
        u.unit_sequence,
        u.prototype_ulpin_3d,
        u.tier_code,
        u.floor_code,
        u.status,
        ST_GeometryType(u.geom_3d) AS geom_type,
        ST_SRID(u.geom_3d) AS srid,
        ROUND(u.z_min, 2) AS z_min,
        ROUND(u.z_max, 2) AS z_max
    FROM vertical_units u
    ORDER BY u.unit_sequence;
""")
rows = db.execute(units_q).mappings().all()
print(f"Total vertical units in DB: {len(rows)}")
for r in rows:
    print(f"  Seq {r['unit_sequence']}: {r['prototype_ulpin_3d']} | Status: {r['status']:<12} | Geom: {r['geom_type']} (SRID {r['srid']}) | Z: [{r['z_min']}m, {r['z_max']}m]")

# 2. Check Sequence
print("\n2. PostgreSQL Sequence Verification:")
seq_q = text("SELECT sequence_name, start_value, minimum_value, maximum_value FROM information_schema.sequences WHERE sequence_name = 'vertical_unit_seq';")
seq_res = db.execute(seq_q).fetchall()
print(f"  Sequence info: {seq_res}")

# 3. Check Constraints
print("\n3. Unique & Check Constraints on vertical_units & verification_audit:")
cons_q = text("""
    SELECT c.conrelid::regclass AS table_name, c.conname, c.contype, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    WHERE c.conrelid IN ('vertical_units'::regclass, 'verification_audit'::regclass)
    ORDER BY c.conrelid::regclass::text, c.conname;
""")
cons = db.execute(cons_q).fetchall()
for c in cons:
    print(f"  [{c[0]}] {c[1]} ({c[2]}): {c[3]}")

# 4. Check Verification Audit Rows
print("\n4. Verification Audit Trail Rows:")
aud_q = text("""
    SELECT 
        a.id,
        u.prototype_ulpin_3d,
        a.action,
        a.previous_status,
        a.new_status,
        a.reviewer_role,
        a.reviewer_name
    FROM verification_audit a
    JOIN vertical_units u ON a.unit_id = u.id
    ORDER BY a.timestamp ASC;
""")
auds = db.execute(aud_q).mappings().all()
print(f"Total audit entries: {len(auds)}")
for a in auds:
    print(f"  [{a['action']:<18}] {a['prototype_ulpin_3d']}: {a['previous_status']} -> {a['new_status']} | Role: {a['reviewer_role']} ({a['reviewer_name']})")

# 5. API Smoke Test for Complete Lifecycle
print("\n5. API Smoke Test — Generation & Full Lifecycle Verification:")

# Step A: Get Parent Parcel
parcels = client.get("/api/parcels").json()
parcel_id = parcels[0]["id"]
print(f"  [A] Retrieved Parent Parcel: {parcels[0]['ulpin_2d']} (ID: {parcel_id})")

# Step B: Generate new unit
create_body = {
    "parcel_id": parcel_id,
    "tier_code": "F",
    "floor_code": "F03",
    "unit_label": "Smoke Test Penthouse 301",
    "unit_type": "RESIDENTIAL",
    "z_min": 549.50,
    "z_max": 552.50,
    "geom_wkt": """POLYHEDRALSURFACE Z (
        ((219405 1932502.5 549.5, 219405 1932517.5 549.5, 219425 1932517.5 549.5, 219425 1932502.5 549.5, 219405 1932502.5 549.5)),
        ((219405 1932502.5 552.5, 219425 1932502.5 552.5, 219425 1932517.5 552.5, 219405 1932517.5 552.5, 219405 1932502.5 552.5)),
        ((219405 1932502.5 549.5, 219425 1932502.5 549.5, 219425 1932502.5 552.5, 219405 1932502.5 552.5, 219405 1932502.5 549.5)),
        ((219425 1932502.5 549.5, 219425 1932517.5 549.5, 219425 1932517.5 552.5, 219425 1932502.5 552.5, 219425 1932502.5 549.5)),
        ((219425 1932517.5 549.5, 219405 1932517.5 549.5, 219405 1932517.5 552.5, 219425 1932517.5 552.5, 219425 1932517.5 549.5)),
        ((219405 1932517.5 549.5, 219405 1932502.5 549.5, 219405 1932502.5 552.5, 219405 1932517.5 552.5, 219405 1932517.5 549.5))
    )"""
}
create_resp = client.post("/api/vertical-units", json=create_body)
assert create_resp.status_code == 201
new_unit = create_resp.json()
unit_id = new_unit["id"]
print(f"  [B] Created Unit: {new_unit['prototype_ulpin_3d']} | Status: {new_unit['status']} | Seq: {new_unit['unit_sequence']}")

# Step C: Transition PROPOSED -> UNDER_REVIEW
t1_resp = client.post(f"/api/vertical-units/{unit_id}/transition", json={
    "new_status": "UNDER_REVIEW",
    "actor_role": "SYSTEM_VALIDATOR",
    "reviewer_name": "Automated Spatial Validation Engine"
})
assert t1_resp.status_code == 200
print(f"  [C] PROPOSED -> UNDER_REVIEW: OK (Status: {t1_resp.json()['status']})")

# Step D: Attempt UNDER_REVIEW -> VERIFIED with SYSTEM_VALIDATOR (Must fail 422)
t2_fail = client.post(f"/api/vertical-units/{unit_id}/transition", json={
    "new_status": "VERIFIED",
    "actor_role": "SYSTEM_VALIDATOR",
    "reviewer_name": "Automated Bot"
})
assert t2_fail.status_code == 422
print(f"  [D] UNDER_REVIEW -> VERIFIED with SYSTEM_VALIDATOR: Rejected with 422 ({t2_fail.json()['detail']})")

# Step E: UNDER_REVIEW -> VERIFIED with HUMAN_REVIEWER (Must succeed 200)
t3_ok = client.post(f"/api/vertical-units/{unit_id}/transition", json={
    "new_status": "VERIFIED",
    "actor_role": "HUMAN_REVIEWER",
    "reviewer_name": "Senior Revenue Officer Rao",
    "review_notes": "Physical cadastre strata plan verified against site survey."
})
assert t3_ok.status_code == 200
print(f"  [E] UNDER_REVIEW -> VERIFIED with HUMAN_REVIEWER: OK (Status: {t3_ok.json()['status']})")

# Cleanup smoke test unit
db.execute(text("DELETE FROM verification_audit WHERE unit_id = :uid;"), {"uid": unit_id})
db.execute(text("DELETE FROM vertical_units WHERE id = :uid;"), {"uid": unit_id})
db.execute(text("SELECT setval('vertical_unit_seq', 7, false);"))
db.commit()
print("\nSmoke test cleanup completed. Database restored to canonical seed state.")

db.close()
