"""Aplica um arquivo .sql no db_inhaus (uso: python scripts/aplicar_sql.py prisma/sql/NNN.sql)."""

import sys
from pathlib import Path

import psycopg2

from _banco import url_banco

if len(sys.argv) != 2:
    raise SystemExit("Uso: python scripts/aplicar_sql.py <arquivo.sql>")

sql = Path(sys.argv[1]).read_text(encoding="utf-8")
conn = psycopg2.connect(url_banco())
try:
    with conn, conn.cursor() as cur:
        cur.execute(sql)
    print(f"Aplicado: {sys.argv[1]}")
finally:
    conn.close()
