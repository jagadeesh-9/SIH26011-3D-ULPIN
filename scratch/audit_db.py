import psycopg

conn = psycopg.connect('postgresql://postgres:8919223622@localhost:5432/sih26011_dev', autocommit=True)
cur = conn.cursor()

print("=== COLUMNS OF parcels ===")
cur.execute("""
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'parcels'
ORDER BY ordinal_position;
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

print("\n=== COLUMNS OF buildings ===")
cur.execute("""
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'buildings'
ORDER BY ordinal_position;
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

print("\n=== COLUMNS OF verification_audit ===")
cur.execute("""
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'verification_audit'
ORDER BY ordinal_position;
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

print("\n=== COLUMNS OF source_evidence ===")
cur.execute("""
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'source_evidence'
ORDER BY ordinal_position;
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

conn.close()
