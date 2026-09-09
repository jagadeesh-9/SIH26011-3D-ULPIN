import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
conn_str = os.getenv('DATABASE_URL', 'postgresql://postgres:8919223622@localhost:5432/sih26011_dev')
if conn_str.startswith('postgresql+psycopg://'):
    conn_str = conn_str.replace('postgresql+psycopg://', 'postgresql://')

with psycopg.connect(conn_str) as conn:
    with conn.cursor() as cur:
        # Check storeys
        cur.execute("""
            SELECT floor_code, prototype_ulpin_3d, unit_level, parent_unit_id, flat_number, z_min, z_max
            FROM vertical_units
            WHERE unit_level = 'STOREY' AND building_id IN (SELECT id FROM buildings WHERE building_code = 'APARTMENT-SURYA-OSM')
            ORDER BY z_min;
        """)
        storeys = cur.fetchall()
        print(f"STOREY RECORDS (Count: {len(storeys)}):")
        for s in storeys:
            print(f"  {s[0]}: ULPIN={s[1]} | level={s[2]} | parent={s[3]} | flat={s[4]} | z=[{s[5]}, {s[6]}]")

        # Check sub-units
        cur.execute("""
            SELECT floor_code, prototype_ulpin_3d, unit_level, parent_unit_id, flat_number, z_min, z_max, unit_label,
                   ST_Area(ST_GeometryN(geom_3d, 1)) as area_sqm,
                   CG_Volume(CG_MakeSolid(geom_3d)) as volume_cbm,
                   status
            FROM vertical_units
            WHERE parent_unit_id IS NOT NULL
            ORDER BY unit_sequence;
        """)
        flats = cur.fetchall()
        print(f"\nFLAT / SUB-UNIT RECORDS (Count: {len(flats)}):")
        for f in flats:
            print(f"  Flat {f[4] or 'CORE'}: ULPIN={f[1]} | level={f[2]} | parent={f[3]} | z=[{f[5]}, {f[6]}] | Area={f[8]:.2f}m2 | Vol={f[9]:.2f}m3 | Status={f[10]}")
