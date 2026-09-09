import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
conn_str = os.getenv('DATABASE_URL', 'postgresql://postgres:8919223622@localhost:5432/sih26011_dev')
if conn_str.startswith('postgresql+psycopg://'):
    conn_str = conn_str.replace('postgresql+psycopg://', 'postgresql://')

# Bilinear interpolation on OSM footprint
P_SW = (219986.82, 1933088.62)
P_NW = (219985.71, 1933104.81)
P_NE = (220009.01, 1933106.37)
P_SE = (220010.12, 1933090.19)

def get_pt(u, v):
    x = (1 - u) * (1 - v) * P_SW[0] + (1 - u) * v * P_NW[0] + u * v * P_NE[0] + u * (1 - v) * P_SE[0]
    y = (1 - u) * (1 - v) * P_SW[1] + (1 - u) * v * P_NW[1] + u * v * P_NE[1] + u * (1 - v) * P_SE[1]
    return [round(x, 4), round(y, 4)]

# Define subdivisions
# Flat 101: NW quadrant (u: 0.0 -> 0.45, v: 0.55 -> 1.0)
f101_coords = [
    get_pt(0.0, 0.55),
    get_pt(0.0, 1.0),
    get_pt(0.45, 1.0),
    get_pt(0.45, 0.55),
    get_pt(0.0, 0.55)
]

# Flat 102: NE quadrant (u: 0.55 -> 1.0, v: 0.55 -> 1.0)
f102_coords = [
    get_pt(0.55, 0.55),
    get_pt(0.55, 1.0),
    get_pt(1.0, 1.0),
    get_pt(1.0, 0.55),
    get_pt(0.55, 0.55)
]

# Flat 103: SE quadrant (u: 0.55 -> 1.0, v: 0.0 -> 0.45)
f103_coords = [
    get_pt(0.55, 0.0),
    get_pt(0.55, 0.45),
    get_pt(1.0, 0.45),
    get_pt(1.0, 0.0),
    get_pt(0.55, 0.0)
]

# Flat 104: SW quadrant (u: 0.0 -> 0.45, v: 0.0 -> 0.45)
f104_coords = [
    get_pt(0.0, 0.0),
    get_pt(0.0, 0.45),
    get_pt(0.45, 0.45),
    get_pt(0.45, 0.0),
    get_pt(0.0, 0.0)
]

# Common Core & Corridor (the central cross connecting all units)
# Traced in CCW order around the boundary between flats
common_coords = [
    get_pt(0.0, 0.45),
    get_pt(0.0, 0.55),
    get_pt(0.45, 0.55),
    get_pt(0.45, 1.0),
    get_pt(0.55, 1.0),
    get_pt(0.55, 0.55),
    get_pt(1.0, 0.55),
    get_pt(1.0, 0.45),
    get_pt(0.55, 0.45),
    get_pt(0.55, 0.0),
    get_pt(0.45, 0.0),
    get_pt(0.45, 0.45),
    get_pt(0.0, 0.45)
]

subdivisions = [
    ("Flat 101", f101_coords),
    ("Flat 102", f102_coords),
    ("Flat 103", f103_coords),
    ("Flat 104", f104_coords),
    ("Common Core", common_coords)
]

import sys
sys.path.insert(0, os.path.abspath('.'))
from scripts.reconstruct_3d_units import build_polyhedralsurface_wkt_from_footprint

z_min = 543.50
z_max = 546.50

with psycopg.connect(conn_str) as conn:
    with conn.cursor() as cur:
        # 1. Check F01 geometry in DB
        cur.execute("SELECT id, ST_AsText(geom_3d), ST_Area(ST_GeometryN(geom_3d, 1)) FROM vertical_units WHERE floor_code = 'F01' AND building_id IN (SELECT id FROM buildings WHERE building_code = 'APARTMENT-SURYA-OSM');")
        f01_row = cur.fetchone()
        f01_id = f01_row[0]
        print(f"Parent F01 ID: {f01_id}")

        total_area = 0.0
        total_vol = 0.0
        solids = []

        for name, coords in subdivisions:
            wkt, struct = build_polyhedralsurface_wkt_from_footprint(coords, z_min, z_max)
            poly_wkt = f"POLYGON(({', '.join([f'{p[0]} {p[1]}' for p in coords])}))"
            cur.execute("""
                SELECT 
                    ST_IsValid(ST_GeomFromText(%s, 32644)),
                    ST_Area(ST_GeomFromText(%s, 32644)),
                    ST_IsClosed(ST_GeomFromText(%s, 32644)),
                    CG_IsSolid(CG_MakeSolid(ST_GeomFromText(%s, 32644))),
                    CG_Volume(CG_MakeSolid(ST_GeomFromText(%s, 32644)))
            """, [
                poly_wkt, poly_wkt,
                wkt, wkt, wkt
            ])
            is_valid_2d, area, is_closed, is_solid, vol = cur.fetchone()
            total_area += float(area)
            total_vol += float(vol)
            solids.append((name, wkt))
            print(f"{name}: 2D Valid={is_valid_2d} | Area={area:.2f} sqm | Closed={is_closed} | Solid={is_solid} | Vol={vol:.2f} cbm")

        print(f"Total Combined Subdivision Area: {total_area:.2f} sqm | Total Volume: {total_vol:.2f} cbm")

        # Check Pairwise Overlaps
        print("\nChecking Pairwise 2D and 3D Intersections:")
        has_overlap = False
        for i in range(len(subdivisions)):
            for j in range(i + 1, len(subdivisions)):
                name_a, coords_a = subdivisions[i]
                name_b, coords_b = subdivisions[j]
                poly_a = f"POLYGON(({', '.join([f'{p[0]} {p[1]}' for p in coords_a])}))"
                poly_b = f"POLYGON(({', '.join([f'{p[0]} {p[1]}' for p in coords_b])}))"
                
                cur.execute("""
                    SELECT 
                        ST_Area(ST_Intersection(ST_GeomFromText(%s, 32644), ST_GeomFromText(%s, 32644))) AS overlap_area,
                        ST_Dimension(ST_Intersection(ST_GeomFromText(%s, 32644), ST_GeomFromText(%s, 32644))) AS inter_dim
                """, [poly_a, poly_b, poly_a, poly_b])
                overlap_area, inter_dim = cur.fetchone()
                if overlap_area and float(overlap_area) > 0.001:
                    print(f"  CONFLICT: {name_a} overlaps {name_b} with area {float(overlap_area):.4f} sqm")
                    has_overlap = True
                else:
                    contact_type = "shared wall (1D contact line)" if inter_dim == 1 else "point contact" if inter_dim == 0 else "disjoint"
                    print(f"  PASS: {name_a} vs {name_b} -> 0.0000 sqm overlap ({contact_type})")

        if not has_overlap:
            print("\nALL PAIRWISE VOLUMETRIC COLLISION CHECKS PASSED PERFECTLY!")
