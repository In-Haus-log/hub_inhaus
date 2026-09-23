from datetime import date
from decimal import Decimal

import pytest

from _banco import limpar_url
from carga_real_orcado import (
    COLUNAS_EXPORT,
    competencia_de,
    linha_para_registro,
    resumo,
    validar_cabecalho,
)


def linha_base(**extra):
    linha = {col: "X" for col in COLUNAS_EXPORT}
    linha.update({"MES": "2026/07", "CONTA": "41101001", "RE": -10.0, "OR": 0.0})
    linha.update(extra)
    return linha


def test_competencia_converte_para_primeiro_dia():
    assert competencia_de("2026/07") == date(2026, 7, 1)


@pytest.mark.parametrize("valor", ["2026-07", "07/2026", "2026/13", "", None])
def test_competencia_invalida(valor):
    with pytest.raises(ValueError):
        competencia_de(valor)


def test_cabecalho_sem_coluna_obrigatoria():
    colunas = [c for c in COLUNAS_EXPORT if c != "CR"]
    with pytest.raises(ValueError, match="CR"):
        validar_cabecalho(colunas)


def test_registro_arredonda_valor_e_trata_vazios():
    reg = linha_para_registro(linha_base(RE=-741.855, OR=float("nan"), HISTORICO=float("nan"), LOTE="  "))
    assert reg["valor_realizado"] == Decimal("-741.86")
    assert reg["valor_orcado"] == Decimal("0.00")
    assert reg["historico"] is None
    assert reg["lote"] is None
    assert reg["conta"] == "41101001"
    assert reg["competencia"] == date(2026, 7, 1)


def test_registro_sem_conta_falha():
    with pytest.raises(ValueError):
        linha_para_registro(linha_base(CONTA=float("nan")))


def test_resumo_soma_e_lista_meses():
    regs = [
        linha_para_registro(linha_base(MES="2026/07", RE=100.0)),
        linha_para_registro(linha_base(MES="2026/06", RE=-30.5, OR=-40.0)),
    ]
    r = resumo(regs)
    assert r["competencias"] == [date(2026, 6, 1), date(2026, 7, 1)]
    assert r["linhas"] == 2
    assert r["total_realizado"] == Decimal("69.50")
    assert r["total_orcado"] == Decimal("-40.00")


def test_limpar_url_remove_schema():
    url = "postgresql://u:p@host:5432/db?schema=public&sslmode=require"
    assert limpar_url(url) == "postgresql://u:p@host:5432/db?sslmode=require"
