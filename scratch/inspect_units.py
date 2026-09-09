import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
conn_str = os.getenv('DATABASE_URL', 'postgresql://postgres:8919223622@localhost:5432/sih26011_dev')
if conn_str.startswith('postgresql+psycopg://'):
    conn_str = conn_str.replace('postgresql+psycopg://', 'postgresql://')

with psycopg.connect(conn_str) as conn:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT u.id, u.floor_code, u.unit_label, u.prototype_ulpin_3d, u.unit_sequence, u.z_min, u.z_max, b.building_code, p.ulpin_2d
            FROM vertical_units u
            JOIN buildings b ON u.building_id = b.id
            JOIN parcels p ON u.parcel_id = p.id
            WHERE b.building_code = 'APARTMENT-SURYA-OSM'
            ORDER BY u.z_min ASC;
        """)
        rows = cur.fetchall()
        print(f"Total units for APARTMENT-SURYA-OSM: {len(rows)}")
        for r in rows:
            print(f"  {r[1]}: id={r[0]} | ulpin={r[3]} | seq={r[4]} | z=[{r[5]}, {r[6]}] | label={r[2]}")
