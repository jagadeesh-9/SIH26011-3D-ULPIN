import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
conn_str = os.getenv('DATABASE_URL', 'postgresql://postgres:8919223622@localhost:5432/sih26011_dev')
if conn_str.startswith('postgresql+psycopg://'):
    conn_str = conn_str.replace('postgresql+psycopg://', 'postgresql://')

with open('backend/migrations/004_flat_subdivision.sql', 'r') as f:
    sql = f.read()

with psycopg.connect(conn_str) as conn:
    with conn.cursor() as cur:
        print("Executing migration 004_flat_subdivision.sql...")
        cur.execute(sql)
        conn.commit()
        print("Migration 004_flat_subdivision.sql successfully applied!")
