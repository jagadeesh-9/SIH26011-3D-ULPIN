import psycopg

conn = psycopg.connect("postgresql://postgres:8919223622@localhost:5432/sih26011_dev")
with conn.cursor() as cur:
    cur.execute("""
        DELETE FROM verification_audit WHERE unit_id IN (
            SELECT id FROM vertical_units WHERE floor_code NOT IN ('UT01', 'B01', 'F00', 'F01', 'F02')
        );
        DELETE FROM source_evidence WHERE unit_id IN (
            SELECT id FROM vertical_units WHERE floor_code NOT IN ('UT01', 'B01', 'F00', 'F01', 'F02')
        );
        DELETE FROM vertical_units WHERE floor_code NOT IN ('UT01', 'B01', 'F00', 'F01', 'F02');
        SELECT setval('vertical_unit_seq', 7, false);
    """)
    conn.commit()

    print("Database counts after cleanup:")
    for tbl in ['parcels', 'buildings', 'vertical_units', 'verification_audit', 'source_evidence']:
        cur.execute(f"SELECT count(*) FROM {tbl}")
        print(f"{tbl}: {cur.fetchone()[0]}")

conn.close()
