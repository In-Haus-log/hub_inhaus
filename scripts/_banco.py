"""
Resolve a URL do Postgres (db_inhaus) para os scripts Python do hub.

Ordem: variáveis de ambiente DATABASE_URL_INHAUS / DATABASE_URL e, se não houver,
o arquivo .env.local da raiz do projeto. O parâmetro `schema=` (usado pelo Prisma)
é removido porque o psycopg2 não o aceita.
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

CHAVES = ("DATABASE_URL_INHAUS", "DATABASE_URL")


def limpar_url(url: str) -> str:
    """Remove da query string os parâmetros que o psycopg2 não entende (ex.: schema)."""
    partes = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(partes.query) if k != "schema"]
    return urlunsplit(partes._replace(query=urlencode(query)))


def _ler_env_local() -> dict[str, str]:
    arquivo = Path(__file__).resolve().parent.parent / ".env.local"
    if not arquivo.exists():
        return {}
    valores: dict[str, str] = {}
    for linha in arquivo.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        valores[chave.strip()] = valor.strip().strip("\"'")
    return valores


def url_banco() -> str:
    for chave in CHAVES:
        if os.environ.get(chave):
            return limpar_url(os.environ[chave])
    env = _ler_env_local()
    for chave in CHAVES:
        if env.get(chave):
            return limpar_url(env[chave])
    raise SystemExit("Defina DATABASE_URL_INHAUS (ou DATABASE_URL) no ambiente ou no .env.local.")
