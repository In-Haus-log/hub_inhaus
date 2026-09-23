"""
Carga do relatório RE x RO (Realizado × Orçado contábil do sistema da GPS) na
tabela public.ft_real_orcado do db_inhaus. É o script de carga do histórico e a
implementação de REFERÊNCIA para o RPA (mesma regra).

Regra de carga (spec 2026-09-23, §5.4), numa ÚNICA transação:
  1. registra a execução em ft_carga_real_orcado;
  2. apaga de ft_real_orcado os meses de competência presentes no arquivo;
  3. insere todos os lançamentos do arquivo (com carga_id);
  4. fecha a execução com totais e status OK.
Qualquer falha ⇒ rollback (nada muda) e a falha é registrada com status ERRO.
Rodar duas vezes o mesmo arquivo dá o mesmo resultado (idempotente).

Uso:
  python scripts/carga_real_orcado.py <arquivo.xlsx>            (simulação: só mostra o resumo)
  python scripts/carga_real_orcado.py <arquivo.xlsx> --apply    (grava)
"""

from __future__ import annotations

import argparse
import math
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any, Iterable, Mapping

# Cabeçalho do export → coluna da ft_real_orcado.
COLUNAS_EXPORT: dict[str, str] = {
    "MES": "competencia",
    "CONQ PERDA": "conq_perda",
    "TIPO CLIENTE": "tipo_cliente",
    "SEG CLIENTE": "seg_cliente",
    "EMP M A": "empresa",
    "CONTA": "conta",
    "DESC CONTA": "desc_conta",
    "GRUPO1": "grupo1",
    "GRUPO2": "grupo2",
    "RE": "valor_realizado",
    "OR": "valor_orcado",
    "CR": "cr",
    "PEC": "pec",
    "REGIONAL": "regional",
    "NEGOCIO": "negocio",
    "CLIENTE": "cliente",
    "CENTRO CUSTO": "centro_custo",
    "GERENTE": "gerente",
    "SUPERVISOR": "supervisor",
    "DIR REG": "dir_reg",
    "DIR EXE": "dir_exe",
    "GRUPO IND": "grupo_ind",
    "GERENTE GERAL": "gerente_geral",
    "HISTORICO": "historico",
    "ORIGEM": "origem",
    "LOTE": "lote",
    "SOLUCAO": "solucao",
    "EMP CTB": "emp_ctb",
    "NOME EMP CTB": "nome_emp_ctb",
    "REG EMP CTB": "reg_emp_ctb",
    "REG CR": "reg_cr",
}
COLUNAS_DB = list(COLUNAS_EXPORT.values())
COLUNAS_VALOR = {"valor_realizado", "valor_orcado"}
# Lidas como texto para não perder zeros à esquerda nem virar número (ex.: CONTA, LOTE).
COLUNAS_TEXTO_EXPORT = [c for c, db in COLUNAS_EXPORT.items() if db not in COLUNAS_VALOR]
CENTAVO = Decimal("0.01")


def competencia_de(mes: Any) -> date:
    """'2026/07' → date(2026, 7, 1)."""
    texto = "" if mes is None else str(mes).strip()
    partes = texto.split("/")
    if len(partes) != 2 or not all(p.isdigit() for p in partes) or len(partes[0]) != 4:
        raise ValueError(f"Mês inválido: {mes!r} (esperado AAAA/MM)")
    ano, numero = int(partes[0]), int(partes[1])
    if not 1 <= numero <= 12:
        raise ValueError(f"Mês inválido: {mes!r} (esperado AAAA/MM)")
    return date(ano, numero, 1)


def validar_cabecalho(colunas: Iterable[str]) -> None:
    presentes = set(colunas)
    faltando = [c for c in COLUNAS_EXPORT if c not in presentes]
    if faltando:
        raise ValueError("Colunas ausentes no arquivo: " + ", ".join(faltando))


def _vazio(valor: Any) -> bool:
    if valor is None:
        return True
    if isinstance(valor, float) and math.isnan(valor):
        return True
    return isinstance(valor, str) and valor.strip() == ""


