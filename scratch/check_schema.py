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
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'vertical_units' 
            ORDER BY ordinal_position;
        """)
        rows = cur.fetchall()
        print("Columns in vertical_units:")
        for r in rows:
            print(f"  {r[0]}: {r[1]} (nullable: {r[2]})")
