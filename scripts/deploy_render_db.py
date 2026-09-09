"""
SIH26011: Safe Production Database Deployment & Verification Script.

Connects to the database specified by DATABASE_URL (or RENDER_DATABASE_URL).
Guards against accidental execution on local development database.
Performs read-only inspection, safe ordered migration execution, and verification.
"""
import os
import sys
import json
import uuid
import urllib.parse
from pathlib import Path
import psycopg
from dotenv import load_dotenv

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def get_connection_url() -> str:
    """Retrieves and normalizes DATABASE_URL from environment or arguments."""
    # Check command-line arguments for explicit url
    for arg in sys.argv[1:]:
        if arg.startswith("--url="):
            return arg.split("=", 1)[1].strip()

    # Check environment variables
    url = os.getenv("RENDER_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not url:
        # Check if .env.render exists
        render_env = PROJECT_ROOT / ".env.render"
        if render_env.exists():
            for line in render_env.read_text().splitlines():
                if line.startswith("DATABASE_URL="):
                    url = line.split("=", 1)[1].strip()
                    break

    if not url:
        raise ValueError(
            "DATABASE_URL is not set. Please set $env:DATABASE_URL in your PowerShell terminal, "
            "or pass --url='postgres://...' or set [System.Environment]::SetEnvironmentVariable('DATABASE_URL', $env:DATABASE_URL, 'User')"
        )

    # Normalize driver dialect for psycopg3
    clean = url.strip()
    if clean.startswith("postgresql+psycopg://"):
        clean = clean.replace("postgresql+psycopg://", "postgresql://", 1)
    return clean


def mask_url(url: str) -> str:
    try:
        p = urllib.parse.urlparse(url)
        return f"{p.scheme}://{p.username}:***@{p.hostname}:{p.port}{p.path}"
    except Exception:
        return "<masked-url>"


def assert_not_local(conn_url: str):
    """Safety guard: prevents running against local development database."""
    parsed = urllib.parse.urlparse(conn_url)
    host = (parsed.hostname or "").lower()
    db = (parsed.path or "").strip("/").lower()

    is_local = host in ("localhost", "127.0.0.1", "::1") or db == "sih26011_dev"
    if is_local and "--force-local" not in sys.argv:
        raise RuntimeError(
            f"SAFETY ABORT: DATABASE_URL points to local database ({host}/{db}). "
            "This script is intended for Render production initialization. "
            "If you really intended to run on local dev, pass --force-local."
        )


def inspect_database(conn: psycopg.Connection) -> dict:
    """Phase 1: Read-only inspection of target database."""
    with conn.cursor() as cur:
        # 1. Database name and PostgreSQL version
        cur.execute("SELECT current_database(), version();")
        row = cur.fetchone()
        db_name = row[0]
        pg_version = row[1]

        # 2. PostGIS and SFCGAL version
        postgis_ver = None
        sfcgal_ver = None
        try:
            cur.execute("SELECT PostGIS_Version(), PostGIS_SFCGAL_Version();")
            ext_row = cur.fetchone()
            postgis_ver = ext_row[0]
            sfcgal_ver = ext_row[1]
        except Exception as e:
            conn.rollback()
            try:
                cur.execute("SELECT PostGIS_Version();")
                postgis_ver = cur.fetchone()[0]
            except Exception:
                conn.rollback()

        # 3. Existing tables
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        tables = [r[0] for r in cur.fetchall()]

        # 4. Check core tables
        has_parcels = "parcels" in tables
        has_buildings = "buildings" in tables
        has_vertical_units = "vertical_units" in tables

        # 5. Row counts if tables exist
        counts = {}
        if has_parcels:
            cur.execute("SELECT COUNT(*) FROM parcels;")
            counts["parcels"] = cur.fetchone()[0]
        if has_buildings:
            cur.execute("SELECT COUNT(*) FROM buildings;")
            counts["buildings"] = cur.fetchone()[0]
        if has_vertical_units:
            cur.execute("SELECT COUNT(*) FROM vertical_units;")
            counts["vertical_units"] = cur.fetchone()[0]

        return {
            "database_name": db_name,
            "pg_version": pg_version,
            "postgis_version": postgis_ver,
            "sfcgal_version": sfcgal_ver,
            "tables": tables,
            "has_parcels": has_parcels,
            "has_buildings": has_buildings,
            "has_vertical_units": has_vertical_units,
            "counts": counts
        }


def execute_sql_file(conn: psycopg.Connection, file_path: Path) -> str:
    """Executes a single SQL migration file."""
    if not file_path.exists():
        raise FileNotFoundError(f"Migration file missing: {file_path}")
    
    sql_text = file_path.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql_text)
    conn.commit()
    return f"Successfully applied {file_path.name}"


def run_seed_scripts(conn_url: str):
    """Seeds OpenStreetMap-anchored apartment (Surya Heights) and sub-units."""
    # Ensure DATABASE_URL is set in os.environ for the seed script
    os.environ["DATABASE_URL"] = conn_url

    from scripts.seed_osm_anchored_apartment import seed_osm_anchored_apartment
    from scripts.seed_canonical_indian_apartment import seed_canonical_indian_apartment
    from scripts.seed_vertical_mixed_a import seed_vertical_mixed_a
    from scripts.seed_f01_flats import seed_f01_flats

    print("\n--- Seeding Canonical Research Scenarios ---")
    seed_canonical_indian_apartment()
    seed_osm_anchored_apartment()
    seed_vertical_mixed_a()
    seed_f01_flats()