def _valor(valor: Any) -> Decimal:
    if _vazio(valor):
        return Decimal("0.00")
    return Decimal(str(valor)).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def linha_para_registro(linha: Mapping[str, Any]) -> dict[str, Any]:
    registro: dict[str, Any] = {}
    for col_export, col_db in COLUNAS_EXPORT.items():
        valor = linha.get(col_export)
        if col_db == "competencia":
            registro[col_db] = competencia_de(valor)
        elif col_db in COLUNAS_VALOR:
            registro[col_db] = _valor(valor)
        else:
            registro[col_db] = None if _vazio(valor) else str(valor).strip()
    if not registro["conta"]:
        raise ValueError("Lançamento sem CONTA no arquivo.")
    return registro


def ler_export(caminho: str | Path) -> list[dict[str, Any]]:
    import pandas as pd

    df = pd.read_excel(caminho, dtype={c: str for c in COLUNAS_TEXTO_EXPORT})
    validar_cabecalho(df.columns)
    return [linha_para_registro(linha) for linha in df.to_dict("records")]


def resumo(registros: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "competencias": sorted({r["competencia"] for r in registros}),
        "linhas": len(registros),
        "total_realizado": sum((r["valor_realizado"] for r in registros), Decimal("0.00")),
        "total_orcado": sum((r["valor_orcado"] for r in registros), Decimal("0.00")),
    }


def carregar(conn, registros: list[dict[str, Any]], origem: str) -> int:
    """Grava os registros substituindo os meses do arquivo. Devolve o id da carga."""
    from psycopg2.extras import execute_values

    if not registros:
        raise ValueError("O arquivo não tem lançamentos.")
    r = resumo(registros)
    colunas = COLUNAS_DB + ["carga_id"]
    try:
        with conn.cursor() as cur:
            cur.execute(
                "insert into ft_carga_real_orcado (origem, competencias) values (%s, %s) returning id",
                (origem, r["competencias"]),
            )
            carga_id = cur.fetchone()[0]
            cur.execute("delete from ft_real_orcado where competencia = any(%s)", (r["competencias"],))
            execute_values(
                cur,
                f"insert into ft_real_orcado ({', '.join(colunas)}) values %s",
                [tuple(reg[c] for c in COLUNAS_DB) + (carga_id,) for reg in registros],
                page_size=5000,
            )
            cur.execute(
                """update ft_carga_real_orcado
                      set linhas = %s, total_realizado = %s, total_orcado = %s,
                          concluido_em = now(), status = 'OK'
                    where id = %s""",
                (r["linhas"], r["total_realizado"], r["total_orcado"], carga_id),
            )
        conn.commit()
        return carga_id
    except Exception as erro:
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute(
                """insert into ft_carga_real_orcado (origem, competencias, concluido_em, status, mensagem)
                   values (%s, %s, now(), 'ERRO', %s)""",
                (origem, r["competencias"], str(erro)[:1000]),
            )
        conn.commit()
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Carga do RE x RO na ft_real_orcado.")
    parser.add_argument("arquivo")
    parser.add_argument("--apply", action="store_true", help="grava no banco (sem = simulação)")
    parser.add_argument("--origem", default="SCRIPT", choices=["SCRIPT", "RPA"])
    args = parser.parse_args()

    registros = ler_export(args.arquivo)
    r = resumo(registros)
    meses = ", ".join(d.strftime("%Y/%m") for d in r["competencias"])
    print(f"Meses no arquivo: {meses}")
    print(f"Lançamentos: {r['linhas']}  Realizado: {r['total_realizado']}  Orçado: {r['total_orcado']}")
    if not args.apply:
        print("Simulação: nada gravado. Use --apply para gravar.")
        return

    import psycopg2

    from _banco import url_banco

    conn = psycopg2.connect(url_banco())
    try:
        carga_id = carregar(conn, registros, args.origem)
        print(f"Carga {carga_id} concluída.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
