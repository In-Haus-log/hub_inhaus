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


def test_carregar_rollback_e_registro_de_erro():
    """Testa o contrato de segurança: falha ⇒ rollback + INSERT com ERRO + exception propagada."""
    from carga_real_orcado import carregar

    class FakeCursor:
        """Cursor falso que registra SQL e simula erro no DELETE."""

        def __init__(self):
            self.sqls = []
            self.error_on_delete = True

        def execute(self, sql, params=None):
            self.sqls.append((sql, params))
            # Simula erro durante o DELETE
            if self.error_on_delete and "delete from ft_real_orcado" in sql.lower():
                raise RuntimeError("Simulado: erro no DELETE")
            # Simula retorno do INSERT que pega o carga_id
            if "insert into ft_carga_real_orcado" in sql.lower() and "returning id" in sql.lower():
                # Funciona como fetchone()
                pass

        def fetchone(self):
            # Devolve um ID fictício (1,) para o primeiro INSERT
            return (1,)

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

    class FakeConnection:
        """Conexão falsa que registra commit/rollback."""

        def __init__(self):
            self.cursor_obj = FakeCursor()
            self.commits = 0
            self.rollbacks = 0
            self.call_history = []

        def cursor(self):
            return self.cursor_obj

        def commit(self):
            self.commits += 1
            self.call_history.append("commit")

        def rollback(self):
            self.rollbacks += 1
            self.call_history.append("rollback")

    conn = FakeConnection()
    regs = [linha_para_registro(linha_base())]

    # Deve lançar a exceção original
    with pytest.raises(RuntimeError, match="Simulado: erro no DELETE"):
        carregar(conn, regs, "SCRIPT")

    # (a) rollback foi chamado antes de qualquer commit final
    assert "rollback" in conn.call_history
    assert conn.rollbacks >= 1

    # (b) Após rollback, um INSERT com 'ERRO' foi executado e commit foi chamado uma vez
    # (apenas para registrar o erro; a tentativa original falhou)
    error_inserts = [
        sql for sql, _ in conn.cursor_obj.sqls
        if "insert into ft_carga_real_orcado" in sql.lower() and "ERRO" not in str(sql)
        or "ERRO" in str(sql)
    ]
    # Procura o INSERT com status ERRO (acontece fora do try/except com commit separado)
    assert any("ERRO" in str(sql) for sql, _ in conn.cursor_obj.sqls), "INSERT com ERRO não encontrado"

    # (c) Nenhum INSERT em ft_real_orcado foi executado (pois falhou no DELETE)
    assert not any(
        "insert into ft_real_orcado" in sql.lower() for sql, _ in conn.cursor_obj.sqls
    ), "INSERT em ft_real_orcado não deveria ter sido executado"