def verify_production_database(conn: psycopg.Connection) -> dict:
    """Phase 4 & 5: Complete verification and duplicate audit."""
    with conn.cursor() as cur:
        # Check extensions
        cur.execute("SELECT PostGIS_Version(), PostGIS_SFCGAL_Version();")
        ext = cur.fetchone()

        # Counts
        cur.execute("SELECT COUNT(*) FROM parcels;")
        parcel_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM buildings;")
        building_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM vertical_units;")
        unit_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM source_evidence;")
        evidence_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM verification_audit;")
        audit_count = cur.fetchone()[0]

        # Check ULPIN 36A1B2C3D4E5F9
        cur.execute("""
            SELECT id, ulpin_2d, survey_number, area_sqm, 
                   ST_IsValid(geom_2d) as geom_valid,
                   ST_GeometryType(geom_2d) as geom_type
            FROM parcels 
            WHERE ulpin_2d = '36A1B2C3D4E5F9';
        """)
        surya_parcel = cur.fetchone()

        # Check Sequence
        cur.execute("SELECT last_value, is_called FROM vertical_unit_seq;")
        seq_info = cur.fetchone()

        # Duplicate audits
        cur.execute("SELECT ulpin_2d, COUNT(*) FROM parcels GROUP BY ulpin_2d HAVING COUNT(*) > 1;")
        dup_parcels = cur.fetchall()

        cur.execute("SELECT parcel_id, building_code, COUNT(*) FROM buildings GROUP BY parcel_id, building_code HAVING COUNT(*) > 1;")
        dup_buildings = cur.fetchall()

        cur.execute("SELECT prototype_ulpin_3d, COUNT(*) FROM vertical_units GROUP BY prototype_ulpin_3d HAVING COUNT(*) > 1;")
        dup_units = cur.fetchall()

        return {
            "postgis": ext[0],
            "sfcgal": ext[1],
            "parcels": parcel_count,
            "buildings": building_count,
            "vertical_units": unit_count,
            "evidence": evidence_count,
            "audit": audit_count,
            "surya_parcel": {
                "id": str(surya_parcel[0]) if surya_parcel else None,
                "ulpin": surya_parcel[1] if surya_parcel else None,
                "survey_number": surya_parcel[2] if surya_parcel else None,
                "area_sqm": float(surya_parcel[3]) if surya_parcel else None,
                "is_valid": surya_parcel[4] if surya_parcel else None,
                "geom_type": surya_parcel[5] if surya_parcel else None,
            } if surya_parcel else None,
            "sequence": {
                "last_value": seq_info[0],
                "is_called": seq_info[1]
            } if seq_info else None,
            "duplicates": {
                "parcels": len(dup_parcels),
                "buildings": len(dup_buildings),
                "vertical_units": len(dup_units)
            }
        }


def main():
    try:
        conn_url = get_connection_url()
    except ValueError as e:
        print(f"CONFIGURATION ERROR: {e}")
        sys.exit(1)

    assert_not_local(conn_url)
    print(f"Connected Target Database: {mask_url(conn_url)}")

    inspect_only = "--inspect-only" in sys.argv

    conn = psycopg.connect(conn_url)
    try:
        # Phase 1: Inspection
        print("\n==========================================")
        print("PHASE 1: READ-ONLY DATABASE INSPECTION")
        print("==========================================")
        inspection = inspect_database(conn)
        print(f"Database Name:      {inspection['database_name']}")
        print(f"PostgreSQL Version: {inspection['pg_version'].split(',')[0]}")
        print(f"PostGIS Version:    {inspection['postgis_version']}")
        print(f"SFCGAL Version:     {inspection['sfcgal_version']}")
        print(f"Existing Tables:    {inspection['tables'] if inspection['tables'] else 'None (Fresh Database)'}")

        if inspect_only:
            print("\n[--inspect-only mode: Stopping before applying migrations]")
            return

        # Phase 2 & 3: Migration Execution
        print("\n==========================================")
        print("PHASE 2 & 3: MIGRATION EXECUTION")
        print("==========================================")
        migrations = [
            PROJECT_ROOT / "backend" / "migrations" / "001_initial_schema.sql",
            PROJECT_ROOT / "backend" / "migrations" / "002_seed_synthetic_dataset.sql",
            PROJECT_ROOT / "backend" / "migrations" / "003_unit_sequence.sql",
            PROJECT_ROOT / "backend" / "migrations" / "004_flat_subdivision.sql",
        ]

        for migration in migrations:
            print(f"Applying: {migration.name}...")
            res = execute_sql_file(conn, migration)
            print(f"-> {res}")

        # Seed the research prototype datasets (Surya Heights & multi-tier scenarios)
        run_seed_scripts(conn_url)

        # Synchronize sequence
        with conn.cursor() as cur:
            cur.execute("""
                SELECT setval(
                    'vertical_unit_seq', 
                    GREATEST(COALESCE((SELECT MAX(unit_sequence) FROM vertical_units), 0) + 1, 7), 
                    false
                );
            """)
            conn.commit()

        # Phase 4 & 5: Verification & Duplicate Check
        print("\n==========================================")
        print("PHASE 4 & 5: VERIFICATION & DUPLICATE CHECK")
        print("==========================================")
        verif = verify_production_database(conn)
        print(f"PostGIS:         {verif['postgis']}")
        print(f"SFCGAL:          {verif['sfcgal']}")
        print(f"Parcels:         {verif['parcels']}")
        print(f"Buildings:       {verif['buildings']}")
        print(f"Vertical Units:  {verif['vertical_units']}")
        print(f"Source Evidence: {verif['evidence']}")
        print(f"Audit Trail:     {verif['audit']}")
        print(f"Surya Heights:   {verif['surya_parcel']}")
        print(f"Sequence:        {verif['sequence']}")
        print(f"Duplicates:      {verif['duplicates']}")

        print("\nCHECKPOINT 3 STATUS: READY")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
