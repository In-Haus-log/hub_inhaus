# Projeções — Etapa 1 (base histórica Realizado × Orçado) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carregar o relatório RE x RO no banco e entregar, em Financeiro › Projeções, uma tabela dinâmica (estilo matriz de BI) de Realizado × Orçado com ROL, MC e % Margem, isolada por CR.

**Architecture:** Uma tabela de lançamentos (`ft_real_orcado`) no grão do export, gravada por um carregador Python (o mesmo que o RPA vai usar) com recarga por mês numa transação; `dm_conta` dá nome/ordem às linhas do DRE; `ft_carga_real_orcado` registra cada carga. No hub, `src/lib/projecoes/` monta o SQL de agregação por nível (puro e testado), aplica as duas travas de isolamento e serve a tela server-side + rotas de API para expansão sob demanda, detalhe de lançamentos e opções de filtro.

**Tech Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · `pg` (`inhausPool`) · vitest · Python 3 + pandas + psycopg2 + pytest (carregador).

**Spec:** `docs/superpowers/specs/2026-09-23-projecoes-base-historica-design.md`

## Global Constraints

- **NUNCA** `prisma db push` / `prisma migrate` (dropa as tabelas da SRA). Schema = SQL manual idempotente em `prisma/sql/*.sql`, aplicado com `python scripts/aplicar_sql.py <arquivo>`; depois `npx prisma generate`.
- Tabelas novas com prefixo `ft_`/`dm_`: `ft_real_orcado`, `dm_conta`, `ft_carga_real_orcado`, cada uma com `COMMENT ON TABLE` (texto exato da spec §5).
- Isolamento: **Trava 1** `predicadoSraCr(escopo, "f.cr", n)` em TODA query de dado; **Trava 2** `assertLinhasNoEscopo` sempre que o CR vier na saída (nível CR e detalhe).
- Chave de tela: `projecoes-analise`; rota `/dashboards/financeiro/projecoes`; registrada em `src/lib/domains.ts` (fonte de verdade).
- ROL = soma do grupo `3 - RECEITA` (`grupo1 like '3%'`); MC = soma de todos os lançamentos; % Margem = MC ÷ ROL; ROL = 0 ou Orçado = 0 ⇒ "—".
- Diferença R$ = Realizado − Orçado; Diferença % = (Realizado − Orçado) ÷ |Orçado| × 100; positivo = favorável (verde `text-emerald-700`), negativo = desfavorável (vermelho `text-red-600`).
- Mês sem lançamento ⇒ célula vazia (nunca zero inventado).
- Botão info (`InfoIndicador`) obrigatório, só regras de negócio, sem termo técnico.
- Visual: tokens do Tailwind (`.glass`, `.eyebrow`, `bg-inhaus-grad`, `text-navy`, `text-teal`…); nada de hex solto em componente.
- Toda UI, comentários e docs em português do Brasil.
- Verificação de cada entrega: `npx tsc --noEmit`, `npm run test`, `npm run build`; números conferidos no banco.
- Critério de aceite numérico: tela padrão (Linhas = Conta) com TOTAL jun/2026 = **1.407.294** e jul/2026 = **1.763.243**; ROL jul/2026 = **13.308.570**.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `prisma/sql/014_projecoes.sql` | cria as 3 tabelas, colunas derivadas, índices, comentários e o cadastro inicial da `dm_conta` |
| `prisma/schema.prisma` | models `FtRealOrcado`, `DmConta`, `FtCargaRealOrcado` (mapa das tabelas; o hub lê via SQL) |
| `scripts/_banco.py` | URL do banco a partir do ambiente / `.env.local` |
| `scripts/aplicar_sql.py` | aplica um arquivo `.sql` no banco |
| `scripts/carga_real_orcado.py` | carregador do RE x RO (script de histórico e referência para o RPA) |
| `scripts/test_carga_real_orcado.py` | testes (pytest) das funções puras do carregador |
| `src/lib/projecoes/dimensoes.ts` | catálogo de dimensões (chave → rótulo); puro, usado no client e no server |
| `src/lib/projecoes/parametros.ts` | estado da análise ⇄ URL, período padrão, meses do período, rótulo de mês; puro |
| `src/lib/projecoes/consulta.ts` | montagem do SQL (nível, totais, lançamentos, opções, meses) com Trava 1; puro |
| `src/lib/projecoes/calculos.ts` | agregação em nós, medidas, ROL/MC/% Margem, tom e formatação; puro |
| `src/lib/projecoes/csv.ts` | exportação dos lançamentos em CSV (abre no Excel); puro |
| `src/lib/projecoes/acesso.ts` | escopo da página e guarda das rotas de API |
| `src/lib/projecoes/dados.ts` | executa as consultas no banco (+ Trava 2) |
| `src/app/api/projecoes/{nivel,lancamentos,opcoes}/route.ts` | expansão sob demanda, detalhe/CSV, opções de filtro |
| `src/app/dashboards/financeiro/projecoes/page.tsx` | a tela |
| `src/components/projecoes/{ProjecoesInfo,ControlesAnalise,TabelaDinamica,DetalheLancamentos}.tsx` | UI |
| `src/components/admin/SeletorCrs.tsx` + `UsuariosAdmin.tsx` | reativa o vínculo de CRs na tela Usuários |
| `.claude/skills/modulo-projecoes/SKILL.md` + `CLAUDE.md` | documentação do módulo |

---

### Task 1: Schema do banco (3 tabelas + cadastro de contas)

**Files:**
- Create: `scripts/_banco.py`, `scripts/aplicar_sql.py`, `prisma/sql/014_projecoes.sql`
- Modify: `prisma/schema.prisma` (acrescentar ao final)

**Interfaces:**
- Produces: tabelas `public.ft_real_orcado`, `public.dm_conta`, `public.ft_carga_real_orcado` (colunas exatas abaixo); `scripts/_banco.py::url_banco() -> str`, `scripts/_banco.py::limpar_url(url: str) -> str`.

- [ ] **Step 1: Escrever o helper de conexão**

`scripts/_banco.py`:

```python
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
```

`scripts/aplicar_sql.py`:

```python
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
```

- [ ] **Step 2: Escrever o SQL idempotente**

`prisma/sql/014_projecoes.sql`:

```sql
-- 014_projecoes.sql — Módulo Projeções (etapa 1): base histórica Realizado × Orçado.
-- Idempotente. Aplicar com: python scripts/aplicar_sql.py prisma/sql/014_projecoes.sql
-- NUNCA via prisma db push/migrate (ver CLAUDE.md).

-- 1) Log das cargas --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ft_carga_real_orcado (
  id              bigserial PRIMARY KEY,
  iniciado_em     timestamptz   NOT NULL DEFAULT now(),
  concluido_em    timestamptz,
  origem          text          NOT NULL,
  competencias    date[]        NOT NULL DEFAULT '{}',
  linhas          integer       NOT NULL DEFAULT 0,
  total_realizado numeric(18,2) NOT NULL DEFAULT 0,
  total_orcado    numeric(18,2) NOT NULL DEFAULT 0,
  status          text          NOT NULL DEFAULT 'EM_ANDAMENTO',
  mensagem        text
);

COMMENT ON TABLE ft_carga_real_orcado IS
  'Registro de cada execução de carga do RE x RO (RPA ou script): quando rodou, quais meses substituiu, quantas linhas e os totais gravados. Usado para mostrar a data de atualização na tela e auditar cargas.';

-- 2) Plano de contas gerencial do DRE ----------------------------------------------
CREATE TABLE IF NOT EXISTS dm_conta (
  conta_mae text    PRIMARY KEY,
  nome      text    NOT NULL,
  grupo2    text,
  ordem     integer NOT NULL,
  ativo     boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE dm_conta IS
  'Plano de contas gerencial do DRE do módulo Projeções: uma linha por conta-mãe (5 dígitos), com nome, grupo e ordem de exibição. Traduz as contas detalhadas dos lançamentos nas linhas do DRE.';

-- 3) Lançamentos Realizado × Orçado ---------------------------------------------------
CREATE TABLE IF NOT EXISTS ft_real_orcado (
  id              bigserial PRIMARY KEY,
  competencia     date          NOT NULL,
  valor_realizado numeric(18,2) NOT NULL DEFAULT 0,
  valor_orcado    numeric(18,2) NOT NULL DEFAULT 0,
  origem          text,
  conta           text          NOT NULL,
  desc_conta      text,
  grupo1          text,
  grupo2          text,
  cr              text,
  centro_custo    text,
  pec             text,
  cliente         text,
  seg_cliente     text,
  tipo_cliente    text,
  regional        text,
  negocio         text,
  solucao         text,
  grupo_ind       text,
  gerente         text,
  supervisor      text,
  gerente_geral   text,
  dir_reg         text,
  dir_exe         text,
  empresa         text,
  emp_ctb         text,
  nome_emp_ctb    text,
  reg_emp_ctb     text,
  reg_cr          text,
  historico       text,
  lote            text,
  conq_perda      text,
  carga_id        bigint REFERENCES ft_carga_real_orcado(id),
  -- Derivadas: o RPA NÃO grava; o banco calcula.
  cr_cod text GENERATED ALWAYS AS (
    CASE
      WHEN cr IS NULL OR btrim(split_part(btrim(cr), ' - ', 1)) = '' THEN NULL
      WHEN length(split_part(btrim(cr), ' - ', 1)) < 5 THEN lpad(split_part(btrim(cr), ' - ', 1), 5, '0')
      ELSE split_part(btrim(cr), ' - ', 1)
    END
  ) STORED,
  pec_cod      text GENERATED ALWAYS AS (left(pec, 6)) STORED,
  pec_situacao text GENERATED ALWAYS AS (nullif(btrim(substring(pec from '.*/ (.*)$')), '')) STORED,
  conta_mae    text GENERATED ALWAYS AS (left(conta, 5)) STORED
);

COMMENT ON TABLE ft_real_orcado IS
  'Lançamentos contábeis de Realizado e Orçado por CR e conta, no mesmo grão do relatório RE x RO do sistema da GPS. Alimentada por RPA com recarga por mês de competência (os meses presentes no arquivo são substituídos integralmente). Base histórica do módulo Projeções.';

CREATE INDEX IF NOT EXISTS ft_real_orcado_competencia_idx ON ft_real_orcado (competencia);
CREATE INDEX IF NOT EXISTS ft_real_orcado_cr_comp_idx     ON ft_real_orcado (cr_cod, competencia);
CREATE INDEX IF NOT EXISTS ft_real_orcado_conta_comp_idx  ON ft_real_orcado (conta_mae, competencia);
CREATE INDEX IF NOT EXISTS ft_real_orcado_pec_idx         ON ft_real_orcado (pec_cod);

-- 4) Cadastro inicial: as 30 linhas do BI 1.2.05, na ordem do BI -----------------------
INSERT INTO dm_conta (conta_mae, nome, grupo2, ordem) VALUES
  ('31101', 'RECEITAS DE VENDAS E SERVICOS',                       '311 - RECEITA BRUTA',                          1),
  ('31201', 'IMPOSTOS S/FATURAMENTO',                              '312 - DEDUCOES DE RECEITA',                    2),
  ('41101', 'PESSOAL',                                             '411 - CUSTOS COM PESSOAL',                     3),
  ('41103', 'PARTICIPACAO NOS RESULTADOS',                         '411 - CUSTOS COM PESSOAL',                     4),
  ('41104', 'ENCARGOS SOCIAIS E TRABALHISTAS',                     '411 - CUSTOS COM PESSOAL',                     5),
  ('41105', 'PROVISOES TRABALHISTAS',                              '411 - CUSTOS COM PESSOAL',                     6),
  ('41106', 'BENEFICIOS',                                          '411 - CUSTOS COM PESSOAL',                     7),
  ('41201', 'MEDICINA E SEGURANCA TRABALHO',                       '412 - MEDICINA E SEGURANCA TRABALHO',          8),
  ('41301', 'TRANSPORTES',                                         '413 - DESPESAS COM TRANSPORTE',                9),
  ('41401', 'SERVICOS CONTRATADOS - PJ',                           '414 - SERVICOS E LOCACOES',                   10),
  ('41403', 'LOCACOES E LEASING',                                  '414 - SERVICOS E LOCACOES',                   11),
  ('41501', 'MATERIAIS DE CONSERVACAO E APOIO',                    '415 - MATERIAIS',                             12),
  ('41502', 'MATERIAL DE CONSUMO GERAL',                           '415 - MATERIAIS',                             13),
  ('41503', 'INSUMOS / CUSTO DE REVENDA',                          '415 - MATERIAIS',                             14),
  ('41504', 'INSUMOS/ PERECIVEIS NAO PERECIVEIS',                  '415 - MATERIAIS',                             15),
  ('41601', 'DESPESAS GERAIS',                                     '416 - DESPESAS GERAIS',                       16),
  ('41602', 'COMUNICACOES',                                        '416 - DESPESAS GERAIS',                       17),
  ('41603', 'VIAGENS E ESTADIAS',                                  '416 - DESPESAS GERAIS',                       18),
  ('41604', 'DESPESAS COM EXECUCOES JUDICIAIS TRABALHISTAS',       '416 - DESPESAS GERAIS',                       19),
  ('41606', 'PROVISOES CONTRATUAIS (PCO)',                         '416 - DESPESAS GERAIS',                       20),
  ('41607', 'DESPESAS COM EXECUCOES JUDICIAIS TRAB COLET PUB ACP', '416 - DESPESAS GERAIS',                       21),
  ('41608', 'DESPESAS COM EXECUCOES JUDICIAIS NAO TRABALHISTAS',   '416 - DESPESAS GERAIS',                       22),
  ('41701', 'IMPOSTOS, ADC., EMOLUMENTOS E LICENCAS',              '417 - IMPOSTOS, ADC., EMOLUMENTOS E LICENCAS', 23),
  ('41801', 'DEPRECIACOES/AMORTIZACOES',                           '418 - DEPRECIACOES/AMORTIZACOES',             24),
  ('41901', 'RECEITAS FINANCEIRAS',                                '419 - RESULTADO FINANCEIRO LIQUIDO',          25),
  ('41902', 'DESPESAS FINANCEIRAS',                                '419 - RESULTADO FINANCEIRO LIQUIDO',          26),
  ('42101', 'PERDAS COM CLIENTES',                                 '421 - PERDAS COM CLIENTES',                   27),
  ('43101', 'RECEITA NAO OPERACIONAL',                             '431 - RESULTADO NAO OPERACIONAL',             28),
  ('43201', 'VENDA DE ATIVO IMOBILIZADO',                          '432 - VENDA DE ATIVO IMOBILIZADO',            29),
  ('44101', 'DESPESAS NAO DEDUTIVEIS',                             '441 - DESPESAS NAO DEDUTIVEIS',               30)
ON CONFLICT (conta_mae) DO NOTHING;
```

- [ ] **Step 3: Aplicar no banco (duas vezes, para provar a idempotência)**

Run: `python scripts/aplicar_sql.py prisma/sql/014_projecoes.sql` e repetir o mesmo comando.
Expected: `Aplicado: prisma/sql/014_projecoes.sql` nas duas execuções, sem erro.

- [ ] **Step 4: Conferir comentários, cadastro e colunas derivadas (sem deixar lixo)**

Run:

```bash
python - <<'EOF'
import sys; sys.path.insert(0, "scripts")
import psycopg2
from _banco import url_banco
conn = psycopg2.connect(url_banco())
cur = conn.cursor()
cur.execute("select c.relname, obj_description(c.oid) is not null from pg_class c where c.relname in ('ft_real_orcado','dm_conta','ft_carga_real_orcado') order by 1")
print(cur.fetchall())
cur.execute("select count(*) from dm_conta"); print("dm_conta:", cur.fetchone()[0])
cur.execute("""insert into ft_real_orcado (competencia, conta, cr, pec) values
  ('2026-07-01', '41101001', '8732 - SP - LOG - TESTE', '188022 (SP e MG) - LOG - X / APRENDIZ/INDIRETO')
  returning cr_cod, pec_cod, pec_situacao, conta_mae""")
print(cur.fetchone())
conn.rollback(); conn.close()
EOF
```

Expected:
```
[('dm_conta', True), ('ft_carga_real_orcado', True), ('ft_real_orcado', True)]
dm_conta: 30
('08732', '188022', 'APRENDIZ/INDIRETO', '41101')
```

- [ ] **Step 5: Models no `schema.prisma`**

Acrescentar ao final de `prisma/schema.prisma`:

```prisma
// ---- Módulo Projeções (etapa 1) — tabelas criadas por prisma/sql/014_projecoes.sql ----
// O hub LÊ estas tabelas via SQL (src/lib/projecoes); quem grava é o carregador/RPA.
// cr_cod, pec_cod, pec_situacao e conta_mae são colunas GERADAS no banco: nunca gravar.

model FtCargaRealOrcado {
  id             BigInt    @id @default(autoincrement())
  iniciadoEm     DateTime  @default(now()) @map("iniciado_em") @db.Timestamptz(6)
  concluidoEm    DateTime? @map("concluido_em") @db.Timestamptz(6)
  origem         String
  competencias   DateTime[] @db.Date
  linhas         Int       @default(0)
  totalRealizado Decimal   @default(0) @map("total_realizado") @db.Decimal(18, 2)
  totalOrcado    Decimal   @default(0) @map("total_orcado") @db.Decimal(18, 2)
  status         String    @default("EM_ANDAMENTO")
  mensagem       String?
  lancamentos    FtRealOrcado[]

  @@map("ft_carga_real_orcado")
}

model DmConta {
  contaMae String  @id @map("conta_mae")
  nome     String
  grupo2   String?
  ordem    Int
  ativo    Boolean @default(true)

  @@map("dm_conta")
}

model FtRealOrcado {
  id             BigInt   @id @default(autoincrement())
  competencia    DateTime @db.Date
  valorRealizado Decimal  @default(0) @map("valor_realizado") @db.Decimal(18, 2)
  valorOrcado    Decimal  @default(0) @map("valor_orcado") @db.Decimal(18, 2)
  origem         String?
  conta          String
  descConta      String?  @map("desc_conta")
  grupo1         String?
  grupo2         String?
  cr             String?
  centroCusto    String?  @map("centro_custo")
  pec            String?
  cliente        String?
  segCliente     String?  @map("seg_cliente")
  tipoCliente    String?  @map("tipo_cliente")
  regional       String?
  negocio        String?
  solucao        String?
  grupoInd       String?  @map("grupo_ind")
  gerente        String?
  supervisor     String?
  gerenteGeral   String?  @map("gerente_geral")
  dirReg         String?  @map("dir_reg")
  dirExe         String?  @map("dir_exe")
  empresa        String?
  empCtb         String?  @map("emp_ctb")
  nomeEmpCtb     String?  @map("nome_emp_ctb")
  regEmpCtb      String?  @map("reg_emp_ctb")
  regCr          String?  @map("reg_cr")
  historico      String?
  lote           String?
  conqPerda      String?  @map("conq_perda")
  cargaId        BigInt?  @map("carga_id")
  carga          FtCargaRealOrcado? @relation(fields: [cargaId], references: [id])
  crCod          String?  @map("cr_cod")
  pecCod         String?  @map("pec_cod")
  pecSituacao    String?  @map("pec_situacao")
  contaMae       String?  @map("conta_mae")

  @@index([competencia])
  @@map("ft_real_orcado")
}
```

Run: `npx prisma validate && npx prisma generate`
Expected: `The schema at prisma/schema.prisma is valid` e `Generated Prisma Client`.

- [ ] **Step 6: Commit**

```bash
git add scripts/_banco.py scripts/aplicar_sql.py prisma/sql/014_projecoes.sql prisma/schema.prisma
git commit -m "feat(projecoes): tabelas ft_real_orcado, dm_conta e ft_carga_real_orcado"
```

---

### Task 2: Carregador do RE x RO (Python) + carga do arquivo real

**Files:**
- Create: `scripts/carga_real_orcado.py`, `scripts/test_carga_real_orcado.py`

**Interfaces:**
- Consumes: `scripts/_banco.py::url_banco()`; tabelas da Task 1.
- Produces: `competencia_de(mes) -> date`, `validar_cabecalho(colunas) -> None`, `linha_para_registro(linha) -> dict`, `ler_export(caminho) -> list[dict]`, `resumo(registros) -> dict`, `carregar(conn, registros, origem) -> int`. CLI: `python scripts/carga_real_orcado.py <arquivo.xlsx> [--apply] [--origem SCRIPT|RPA]`.

- [ ] **Step 1: Escrever os testes (falham)**

`scripts/test_carga_real_orcado.py`:

```python
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `python -m pytest scripts/test_carga_real_orcado.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'carga_real_orcado'`.

- [ ] **Step 3: Implementar o carregador**

`scripts/carga_real_orcado.py`:

```python
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
```

- [ ] **Step 4: Rodar os testes**

Run: `python -m pytest scripts/test_carga_real_orcado.py -q`
Expected: `11 passed`.

- [ ] **Step 5: Simular com o arquivo real**

Run: `python scripts/carga_real_orcado.py "C:/Users/fernando.c.souza/Downloads/RE_X_RO.xlsx"`
Expected:
```
Meses no arquivo: 2026/06, 2026/07
Lançamentos: 56385  Realizado: 3170537.xx  Orçado: 2711807.xx
Simulação: nada gravado. Use --apply para gravar.
```
(Realizado ≈ 1.407.294 + 1.763.243; Orçado ≈ 1.290.110 + 1.421.697.)

- [ ] **Step 6: Gravar (duas vezes — idempotência) e conferir contra o BI**

Run: o mesmo comando com `--apply`, duas vezes. Depois:

```bash
python - <<'EOF'
import sys; sys.path.insert(0, "scripts")
import psycopg2
from _banco import url_banco
conn = psycopg2.connect(url_banco()); cur = conn.cursor()
cur.execute("""select to_char(competencia,'YYYY-MM'), count(*), round(sum(valor_realizado)),
                      round(sum(case when grupo1 like '3%' then valor_realizado else 0 end))
                 from ft_real_orcado group by 1 order by 1""")
for l in cur.fetchall(): print(l)
cur.execute("select status, count(*) from ft_carga_real_orcado group by 1"); print(cur.fetchall())
cur.execute("select count(*) from ft_real_orcado where conta_mae not in (select conta_mae from dm_conta)"); print("não mapeadas:", cur.fetchone()[0])
conn.close()
EOF
```

Expected (a contagem de linhas NÃO dobra na 2ª carga):
```
('2026-06', <n>, Decimal('1407294'), Decimal('13xxxxxx'))
('2026-07', <n>, Decimal('1763243'), Decimal('13308570'))
[('OK', 2)]
não mapeadas: 0
```

- [ ] **Step 7: Commit**

```bash
git add scripts/carga_real_orcado.py scripts/test_carga_real_orcado.py
git commit -m "feat(projecoes): carregador do RE x RO com recarga por mês"
```

---

### Task 3: Dimensões, parâmetros e montagem do SQL

**Files:**
- Create: `src/lib/projecoes/dimensoes.ts`, `src/lib/projecoes/parametros.ts`, `src/lib/projecoes/consulta.ts`
- Test: `src/lib/projecoes/parametros.test.ts`, `src/lib/projecoes/consulta.test.ts`

**Interfaces:**
- Consumes: `predicadoSraCr`, `EscopoDados` de `@/lib/seguranca/escopo-dados`.
- Produces:
  - `dimensoes.ts`: `DIMENSOES`, `type DimensaoKey`, `ehDimensao(v: string): v is DimensaoKey`, `rotuloDimensao(k): string`, `DIMENSOES_FINANCEIRAS: DimensaoKey[]`, `NIVEIS_PADRAO`, `MAX_NIVEIS = 5`.
  - `parametros.ts`: `type Medida`, `MEDIDAS`, `type Periodo = { de: string; ate: string }` (YYYY-MM), `type Filtros`, `type EstadoAnalise = { niveis; medida; periodo: Periodo | null; filtros }`, `lerEstado(sp: URLSearchParams): EstadoAnalise`, `escreverEstado(e: EstadoAnalise): URLSearchParams`, `caminhoDe(niveis, valores: string[]): { dim: DimensaoKey; valor: string }[] | null`, `paraURLSearchParams(obj): URLSearchParams`, `somarMeses(mes, n): string`, `mesesEntre(de, ate): string[]` (decrescente), `periodoPadrao(meses: string[]): Periodo | null`, `rotuloMes(mes): string`.
  - `consulta.ts`: `type Recorte = { periodo: Periodo; filtros: Filtros; caminho: { dim: DimensaoKey; valor: string }[] }`, `montarWhere(r, escopo)`, `montarConsultaNivel(dim, r, escopo)`, `montarConsultaTotais(r, escopo)`, `montarConsultaLancamentos(r, medida, escopo, pagina: { limite: number; offset: number } | null)`, `montarConsultaOpcoes(dim, r, escopo)`, `montarConsultaMeses(escopo)` — todas devolvem `{ sql: string; params: unknown[] }`.

- [ ] **Step 1: Catálogo de dimensões**

`src/lib/projecoes/dimensoes.ts`:

```ts
/**
 * Dimensões da tabela dinâmica do Projeções (chave estável → rótulo).
 * Módulo PURO: usado no client (controles) e no server (montagem do SQL).
 * O mapeamento chave → coluna do banco fica em consulta.ts (só no server).
 */
export const DIMENSOES = [
  { key: "gerente", label: "Gerente" },
  { key: "supervisor", label: "Supervisor" },
  { key: "pec", label: "PEC" },
  { key: "cr", label: "CR" },
  { key: "cliente", label: "Cliente" },
  { key: "regional", label: "Regional" },
  { key: "negocio", label: "Negócio" },
  { key: "situacao", label: "Situação do PEC" },
  { key: "grupo", label: "Grupo de contas" },
  { key: "conta", label: "Conta" },
  { key: "subconta", label: "Subconta" },
] as const

export type DimensaoKey = (typeof DIMENSOES)[number]["key"]

const CHAVES = new Set<string>(DIMENSOES.map((d) => d.key))

export function ehDimensao(valor: string): valor is DimensaoKey {
  return CHAVES.has(valor)
}

export function rotuloDimensao(key: DimensaoKey): string {
  return DIMENSOES.find((d) => d.key === key)?.label ?? key
}

/** Dimensões de conta: sob elas ROL/MC não fazem sentido (não geram linhas de resumo). */
export const DIMENSOES_FINANCEIRAS: DimensaoKey[] = ["grupo", "conta", "subconta"]

/** Abertura padrão = o BI 1.2.05 (contas nas linhas). */
export const NIVEIS_PADRAO: DimensaoKey[] = ["conta"]

export const MAX_NIVEIS = 5
```

- [ ] **Step 2: Testes de parâmetros (falham)**

`src/lib/projecoes/parametros.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  caminhoDe,
  escreverEstado,
  lerEstado,
  mesesEntre,
  periodoPadrao,
  rotuloMes,
  somarMeses,
} from "./parametros"

describe("lerEstado", () => {
  it("usa o padrão (Conta, Realizado, sem período) quando a URL está vazia", () => {
    expect(lerEstado(new URLSearchParams())).toEqual({
      niveis: ["conta"],
      medida: "realizado",
      periodo: null,
      filtros: {},
    })
  })
  it("lê níveis, medida, período e filtros; ignora dimensão inválida e repetida", () => {
    const sp = new URLSearchParams(
      "n=gerente&n=xpto&n=cr&n=gerente&med=diferenca&de=2026-01&ate=2026-07&f_cr=25415%20-%20X&f_regional=SP&f_inexistente=1",
    )
    expect(lerEstado(sp)).toEqual({
      niveis: ["gerente", "cr"],
      medida: "diferenca",
      periodo: { de: "2026-01", ate: "2026-07" },
      filtros: { cr: ["25415 - X"], regional: ["SP"] },
    })
  })
  it("inverte o período quando de > até e descarta mês malformado", () => {
    expect(lerEstado(new URLSearchParams("de=2026-07&ate=2026-01")).periodo).toEqual({
      de: "2026-01",
      ate: "2026-07",
    })
    expect(lerEstado(new URLSearchParams("de=2026-13&ate=2026-01")).periodo).toBeNull()
  })
  it("limita a 5 níveis", () => {
    const sp = new URLSearchParams("n=gerente&n=supervisor&n=pec&n=cr&n=cliente&n=conta")
    expect(lerEstado(sp).niveis).toHaveLength(5)
  })
})

describe("escreverEstado", () => {
  it("faz ida e volta com lerEstado", () => {
    const e = lerEstado(new URLSearchParams("n=cr&n=conta&med=orcado&de=2026-01&ate=2026-06&f_negocio=LOGISTICA"))
    expect(lerEstado(escreverEstado(e))).toEqual(e)
  })
})

describe("caminhoDe", () => {
  it("associa cada valor ao nível correspondente", () => {
    expect(caminhoDe(["gerente", "cr"], ["ANA", ""])).toEqual([
      { dim: "gerente", valor: "ANA" },
      { dim: "cr", valor: "" },
    ])
  })
  it("recusa caminho maior que os níveis", () => {
    expect(caminhoDe(["conta"], ["31101", "x"])).toBeNull()
  })
})

describe("meses", () => {
  it("soma meses atravessando o ano", () => {
    expect(somarMeses("2026-01", -1)).toBe("2025-12")
    expect(somarMeses("2025-12", 2)).toBe("2026-02")
  })
  it("lista os meses do período do mais recente para o mais antigo", () => {
    expect(mesesEntre("2025-11", "2026-02")).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"])
  })
  it("período padrão = últimos 12 meses até o mais recente com dado", () => {
    expect(periodoPadrao(["2026-06", "2026-07"])).toEqual({ de: "2026-06", ate: "2026-07" })
    expect(periodoPadrao(["2024-01", "2026-07"])).toEqual({ de: "2025-08", ate: "2026-07" })
    expect(periodoPadrao([])).toBeNull()
  })
  it("rótulo no formato do BI", () => {
    expect(rotuloMes("2026-07")).toBe("JUL 2026")
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/projecoes/parametros.test.ts`
Expected: FAIL — `Failed to resolve import "./parametros"`.

- [ ] **Step 4: Implementar `parametros.ts`**

`src/lib/projecoes/parametros.ts`:

```ts
import { DIMENSOES, MAX_NIVEIS, NIVEIS_PADRAO, ehDimensao, type DimensaoKey } from "./dimensoes"

/**
 * Estado da análise (níveis, valor exibido, período e filtros) ⇄ URL.
 * Módulo PURO, compartilhado entre a página (server) e os controles (client).
 * Meses são sempre "AAAA-MM".
 */

export type Medida = "realizado" | "orcado" | "diferenca" | "diferenca_pct"

export const MEDIDAS: { key: Medida; label: string }[] = [
  { key: "realizado", label: "Realizado" },
  { key: "orcado", label: "Orçado" },
  { key: "diferenca", label: "Diferença (R$)" },
  { key: "diferenca_pct", label: "Diferença (%)" },
]

export type Periodo = { de: string; ate: string }
export type Filtros = Partial<Record<DimensaoKey, string[]>>
export type EstadoAnalise = {
  niveis: DimensaoKey[]
  medida: Medida
  periodo: Periodo | null
  filtros: Filtros
}

const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/
const NOMES_MES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]

function unicos<T>(lista: T[]): T[] {
  return Array.from(new Set(lista))
}

export function lerEstado(sp: URLSearchParams): EstadoAnalise {
  const niveis = unicos(sp.getAll("n").filter(ehDimensao)).slice(0, MAX_NIVEIS)
  const med = sp.get("med")
  const medida = MEDIDAS.some((m) => m.key === med) ? (med as Medida) : "realizado"

  const de = sp.get("de")
  const ate = sp.get("ate")
  let periodo: Periodo | null = null
  if (de && ate && RE_MES.test(de) && RE_MES.test(ate)) {
    periodo = de <= ate ? { de, ate } : { de: ate, ate: de }
  }

  const filtros: Filtros = {}
  for (const d of DIMENSOES) {
    const valores = unicos(sp.getAll(`f_${d.key}`).filter((v) => v !== ""))
    if (valores.length) filtros[d.key] = valores
  }

  return { niveis: niveis.length ? niveis : [...NIVEIS_PADRAO], medida, periodo, filtros }
}

export function escreverEstado(e: EstadoAnalise): URLSearchParams {
  const sp = new URLSearchParams()
  for (const n of e.niveis) sp.append("n", n)
  sp.set("med", e.medida)
  if (e.periodo) {
    sp.set("de", e.periodo.de)
    sp.set("ate", e.periodo.ate)
  }
  for (const d of DIMENSOES) {
    for (const v of e.filtros[d.key] ?? []) sp.append(`f_${d.key}`, v)
  }
  return sp
}

/** Converte o caminho de uma linha (valores dos níveis-pai) em pares nível/valor. */
export function caminhoDe(
  niveis: DimensaoKey[],
  valores: string[],
): { dim: DimensaoKey; valor: string }[] | null {
  if (valores.length > niveis.length) return null
  return valores.map((valor, i) => ({ dim: niveis[i], valor }))
}

/** searchParams do Next (Record) → URLSearchParams. */
export function paraURLSearchParams(
  obj: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const sp = new URLSearchParams()
  for (const [chave, valor] of Object.entries(obj)) {
    if (Array.isArray(valor)) valor.forEach((v) => sp.append(chave, v))
    else if (valor !== undefined) sp.append(chave, valor)
  }
  return sp
}

export function somarMeses(mes: string, n: number): string {
  const [ano, m] = mes.split("-").map(Number)
  const total = ano * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`
}

/** Todos os meses de `de` a `ate`, do mais recente para o mais antigo (como o BI). */
export function mesesEntre(de: string, ate: string): string[] {
  const meses: string[] = []
  for (let m = ate; m >= de; m = somarMeses(m, -1)) meses.push(m)
  return meses
}

/** Últimos 12 meses até o mais recente com dado (limitado ao mais antigo com dado). */
export function periodoPadrao(mesesComDado: string[]): Periodo | null {
  if (!mesesComDado.length) return null
  const ordenados = [...mesesComDado].sort()
  const ate = ordenados[ordenados.length - 1]
  const inicio = somarMeses(ate, -11)
  const de = ordenados[0] > inicio ? ordenados[0] : inicio
  return { de, ate }
}

export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-")
  return `${NOMES_MES[Number(m) - 1]} ${ano}`
}
```

- [ ] **Step 5: Rodar os testes de parâmetros**

Run: `npx vitest run src/lib/projecoes/parametros.test.ts`
Expected: PASS (todos).

- [ ] **Step 6: Testes da montagem de SQL (falham)**

`src/lib/projecoes/consulta.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import {
  montarConsultaLancamentos,
  montarConsultaMeses,
  montarConsultaNivel,
  montarConsultaOpcoes,
  montarConsultaTotais,
  montarWhere,
  type Recorte,
} from "./consulta"

const TODOS = { tipo: "todos" } as const
const LISTA = { tipo: "lista", crs: ["25415", "68732"] } as const
const VAZIO = { tipo: "lista", crs: [] } as const

const base: Recorte = { periodo: { de: "2026-01", ate: "2026-07" }, filtros: {}, caminho: [] }

describe("montarWhere", () => {
  it("filtra o período pelo 1º dia de cada mês", () => {
    const w = montarWhere(base, TODOS)
    expect(w.sql).toBe("where f.competencia between $1::date and $2::date")
    expect(w.params).toEqual(["2026-01-01", "2026-07-01"])
  })
  it("aplica caminho, filtros e a Trava 1 com placeholders em sequência", () => {
    const w = montarWhere(
      {
        ...base,
        caminho: [{ dim: "gerente", valor: "ANA" }],
        filtros: { regional: ["SP", "MG"] },
      },
      LISTA,
    )
    expect(w.sql).toContain("coalesce(f.gerente, '') = $3")
    expect(w.sql).toContain("coalesce(f.regional, '') = any($4::text[])")
    expect(w.sql).toContain("= any($5::text[])")
    expect(w.params).toEqual(["2026-01-01", "2026-07-01", "ANA", ["SP", "MG"], ["25415", "68732"]])
  })
  it("escopo vazio não devolve nada (fail-closed)", () => {
    expect(montarWhere(base, VAZIO).sql).toContain("and 1=0")
  })
  it("escopo todos não injeta filtro de CR", () => {
    expect(montarWhere(base, TODOS).sql).not.toContain("any(")
  })
})

describe("montarConsultaNivel", () => {
  it("agrupa por chave e mês, soma realizado/orçado/ROL", () => {
    const q = montarConsultaNivel("conta", base, TODOS)
    expect(q.sql).toContain("coalesce(f.conta_mae, '') as chave")
    expect(q.sql).toContain("CONTA NÃO MAPEADA")
    expect(q.sql).toContain("f.grupo1 like '3%'")
    expect(q.sql).toContain("left join public.dm_conta c")
    expect(q.sql).toMatch(/group by 1, 4$/)
    expect(q.sql).not.toContain("as cr")
  })
  it("no nível CR traz o CR para a Trava 2", () => {
    expect(montarConsultaNivel("cr", base, LISTA).sql).toContain("min(f.cr) as cr")
  })
})

describe("demais consultas", () => {
  it("totais agrupam só por mês", () => {
    expect(montarConsultaTotais(base, TODOS).sql).toMatch(/group by 1$/)
  })
  it("lançamentos filtram pela medida e paginam por parâmetro", () => {
    const q = montarConsultaLancamentos(base, "orcado", LISTA, { limite: 50, offset: 100 })
    expect(q.sql).toContain("and f.valor_orcado <> 0")
    expect(q.sql).toContain("f.cr")
    expect(q.sql).toMatch(/limit \$\d+ offset \$\d+$/)
    expect(q.params.slice(-2)).toEqual([50, 100])
  })
  it("lançamentos de diferença trazem realizado OU orçado", () => {
    expect(montarConsultaLancamentos(base, "diferenca", TODOS, null).sql).toContain(
      "and (f.valor_realizado <> 0 or f.valor_orcado <> 0)",
    )
  })
  it("opções e meses respeitam a Trava 1", () => {
    expect(montarConsultaOpcoes("cr", base, LISTA).sql).toContain("any($3::text[])")
    const m = montarConsultaMeses(LISTA)
    expect(m.sql).toContain("any($1::text[])")
    expect(m.params).toEqual([["25415", "68732"]])
  })
})
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/lib/projecoes/consulta.test.ts`
Expected: FAIL — `Failed to resolve import "./consulta"`.

- [ ] **Step 8: Implementar `consulta.ts`**

`src/lib/projecoes/consulta.ts`:

```ts
import { predicadoSraCr, type EscopoDados } from "@/lib/seguranca/escopo-dados"

import type { DimensaoKey } from "./dimensoes"
import type { Filtros, Medida, Periodo } from "./parametros"

/**
 * Montagem do SQL do Projeções. Módulo PURO (só gera texto + parâmetros).
 *
 * TRAVA 1 (isolamento por CR): TODA consulta passa por `montarWhere`, que injeta
 * `predicadoSraCr(escopo, "f.cr", n)`. A Trava 2 fica em dados.ts, sobre a saída.
 *
 * Valores nulos de uma dimensão viram '' (coalesce), para poderem ser filtrados
 * por igualdade ao expandir uma linha "(sem valor)".
 */

const SQL_DIM: Record<DimensaoKey, { valor: string; rotulo: string; ordem: string }> = {
  gerente: { valor: "f.gerente", rotulo: "f.gerente", ordem: "0" },
  supervisor: { valor: "f.supervisor", rotulo: "f.supervisor", ordem: "0" },
  pec: { valor: "f.pec", rotulo: "f.pec", ordem: "0" },
  cr: { valor: "f.cr", rotulo: "f.cr", ordem: "0" },
  cliente: { valor: "f.cliente", rotulo: "f.cliente", ordem: "0" },
  regional: { valor: "f.regional", rotulo: "f.regional", ordem: "0" },
  negocio: { valor: "f.negocio", rotulo: "f.negocio", ordem: "0" },
  situacao: { valor: "f.pec_situacao", rotulo: "f.pec_situacao", ordem: "0" },
  grupo: { valor: "f.grupo2", rotulo: "f.grupo2", ordem: "0" },
  conta: {
    valor: "f.conta_mae",
    rotulo: "f.conta_mae || ' - ' || coalesce(c.nome, 'CONTA NÃO MAPEADA')",
    ordem: "coalesce(c.ordem, 9999)",
  },
  subconta: { valor: "f.conta", rotulo: "f.conta || ' - ' || coalesce(f.desc_conta, '')", ordem: "0" },
}

const FROM =
  "from public.ft_real_orcado f left join public.dm_conta c on c.conta_mae = f.conta_mae"

const SOMAS =
  "sum(f.valor_realizado)::float8 as realizado, " +
  "sum(f.valor_orcado)::float8 as orcado, " +
  "sum(case when f.grupo1 like '3%' then f.valor_realizado else 0 end)::float8 as rol_realizado, " +
  "sum(case when f.grupo1 like '3%' then f.valor_orcado else 0 end)::float8 as rol_orcado"

const MES = "to_char(f.competencia, 'YYYY-MM')"

export type Recorte = {
  periodo: Periodo
  filtros: Filtros
  caminho: { dim: DimensaoKey; valor: string }[]
}

type Consulta = { sql: string; params: unknown[] }

export function montarWhere(r: Recorte, escopo: EscopoDados): Consulta {
  const params: unknown[] = [`${r.periodo.de}-01`, `${r.periodo.ate}-01`]
  let sql = "where f.competencia between $1::date and $2::date"

  for (const { dim, valor } of r.caminho) {
    params.push(valor)
    sql += ` and coalesce(${SQL_DIM[dim].valor}, '') = $${params.length}`
  }
  for (const [dim, valores] of Object.entries(r.filtros) as [DimensaoKey, string[] | undefined][]) {
    if (!valores?.length || !(dim in SQL_DIM)) continue
    params.push(valores)
    sql += ` and coalesce(${SQL_DIM[dim].valor}, '') = any($${params.length}::text[])`
  }

  const trava = predicadoSraCr(escopo, "f.cr", params.length + 1)
  return { sql: sql + trava.sql, params: [...params, ...trava.params] }
}

export function montarConsultaNivel(dim: DimensaoKey, r: Recorte, escopo: EscopoDados): Consulta {
  const d = SQL_DIM[dim]
  const w = montarWhere(r, escopo)
  const cr = dim === "cr" ? ", min(f.cr) as cr" : ""
  return {
    sql:
      `select coalesce(${d.valor}, '') as chave, coalesce(min(${d.rotulo}), '') as rotulo, ` +
      `min(${d.ordem})::int as ordem, ${MES} as mes, ${SOMAS}${cr} ${FROM} ${w.sql} group by 1, 4`,
    params: w.params,
  }
}

export function montarConsultaTotais(r: Recorte, escopo: EscopoDados): Consulta {
  const w = montarWhere(r, escopo)
  return { sql: `select ${MES} as mes, ${SOMAS} ${FROM} ${w.sql} group by 1`, params: w.params }
}

const FILTRO_MEDIDA: Record<Medida, string> = {
  realizado: " and f.valor_realizado <> 0",
  orcado: " and f.valor_orcado <> 0",
  diferenca: " and (f.valor_realizado <> 0 or f.valor_orcado <> 0)",
  diferenca_pct: " and (f.valor_realizado <> 0 or f.valor_orcado <> 0)",
}

export function montarConsultaLancamentos(
  r: Recorte,
  medida: Medida,
  escopo: EscopoDados,
  pagina: { limite: number; offset: number } | null,
): Consulta {
  const w = montarWhere(r, escopo)
  const params = [...w.params]
  let sql =
    `select ${MES} as mes, f.conta, f.desc_conta, f.cr, f.pec, f.historico, f.lote, f.origem, ` +
    `f.valor_realizado::float8 as realizado, f.valor_orcado::float8 as orcado, count(*) over()::int as total ` +
    `${FROM} ${w.sql}${FILTRO_MEDIDA[medida]} order by f.competencia desc, f.conta, f.id`
  if (pagina) {
    params.push(pagina.limite, pagina.offset)
    sql += ` limit $${params.length - 1} offset $${params.length}`
  }
  return { sql, params }
}

export function montarConsultaOpcoes(dim: DimensaoKey, r: Recorte, escopo: EscopoDados): Consulta {
  const d = SQL_DIM[dim]
  const w = montarWhere(r, escopo)
  return {
    sql:
      `select coalesce(${d.valor}, '') as valor, coalesce(min(${d.rotulo}), '') as rotulo ` +
      `${FROM} ${w.sql} group by 1 having coalesce(${d.valor}, '') <> '' ` +
      `order by min(${d.ordem}), 2 limit 2000`,
    params: w.params,
  }
}

export function montarConsultaMeses(escopo: EscopoDados): Consulta {
  const trava = predicadoSraCr(escopo, "f.cr", 1)
  return {
    sql: `select distinct ${MES} as mes from public.ft_real_orcado f where true${trava.sql} order by 1`,
    params: trava.params,
  }
}
```

- [ ] **Step 9: Rodar os testes**

Run: `npx vitest run src/lib/projecoes`
Expected: PASS (parametros + consulta).

- [ ] **Step 10: Commit**

```bash
git add src/lib/projecoes/dimensoes.ts src/lib/projecoes/parametros.ts src/lib/projecoes/parametros.test.ts src/lib/projecoes/consulta.ts src/lib/projecoes/consulta.test.ts
git commit -m "feat(projecoes): dimensões, estado na URL e montagem do SQL com Trava 1"
```

---

### Task 4: Cálculos (medidas, ROL/MC/% Margem) e CSV

**Files:**
- Create: `src/lib/projecoes/calculos.ts`, `src/lib/projecoes/csv.ts`
- Test: `src/lib/projecoes/calculos.test.ts`, `src/lib/projecoes/csv.test.ts`

**Interfaces:**
- Consumes: `Medida` (parametros.ts); `formatarNumero`, `formatarPercentual`, `formatarVariacao` (`@/lib/format`).
- Produces:
  - `calculos.ts`: `type Par = { realizado: number; orcado: number; rolRealizado: number; rolOrcado: number }`, `type LinhaAgregada`, `type No = { chave: string; rotulo: string; ordem: number; meses: Record<string, Par>; total: Par }`, `agruparLinhas(linhas: LinhaAgregada[]): No[]`, `totalizar(linhas): No`, `valorMedida(m, par | undefined): number | null`, `margemPct(mc, rol): number | null`, `resumo(par | undefined, m): { rol: number | null; mc: number | null; margem: number | null }`, `tom(m, v): "bom" | "ruim" | "neutro"`, `formatarCelula(m, v): string`, `formatarMargem(m, v): string`.
  - `csv.ts`: `type Lancamento = { mes; conta; desc_conta; cr; pec; historico; lote; origem; realizado; orcado }`, `lancamentosParaCsv(linhas: Lancamento[]): string`.

- [ ] **Step 1: Testes (falham)**

`src/lib/projecoes/calculos.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  agruparLinhas,
  formatarCelula,
  formatarMargem,
  margemPct,
  resumo,
  tom,
  totalizar,
  valorMedida,
  type LinhaAgregada,
} from "./calculos"

const l = (p: Partial<LinhaAgregada>): LinhaAgregada => ({
  chave: "x",
  rotulo: "X",
  ordem: 0,
  mes: "2026-07",
  realizado: 0,
  orcado: 0,
  rol_realizado: 0,
  rol_orcado: 0,
  ...p,
})

describe("agruparLinhas", () => {
  it("junta os meses de cada chave, soma o total e ordena por ordem e rótulo", () => {
    const nos = agruparLinhas([
      l({ chave: "41101", rotulo: "41101 - PESSOAL", ordem: 3, mes: "2026-06", realizado: -3835182 }),
      l({ chave: "31101", rotulo: "31101 - RECEITAS", ordem: 1, mes: "2026-07", realizado: 14955162, rol_realizado: 14955162 }),
      l({ chave: "41101", rotulo: "41101 - PESSOAL", ordem: 3, mes: "2026-07", realizado: -3934842 }),
    ])
    expect(nos.map((n) => n.chave)).toEqual(["31101", "41101"])
    expect(nos[1].meses["2026-06"].realizado).toBe(-3835182)
    expect(nos[1].total.realizado).toBe(-7770024)
  })
  it("converte números que chegam como texto", () => {
    const [no] = agruparLinhas([l({ realizado: "10.5" as unknown as number })])
    expect(no.total.realizado).toBe(10.5)
  })
})

describe("totalizar", () => {
  it("devolve um nó TOTAL mesmo sem linhas", () => {
    expect(totalizar([]).total.realizado).toBe(0)
  })
})

describe("medidas", () => {
  const par = { realizado: -90, orcado: -100, rolRealizado: 0, rolOrcado: 0 }
  it("realizado, orçado e diferença", () => {
    expect(valorMedida("realizado", par)).toBe(-90)
    expect(valorMedida("orcado", par)).toBe(-100)
    expect(valorMedida("diferenca", par)).toBe(10)
  })
  it("diferença % sobre o módulo do orçado (custo menor = positivo)", () => {
    expect(valorMedida("diferenca_pct", par)).toBeCloseTo(10)
    expect(valorMedida("diferenca_pct", { ...par, realizado: 110, orcado: 100 })).toBeCloseTo(10)
  })
  it("sem orçado a diferença % é vazia; mês sem dado é vazio", () => {
    expect(valorMedida("diferenca_pct", { ...par, orcado: 0 })).toBeNull()
    expect(valorMedida("realizado", undefined)).toBeNull()
  })
})

describe("ROL, MC e % Margem", () => {
  it("margem = MC ÷ ROL e nunca divide por zero", () => {
    expect(margemPct(1763243, 13308570)).toBeCloseTo(13.25, 1)
    expect(margemPct(10, 0)).toBeNull()
  })
  it("resumo do realizado (exemplo jul/2026)", () => {
    const r = resumo({ realizado: 1763243, orcado: 1421697, rolRealizado: 13308570, rolOrcado: 12000000 }, "realizado")
    expect(r.rol).toBe(13308570)
    expect(r.mc).toBe(1763243)
    expect(r.margem).toBeCloseTo(13.25, 1)
  })
  it("na diferença a margem vira diferença de pontos percentuais", () => {
    const r = resumo({ realizado: 20, orcado: 10, rolRealizado: 100, rolOrcado: 100 }, "diferenca")
    expect(r.margem).toBeCloseTo(10)
  })
})

describe("tom e formatação", () => {
  it("só diferenças ganham cor", () => {
    expect(tom("diferenca", 5)).toBe("bom")
    expect(tom("diferenca_pct", -1)).toBe("ruim")
    expect(tom("realizado", -1)).toBe("neutro")
    expect(tom("diferenca", null)).toBe("neutro")
  })
  it("formata como o BI (sem casas) e percentuais com 1 casa", () => {
    expect(formatarCelula("realizado", 1763243.4)).toBe("1.763.243")
    expect(formatarCelula("diferenca_pct", 6.34)).toBe("+6,3%")
    expect(formatarCelula("realizado", null)).toBe("")
    expect(formatarMargem("realizado", 13.25)).toBe("13,3%")
    expect(formatarMargem("diferenca", -1.2)).toBe("−1,2 p.p.")
    expect(formatarMargem("realizado", null)).toBe("—")
  })
})
```

`src/lib/projecoes/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { lancamentosParaCsv } from "./csv"

describe("lancamentosParaCsv", () => {
  it("gera CSV com BOM, ponto e vírgula, vírgula decimal e aspas quando preciso", () => {
    const csv = lancamentosParaCsv([
      {
        mes: "2026-07",
        conta: "41601021",
        desc_conta: "JUROS; ATRASO",
        cr: "25415 - SP",
        pec: null,
        historico: 'NF "123"',
        lote: null,
        origem: "SC",
        realizado: -25.7,
        orcado: 0,
      },
    ])
    expect(csv.startsWith("\uFEFFMês;Conta;Descrição;CR;PEC;Histórico;Lote;Origem;Realizado;Orçado\r\n")).toBe(true)
    expect(csv).toContain('2026-07;41601021;"JUROS; ATRASO";25415 - SP;;"NF ""123""";;SC;-25,70;0,00')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/projecoes/calculos.test.ts src/lib/projecoes/csv.test.ts`
Expected: FAIL — imports não resolvidos.

- [ ] **Step 3: Implementar `calculos.ts` e `csv.ts`**

`src/lib/projecoes/calculos.ts`:

```ts
import { formatarNumero, formatarPercentual, formatarVariacao } from "@/lib/format"

import type { Medida } from "./parametros"

/**
 * REGRAS DE NEGÓCIO do Projeções (em sincronia com o botão info — ProjecoesInfo):
 *  - Valor de uma célula = soma dos lançamentos daquela linha × mês. Receita é
 *    positiva e custo negativo (como no BI).
 *  - ROL = soma do grupo de Receita (receita bruta + deduções/impostos sobre faturamento).
 *  - MC = soma de TODOS os lançamentos (o resultado; linha TOTAL do BI).
 *  - % Margem = MC ÷ ROL. ROL = 0 ⇒ "—".
 *  - Diferença = Realizado − Orçado. Diferença % = Diferença ÷ |Orçado|. Com o sinal
 *    contábil, positivo é sempre favorável. Orçado = 0 ⇒ "—".
 *  - Mês sem lançamento ⇒ célula vazia (nunca zero inventado).
 * Módulo PURO.
 */

export type Par = { realizado: number; orcado: number; rolRealizado: number; rolOrcado: number }

export type LinhaAgregada = {
  chave: string
  rotulo: string
  ordem: number
  mes: string
  realizado: number
  orcado: number
  rol_realizado: number
  rol_orcado: number
}

export type No = {
  chave: string
  rotulo: string
  ordem: number
  meses: Record<string, Par>
  total: Par
}

const vazio = (): Par => ({ realizado: 0, orcado: 0, rolRealizado: 0, rolOrcado: 0 })

function acumular(par: Par, l: LinhaAgregada): void {
  par.realizado += Number(l.realizado)
  par.orcado += Number(l.orcado)
  par.rolRealizado += Number(l.rol_realizado)
  par.rolOrcado += Number(l.rol_orcado)
}

export function agruparLinhas(linhas: LinhaAgregada[]): No[] {
  const porChave = new Map<string, No>()
  for (const l of linhas) {
    let no = porChave.get(l.chave)
    if (!no) {
      no = { chave: l.chave, rotulo: l.rotulo, ordem: Number(l.ordem), meses: {}, total: vazio() }
      porChave.set(l.chave, no)
    }
    no.meses[l.mes] ??= vazio()
    acumular(no.meses[l.mes], l)
    acumular(no.total, l)
  }
  return Array.from(porChave.values()).sort(
    (a, b) => a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo, "pt-BR"),
  )
}

/** Linhas agregadas só por mês (sem chave) → nó TOTAL. */
export function totalizar(
  linhas: Omit<LinhaAgregada, "chave" | "rotulo" | "ordem">[],
): No {
  const [no] = agruparLinhas(linhas.map((l) => ({ ...l, chave: "", rotulo: "TOTAL", ordem: 0 })))
  return no ?? { chave: "", rotulo: "TOTAL", ordem: 0, meses: {}, total: vazio() }
}

export function valorMedida(
  m: Medida,
  par: { realizado: number; orcado: number } | undefined,
): number | null {
  if (!par) return null
  switch (m) {
    case "realizado":
      return par.realizado
    case "orcado":
      return par.orcado
    case "diferenca":
      return par.realizado - par.orcado
    case "diferenca_pct":
      return par.orcado === 0 ? null : ((par.realizado - par.orcado) / Math.abs(par.orcado)) * 100
  }
}

export function margemPct(mc: number, rol: number): number | null {
  return rol === 0 ? null : (mc / rol) * 100
}

export function resumo(
  par: Par | undefined,
  m: Medida,
): { rol: number | null; mc: number | null; margem: number | null } {
  if (!par) return { rol: null, mc: null, margem: null }
  const rol = valorMedida(m, { realizado: par.rolRealizado, orcado: par.rolOrcado })
  const mc = valorMedida(m, par)
  const mReal = margemPct(par.realizado, par.rolRealizado)
  const mOrc = margemPct(par.orcado, par.rolOrcado)
  let margem: number | null = null
  if (m === "realizado") margem = mReal
  else if (m === "orcado") margem = mOrc
  else if (m === "diferenca" && mReal !== null && mOrc !== null) margem = mReal - mOrc
  return { rol, mc, margem }
}

export function tom(m: Medida, v: number | null): "bom" | "ruim" | "neutro" {
  if (v === null || (m !== "diferenca" && m !== "diferenca_pct")) return "neutro"
  if (v > 0) return "bom"
  if (v < 0) return "ruim"
  return "neutro"
}

export function formatarCelula(m: Medida, v: number | null): string {
  if (v === null) return ""
  return m === "diferenca_pct" ? formatarVariacao(v, 1) : formatarNumero(v, 0)
}

export function formatarMargem(m: Medida, v: number | null): string {
  if (v === null) return "—"
  return m === "diferenca" ? formatarVariacao(v, 1).replace("%", " p.p.") : formatarPercentual(v, 1)
}
```

`src/lib/projecoes/csv.ts`:

```ts
/**
 * Exportação dos lançamentos (detalhe de um número) em CSV que abre direto no Excel:
 * BOM UTF-8, separador ";", vírgula decimal. Módulo PURO.
 */

export type Lancamento = {
  mes: string
  conta: string
  desc_conta: string | null
  cr: string | null
  pec: string | null
  historico: string | null
  lote: string | null
  origem: string | null
  realizado: number
  orcado: number
}

const CABECALHO = ["Mês", "Conta", "Descrição", "CR", "PEC", "Histórico", "Lote", "Origem", "Realizado", "Orçado"]

function texto(v: string | null): string {
  const s = v ?? ""
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function numero(n: number): string {
  return Number(n).toFixed(2).replace(".", ",")
}

export function lancamentosParaCsv(linhas: Lancamento[]): string {
  const corpo = linhas.map((l) =>
    [
      texto(l.mes),
      texto(l.conta),
      texto(l.desc_conta),
      texto(l.cr),
      texto(l.pec),
      texto(l.historico),
      texto(l.lote),
      texto(l.origem),
      numero(l.realizado),
      numero(l.orcado),
    ].join(";"),
  )
  return "\uFEFF" + [CABECALHO.join(";"), ...corpo].join("\r\n")
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run src/lib/projecoes`
Expected: PASS (todos os arquivos de `src/lib/projecoes`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/projecoes/calculos.ts src/lib/projecoes/calculos.test.ts src/lib/projecoes/csv.ts src/lib/projecoes/csv.test.ts
git commit -m "feat(projecoes): medidas, ROL/MC/% margem e exportação CSV"
```

---

### Task 5: Acesso, camada de dados e rotas de API

**Files:**
- Create: `src/lib/projecoes/acesso.ts`, `src/lib/projecoes/dados.ts`, `src/app/api/projecoes/nivel/route.ts`, `src/app/api/projecoes/lancamentos/route.ts`, `src/app/api/projecoes/opcoes/route.ts`
- Modify: `src/lib/domains.ts` (tela `projecoes-analise` no domínio Financeiro — necessária para o guarda)

**Interfaces:**
- Consumes: tudo das Tasks 3–4; `inhausPool`; `assertLinhasNoEscopo`, `resolverEscopoDados`; `getCurrentSession`, `getSessionReadOnly`; `acessoLivreLiberado`.
- Produces:
  - `acesso.ts`: `TELA_PROJECOES = "projecoes-analise"`, `escopoDaPagina(): Promise<EscopoDados>`, `guardaProjecoes(): Promise<{ ok: true; escopo: EscopoDados } | { ok: false; response: NextResponse }>`.
  - `dados.ts`: `getNivel(dim, r, escopo): Promise<No[]>`, `getTotais(r, escopo): Promise<No>`, `getMesesDisponiveis(escopo): Promise<string[]>`, `type SituacaoCarga = { atualizadoEm: string | null; erro: { em: string; mensagem: string | null } | null }`, `getSituacaoCarga(): Promise<SituacaoCarga>`, `getLancamentos(r, medida, escopo, pagina: number): Promise<{ linhas: Lancamento[]; total: number; tamanhoPagina: number }>`, `getLancamentosCsv(r, medida, escopo): Promise<string>`, `getOpcoes(dim, r, escopo): Promise<{ value: string; label: string }[]>`.
  - APIs (todas `GET`, resposta de erro `{ error }`):
    - `/api/projecoes/nivel?<estado>&c=<valor>…` → `{ nos: No[] }` (nível = `niveis[c.length]`).
    - `/api/projecoes/lancamentos?<estado>&c=…&mes=AAAA-MM&pagina=N[&formato=csv]` → `{ linhas, total, tamanhoPagina }` ou CSV.
    - `/api/projecoes/opcoes?<estado>&dim=<dimensao>` → `{ opcoes: { value, label }[] }`.

- [ ] **Step 1: Registrar a tela em `domains.ts`**

Em `src/lib/domains.ts`, dentro de `telas` do domínio `financeiro`, logo após o item `financeiro-visao-geral`, inserir:

```ts
      {
        key: "projecoes-analise",
        label: "Projeções",
        href: "/dashboards/financeiro/projecoes",
        palavrasChave: ["realizado", "orcado", "orçado", "dre", "resultado", "margem", "rol", "mc", "re x ro"],
        icone: BarChart3,
      },
```

(`BarChart3` já é importado no topo do arquivo.)

Run: `npx vitest run src/lib/domains.test.ts`
Expected: PASS.

- [ ] **Step 2: `acesso.ts`**

```ts
import { NextResponse } from "next/server"

import { getCurrentSession, getSessionReadOnly } from "@/lib/auth-session"
import { acessoLivreLiberado } from "@/lib/dev-auth"
import { resolverEscopoDados, type EscopoDados } from "@/lib/seguranca/escopo-dados"

/**
 * Acesso ao Projeções. Duas perguntas separadas:
 *  - QUAL TELA (Eixo 1): a tela `projecoes-analise` precisa estar concedida (admin passa).
 *  - QUAIS DADOS (Eixo 2): o escopo de CRs do usuário (gestão = todos; gerente = os seus).
 * Honra o acesso livre de dev (Visitante admin interno vê tudo).
 */
export const TELA_PROJECOES = "projecoes-analise"

/** Escopo de dados para a PÁGINA (a tela já foi validada por assertTelaVisivel). */
export async function escopoDaPagina(): Promise<EscopoDados> {
  if (acessoLivreLiberado()) return { tipo: "todos" }
  const r = await getSessionReadOnly()
  if (r.status !== "ok") return { tipo: "lista", crs: [] }
  return resolverEscopoDados({
    authUserId: r.sessao.user.id,
    isAdmin: r.sessao.authorization.isAdmin,
    classificacao: r.sessao.authorization.classificacao,
  })
}

/** Guarda das rotas de API: exige a tela concedida e devolve o escopo de dados. */
export async function guardaProjecoes(): Promise<
  { ok: true; escopo: EscopoDados } | { ok: false; response: NextResponse }
> {
  if (acessoLivreLiberado()) return { ok: true, escopo: { tipo: "todos" } }
  const sessao = await getCurrentSession()
  if (!sessao) {
    return { ok: false, response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  }
  const { isAdmin, visibleScreens, classificacao } = sessao.authorization
  if (!isAdmin && !visibleScreens.includes(TELA_PROJECOES)) {
    return { ok: false, response: NextResponse.json({ error: "Acesso restrito" }, { status: 403 }) }
  }
  const escopo = await resolverEscopoDados({ authUserId: sessao.user.id, isAdmin, classificacao })
  return { ok: true, escopo }
}
```

- [ ] **Step 3: `dados.ts`**

```ts
import { inhausPool } from "@/lib/db-inhaus"
import { assertLinhasNoEscopo, type EscopoDados } from "@/lib/seguranca/escopo-dados"

import { agruparLinhas, totalizar, type LinhaAgregada, type No } from "./calculos"
import {
  montarConsultaLancamentos,
  montarConsultaMeses,
  montarConsultaNivel,
  montarConsultaOpcoes,
  montarConsultaTotais,
  type Recorte,
} from "./consulta"
import { lancamentosParaCsv, type Lancamento } from "./csv"
import type { DimensaoKey } from "./dimensoes"
import type { Medida } from "./parametros"

/**
 * Leitura do Projeções no db_inhaus (ft_real_orcado + dm_conta). Server-only.
 * TRAVA 1 vem do SQL (consulta.ts). TRAVA 2 aqui: sempre que o CR vem na saída
 * (nível CR e lançamentos), confere que nenhuma linha escapou do escopo.
 */

const TAMANHO_PAGINA = 50
const LIMITE_CSV = 100_000

export async function getNivel(dim: DimensaoKey, r: Recorte, escopo: EscopoDados): Promise<No[]> {
  const { sql, params } = montarConsultaNivel(dim, r, escopo)
  const { rows } = await inhausPool.query<LinhaAgregada & { cr?: string | null }>(sql, params)
  if (dim === "cr") assertLinhasNoEscopo(rows, (l) => l.cr, escopo)
  return agruparLinhas(rows)
}

export async function getTotais(r: Recorte, escopo: EscopoDados): Promise<No> {
  const { sql, params } = montarConsultaTotais(r, escopo)
  const { rows } = await inhausPool.query(sql, params)
  return totalizar(rows)
}

export async function getMesesDisponiveis(escopo: EscopoDados): Promise<string[]> {
  const { sql, params } = montarConsultaMeses(escopo)
  const { rows } = await inhausPool.query<{ mes: string }>(sql, params)
  return rows.map((l) => l.mes)
}

export type SituacaoCarga = {
  atualizadoEm: string | null
  erro: { em: string; mensagem: string | null } | null
}

/** Última carga OK e, se houver, um erro MAIS RECENTE que ela. */
export async function getSituacaoCarga(): Promise<SituacaoCarga> {
  const { rows } = await inhausPool.query<{ concluido_em: Date; status: string; mensagem: string | null }>(
    `select concluido_em, status, mensagem from public.ft_carga_real_orcado
      where status in ('OK', 'ERRO') and concluido_em is not null
      order by concluido_em desc limit 20`,
  )
  const ok = rows.find((l) => l.status === "OK")
  const erro = rows.find((l) => l.status === "ERRO")
  const erroRecente = erro && (!ok || erro.concluido_em > ok.concluido_em) ? erro : null
  return {
    atualizadoEm: ok ? ok.concluido_em.toISOString() : null,
    erro: erroRecente ? { em: erroRecente.concluido_em.toISOString(), mensagem: erroRecente.mensagem } : null,
  }
}

export async function getLancamentos(
  r: Recorte,
  medida: Medida,
  escopo: EscopoDados,
  pagina: number,
): Promise<{ linhas: Lancamento[]; total: number; tamanhoPagina: number }> {
  const offset = (Math.max(1, pagina) - 1) * TAMANHO_PAGINA
  const { sql, params } = montarConsultaLancamentos(r, medida, escopo, { limite: TAMANHO_PAGINA, offset })
  const { rows } = await inhausPool.query<Lancamento & { total: number }>(sql, params)
  assertLinhasNoEscopo(rows, (l) => l.cr, escopo)
  return {
    linhas: rows as Lancamento[], // a coluna extra `total` é inofensiva no JSON
    total: rows[0]?.total ?? 0,
    tamanhoPagina: TAMANHO_PAGINA,
  }
}

export async function getLancamentosCsv(r: Recorte, medida: Medida, escopo: EscopoDados): Promise<string> {
  const { sql, params } = montarConsultaLancamentos(r, medida, escopo, { limite: LIMITE_CSV, offset: 0 })
  const { rows } = await inhausPool.query<Lancamento & { total: number }>(sql, params)
  assertLinhasNoEscopo(rows, (l) => l.cr, escopo)
  return lancamentosParaCsv(rows)
}

export async function getOpcoes(
  dim: DimensaoKey,
  r: Recorte,
  escopo: EscopoDados,
): Promise<{ value: string; label: string }[]> {
  const { sql, params } = montarConsultaOpcoes(dim, r, escopo)
  const { rows } = await inhausPool.query<{ valor: string; rotulo: string }>(sql, params)
  return rows.map((l) => ({ value: l.valor, label: l.rotulo || l.valor }))
}
```

- [ ] **Step 4: Rota `nivel`**

`src/app/api/projecoes/nivel/route.ts`:

```ts
import { NextResponse } from "next/server"

import { guardaProjecoes } from "@/lib/projecoes/acesso"
import { getNivel } from "@/lib/projecoes/dados"
import { caminhoDe, lerEstado } from "@/lib/projecoes/parametros"

export const dynamic = "force-dynamic"

// GET /api/projecoes/nivel?<estado>&c=<valor do nível 1>&c=… — filhos de uma linha aberta.
export async function GET(request: Request) {
  const g = await guardaProjecoes()
  if (!g.ok) return g.response

  const sp = new URL(request.url).searchParams
  const estado = lerEstado(sp)
  if (!estado.periodo) return NextResponse.json({ error: "Informe o período." }, { status: 400 })
  const caminho = caminhoDe(estado.niveis, sp.getAll("c"))
  if (!caminho || caminho.length >= estado.niveis.length) {
    return NextResponse.json({ error: "Nível inválido." }, { status: 400 })
  }

  try {
    const nos = await getNivel(
      estado.niveis[caminho.length],
      { periodo: estado.periodo, filtros: estado.filtros, caminho },
      g.escopo,
    )
    return NextResponse.json({ nos })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao consultar" }, { status: 500 })
  }
}
```

- [ ] **Step 5: Rota `lancamentos`**

`src/app/api/projecoes/lancamentos/route.ts`:

```ts
import { NextResponse } from "next/server"

import { guardaProjecoes } from "@/lib/projecoes/acesso"
import { getLancamentos, getLancamentosCsv } from "@/lib/projecoes/dados"
import { caminhoDe, lerEstado } from "@/lib/projecoes/parametros"

export const dynamic = "force-dynamic"

const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/

// GET /api/projecoes/lancamentos?<estado>&c=…[&mes=AAAA-MM]&pagina=N[&formato=csv]
// Lançamentos que formam um número da tabela (célula de um mês ou total do período).
export async function GET(request: Request) {
  const g = await guardaProjecoes()
  if (!g.ok) return g.response

  const sp = new URL(request.url).searchParams
  const estado = lerEstado(sp)
  if (!estado.periodo) return NextResponse.json({ error: "Informe o período." }, { status: 400 })
  const caminho = caminhoDe(estado.niveis, sp.getAll("c"))
  if (!caminho) return NextResponse.json({ error: "Linha inválida." }, { status: 400 })
  const mes = sp.get("mes")
  if (mes && !RE_MES.test(mes)) return NextResponse.json({ error: "Mês inválido." }, { status: 400 })

  const recorte = {
    periodo: mes ? { de: mes, ate: mes } : estado.periodo,
    filtros: estado.filtros,
    caminho,
  }

  try {
    if (sp.get("formato") === "csv") {
      const csv = await getLancamentosCsv(recorte, estado.medida, g.escopo)
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="lancamentos-${mes ?? "periodo"}.csv"`,
        },
      })
    }
    const pagina = Math.max(1, Number.parseInt(sp.get("pagina") ?? "1", 10) || 1)
    return NextResponse.json(await getLancamentos(recorte, estado.medida, g.escopo, pagina))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao consultar" }, { status: 500 })
  }
}
```

- [ ] **Step 6: Rota `opcoes`**

`src/app/api/projecoes/opcoes/route.ts`:

```ts
import { NextResponse } from "next/server"

import { guardaProjecoes } from "@/lib/projecoes/acesso"
import { getOpcoes } from "@/lib/projecoes/dados"
import { ehDimensao } from "@/lib/projecoes/dimensoes"
import { lerEstado } from "@/lib/projecoes/parametros"

export const dynamic = "force-dynamic"

// GET /api/projecoes/opcoes?<estado>&dim=<dimensão> — valores possíveis de um filtro,
// considerando os demais filtros ativos (o próprio filtro da dimensão é ignorado).
export async function GET(request: Request) {
  const g = await guardaProjecoes()
  if (!g.ok) return g.response

  const sp = new URL(request.url).searchParams
  const dim = sp.get("dim") ?? ""
  if (!ehDimensao(dim)) return NextResponse.json({ error: "Dimensão inválida." }, { status: 400 })
  const estado = lerEstado(sp)
  if (!estado.periodo) return NextResponse.json({ error: "Informe o período." }, { status: 400 })

  const filtros = { ...estado.filtros }
  delete filtros[dim]

  try {
    const opcoes = await getOpcoes(dim, { periodo: estado.periodo, filtros, caminho: [] }, g.escopo)
    return NextResponse.json({ opcoes })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao consultar" }, { status: 500 })
  }
}
```

- [ ] **Step 7: Tipos e testes**

Run: `npx tsc --noEmit && npm run test`
Expected: sem erros de tipo; todos os testes passam.

- [ ] **Step 8: Conferir as rotas no servidor de dev**

Subir o dev server pela configuração `hub-inhaus-dev` de `.claude/launch.json` (porta 3000; acesso livre de dev ligado) e rodar:

```bash
curl -s "http://localhost:3000/api/projecoes/nivel?n=conta&de=2026-06&ate=2026-07" | python -c "import json,sys; d=json.load(sys.stdin)['nos']; print(len(d), d[0]['rotulo'], round(d[0]['meses']['2026-07']['realizado']))"
curl -s "http://localhost:3000/api/projecoes/lancamentos?n=conta&de=2026-07&ate=2026-07&c=41604&pagina=1" | python -c "import json,sys; d=json.load(sys.stdin); print(d['total'], len(d['linhas']))"
curl -s "http://localhost:3000/api/projecoes/opcoes?n=conta&de=2026-06&ate=2026-07&dim=gerente" | python -c "import json,sys; print(len(json.load(sys.stdin)['opcoes']))"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/projecoes/nivel?n=conta"
```

Expected:
```
28 31101 - RECEITAS DE VENDAS E SERVICOS 14955162
<n> <min(n,50)>
5
400
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/domains.ts src/lib/projecoes/acesso.ts src/lib/projecoes/dados.ts src/app/api/projecoes
git commit -m "feat(projecoes): acesso, camada de dados e rotas de expansão/detalhe/opções"
```

---

### Task 6: A tela — página, controles, tabela dinâmica e info

**Files:**
- Create: `src/app/dashboards/financeiro/projecoes/page.tsx`, `src/components/projecoes/ProjecoesInfo.tsx`, `src/components/projecoes/ControlesAnalise.tsx`, `src/components/projecoes/TabelaDinamica.tsx`, `src/components/projecoes/AreaAnalise.tsx`

**Interfaces:**
- Consumes: `lerEstado`, `escreverEstado`, `paraURLSearchParams`, `periodoPadrao`, `mesesEntre`, `rotuloMes`, `MEDIDAS`, `EstadoAnalise`, `Periodo` (parametros); `DIMENSOES`, `rotuloDimensao`, `DIMENSOES_FINANCEIRAS`, `MAX_NIVEIS`, `DimensaoKey` (dimensoes); `No`, `valorMedida`, `resumo`, `tom`, `formatarCelula`, `formatarMargem` (calculos); `getNivel`, `getTotais`, `getMesesDisponiveis`, `getSituacaoCarga` (dados); `escopoDaPagina`, `TELA_PROJECOES` (acesso); `InfoIndicador`; `MultiCombobox`; `Button`.
- Produces: `ProjecoesInfo()`; `ControlesAnalise({ estado, meses })`; `TabelaDinamica({ estado, colunas, raiz, totais, onAbrirDetalhe })` onde `onAbrirDetalhe(alvo: AlvoDetalhe)` e `type AlvoDetalhe = { caminho: string[]; mes: string | null; titulo: string }` (exportado de `TabelaDinamica.tsx`, consumido pela Task 7).

- [ ] **Step 1: Botão info**

`src/components/projecoes/ProjecoesInfo.tsx`:

```tsx
import { InfoIndicador } from "@/components/dashboard/InfoIndicador"

/**
 * Regras do Projeções em linguagem de negócio. Manter em sincronia com o topo de
 * src/lib/projecoes/calculos.ts — qualquer mudança de cálculo atualiza este texto.
 */
export function ProjecoesInfo() {
  return (
    <InfoIndicador titulo="Como ler a análise">
      <div className="space-y-3 text-sm">
        <p>
          Cada número é a <strong>soma dos lançamentos</strong> daquela linha no mês. Receitas
          aparecem <strong>positivas</strong> e custos <strong>negativos</strong>, como no BI.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong>Linhas:</strong> escolha como quebrar a análise (gerente, CR, conta…) e empilhe
            níveis — ex.: gerente › CR › conta.
          </li>
          <li>
            <strong>ROL</strong> (receita líquida) = receita bruta − impostos sobre faturamento.
          </li>
          <li>
            <strong>MC</strong> (lucro de fato) = tudo somado: receitas menos todos os custos e despesas.
          </li>
          <li>
            <strong>% Margem</strong> = MC ÷ ROL.
          </li>
          <li>
            <strong>Diferença</strong> = Realizado − Orçado. <span className="text-emerald-700">Verde</span>{" "}
            = melhor que o orçado; <span className="text-red-600">vermelho</span> = pior — vale para
            receita e para custo.
          </li>
          <li>Mês sem lançamento fica <strong>em branco</strong> (não é zero).</li>
          <li>Clique em qualquer número para ver os lançamentos que o formam.</li>
        </ul>
        <p className="rounded-xl bg-navy-mist p-3">
          <strong>Exemplo (jul/2026):</strong> receita 14.955.162 − impostos 1.646.592 ={" "}
          <strong>ROL 13.308.570</strong>. Resultado final <strong>MC 1.763.243</strong>. Margem ={" "}
          1.763.243 ÷ 13.308.570 = <strong>13,2%</strong>.
        </p>
        <p className="text-xs text-muted-foreground">
          Gerentes veem apenas os CRs da própria carteira; a gestão vê todos.
        </p>
      </div>
    </InfoIndicador>
  )
}
```

- [ ] **Step 2: Controles (níveis, valor, período, filtros, padrão)**

`src/components/projecoes/ControlesAnalise.tsx`:

```tsx
"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowUp, Filter, Plus, Save, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MultiCombobox } from "@/components/ui/MultiCombobox"
import { type ComboOption } from "@/components/ui/Combobox"
import { DIMENSOES, MAX_NIVEIS, rotuloDimensao, type DimensaoKey } from "@/lib/projecoes/dimensoes"
import {
  MEDIDAS,
  escreverEstado,
  rotuloMes,
  type EstadoAnalise,
  type Medida,
} from "@/lib/projecoes/parametros"
import { cn } from "@/lib/utils"

const CHAVE_PADRAO = "projecoes:padrao"
const DIMENSOES_FILTRO = DIMENSOES.filter((d) => d.key !== "subconta")

export function ControlesAnalise({ estado, meses }: { estado: EstadoAnalise; meses: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [filtrosAbertos, setFiltrosAbertos] = React.useState(false)
  const [opcoes, setOpcoes] = React.useState<Partial<Record<DimensaoKey, ComboOption[]>>>({})
  const [aviso, setAviso] = React.useState<string | null>(null)

  const ir = React.useCallback(
    (novo: EstadoAnalise) => router.push(`${pathname}?${escreverEstado(novo).toString()}`),
    [router, pathname],
  )

  // Sem nada na URL: aplica o padrão salvo neste navegador (se houver).
  React.useEffect(() => {
    if (window.location.search) return
    try {
      const salvo = window.localStorage.getItem(CHAVE_PADRAO)
      if (salvo) router.replace(`${pathname}?${salvo}`)
    } catch {
      /* armazenamento indisponível: segue com o padrão do sistema */
    }
  }, [router, pathname])

  // Carrega as opções dos filtros ao abrir o painel.
  React.useEffect(() => {
    if (!filtrosAbertos || !estado.periodo) return
    let vivo = true
    const base = escreverEstado(estado)
    Promise.all(
      DIMENSOES_FILTRO.map(async (d) => {
        const sp = new URLSearchParams(base)
        sp.set("dim", d.key)
        const r = await fetch(`/api/projecoes/opcoes?${sp.toString()}`, { cache: "no-store" })
        const dados = r.ok ? ((await r.json()) as { opcoes: ComboOption[] }) : { opcoes: [] }
        return [d.key, dados.opcoes] as const
      }),
    ).then((pares) => {
      if (vivo) setOpcoes(Object.fromEntries(pares))
    })
    return () => {
      vivo = false
    }
  }, [filtrosAbertos, estado])

  const disponiveis = DIMENSOES.filter((d) => !estado.niveis.includes(d.key))
  const qtdFiltros = Object.values(estado.filtros).reduce((n, v) => n + (v?.length ? 1 : 0), 0)
  const mesesAsc = [...meses].sort()

  function mover(i: number) {
    const niveis = [...estado.niveis]
    ;[niveis[i - 1], niveis[i]] = [niveis[i], niveis[i - 1]]
    ir({ ...estado, niveis })
  }

  function salvarPadrao() {
    try {
      window.localStorage.setItem(CHAVE_PADRAO, escreverEstado({ ...estado, periodo: null }).toString())
      setAviso("Padrão salvo neste navegador.")
    } catch {
      setAviso("Não foi possível salvar o padrão neste navegador.")
    }
  }

  return (
    <section className="glass reveal delay-1 space-y-4 rounded-3xl p-5" aria-label="Montagem da análise">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-navy">Linhas:</span>
        {estado.niveis.map((n, i) => (
          <span key={n} className="inline-flex items-center gap-1 rounded-full bg-teal-tint px-3 py-1 text-sm text-navy">
            {i > 0 && <span aria-hidden className="text-muted-foreground">›</span>}
            {rotuloDimensao(n)}
            {i > 0 && (
              <button
                type="button"
                onClick={() => mover(i)}
                className="rounded-full p-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
                aria-label={`Subir ${rotuloDimensao(n)} um nível`}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
            {estado.niveis.length > 1 && (
              <button
                type="button"
                onClick={() => ir({ ...estado, niveis: estado.niveis.filter((x) => x !== n) })}
                className="rounded-full p-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
                aria-label={`Remover ${rotuloDimensao(n)}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
        {estado.niveis.length < MAX_NIVEIS && disponiveis.length > 0 && (
          <label className="inline-flex items-center gap-1 text-sm text-teal">
            <Plus className="h-4 w-4" aria-hidden />
            <span className="sr-only">Adicionar nível</span>
            <select
              className="rounded-full border border-teal/30 bg-white px-2 py-1 text-sm text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
              value=""
              onChange={(e) => {
                const v = e.target.value as DimensaoKey
                if (v) ir({ ...estado, niveis: [...estado.niveis, v] })
              }}
            >
              <option value="">Adicionar nível…</option>
              {disponiveis.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div role="group" aria-label="Valor exibido" className="inline-flex rounded-full bg-navy-mist p-1">
          {MEDIDAS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={estado.medida === m.key}
              onClick={() => ir({ ...estado, medida: m.key as Medida })}
              className={cn(
                "rounded-full px-3 py-1 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal",
                estado.medida === m.key ? "bg-inhaus-grad text-white shadow-glow" : "text-navy hover:bg-white",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {estado.periodo && mesesAsc.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-navy">
            <label htmlFor="proj-de">De</label>
            <select
              id="proj-de"
              value={estado.periodo.de}
              onChange={(e) => ir({ ...estado, periodo: { de: e.target.value, ate: estado.periodo!.ate } })}
              className="rounded-lg border border-input bg-white px-2 py-1"
            >
              {mesesAsc.map((m) => (
                <option key={m} value={m}>
                  {rotuloMes(m)}
                </option>
              ))}
            </select>
            <label htmlFor="proj-ate">até</label>
            <select
              id="proj-ate"
              value={estado.periodo.ate}
              onChange={(e) => ir({ ...estado, periodo: { de: estado.periodo!.de, ate: e.target.value } })}
              className="rounded-lg border border-input bg-white px-2 py-1"
            >
              {mesesAsc.map((m) => (
                <option key={m} value={m}>
                  {rotuloMes(m)}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button type="button" variant="outline" size="sm" onClick={() => setFiltrosAbertos((v) => !v)} aria-expanded={filtrosAbertos}>
          <Filter className="mr-1.5 h-4 w-4" aria-hidden />
          Filtros{qtdFiltros > 0 ? ` (${qtdFiltros})` : ""}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={salvarPadrao}>
          <Save className="mr-1.5 h-4 w-4" aria-hidden />
          Salvar como meu padrão
        </Button>
        {aviso && (
          <span role="status" className="text-xs text-muted-foreground">
            {aviso}
          </span>
        )}
      </div>

      {filtrosAbertos && (
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {DIMENSOES_FILTRO.map((d) => (
            <div key={d.key}>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">{d.label}</span>
              <MultiCombobox
                values={estado.filtros[d.key] ?? []}
                options={opcoes[d.key] ?? []}
                placeholder="Todos"
                ariaLabel={`Filtrar por ${d.label}`}
                onChange={(valores) =>
                  ir({ ...estado, filtros: { ...estado.filtros, [d.key]: valores.length ? valores : undefined } })
                }
              />
            </div>
          ))}
          {qtdFiltros > 0 && (
            <div className="flex items-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => ir({ ...estado, filtros: {} })}>
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Tabela dinâmica**

`src/components/projecoes/TabelaDinamica.tsx`:

```tsx
"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  formatarCelula,
  formatarMargem,
  resumo,
  tom,
  valorMedida,
  type No,
  type Par,
} from "@/lib/projecoes/calculos"
import { DIMENSOES_FINANCEIRAS, rotuloDimensao } from "@/lib/projecoes/dimensoes"
import { escreverEstado, rotuloMes, type EstadoAnalise } from "@/lib/projecoes/parametros"
import { cn } from "@/lib/utils"

export type AlvoDetalhe = { caminho: string[]; mes: string | null; titulo: string }

type Filhos = { status: "carregando" } | { status: "ok"; nos: No[] } | { status: "erro"; mensagem: string }

const COR_TOM = { bom: "text-emerald-700", ruim: "text-red-600", neutro: "" } as const

export function TabelaDinamica({
  estado,
  colunas,
  raiz,
  totais,
  onAbrirDetalhe,
}: {
  estado: EstadoAnalise
  colunas: string[]
  raiz: No[]
  totais: No
  onAbrirDetalhe: (alvo: AlvoDetalhe) => void
}) {
  const [abertos, setAbertos] = React.useState<Set<string>>(new Set())
  const [filhos, setFilhos] = React.useState<Record<string, Filhos>>({})
  const base = React.useMemo(() => escreverEstado(estado), [estado])
  const ultimoNivel = estado.niveis.length - 1

  const carregar = React.useCallback(
    async (caminho: string[]) => {
      const chave = JSON.stringify(caminho)
      setFilhos((f) => ({ ...f, [chave]: { status: "carregando" } }))
      const sp = new URLSearchParams(base)
      caminho.forEach((c) => sp.append("c", c))
      try {
        const r = await fetch(`/api/projecoes/nivel?${sp.toString()}`, { cache: "no-store" })
        const dados = await r.json()
        if (!r.ok) throw new Error(dados.error ?? "Falha ao carregar")
        setFilhos((f) => ({ ...f, [chave]: { status: "ok", nos: dados.nos as No[] } }))
      } catch (e) {
        setFilhos((f) => ({ ...f, [chave]: { status: "erro", mensagem: (e as Error).message } }))
      }
    },
    [base],
  )

  function alternar(caminho: string[]) {
    const chave = JSON.stringify(caminho)
    setAbertos((a) => {
      const novo = new Set(a)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
    if (!abertos.has(chave) && !filhos[chave]) void carregar(caminho)
  }

  function abrirPrimeiroNivel() {
    if (ultimoNivel < 1) return
    setAbertos(new Set(raiz.map((n) => JSON.stringify([n.chave]))))
    raiz.forEach((n) => {
      if (!filhos[JSON.stringify([n.chave])]) void carregar([n.chave])
    })
  }

  const celula = (par: Par | undefined, caminho: string[], mes: string | null, titulo: string) => {
    const v = valorMedida(estado.medida, par)
    if (v === null) return <td className="px-3 py-1.5" />
    return (
      <td className="px-1 py-0.5 text-right">
        <button
          type="button"
          onClick={() => onAbrirDetalhe({ caminho, mes, titulo })}
          className={cn(
            "w-full rounded-md px-2 py-1 text-right tabular-nums hover:bg-teal-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal",
            COR_TOM[tom(estado.medida, v)],
          )}
          aria-label={`Ver lançamentos de ${titulo}${mes ? ` em ${rotuloMes(mes)}` : " no período"}`}
        >
          {formatarCelula(estado.medida, v)}
        </button>
      </td>
    )
  }

  const linhasResumo = (no: Pick<No, "meses" | "total">, recuo: number, prefixo: string) => {
    const itens: { rotulo: string; valor: (p: Par | undefined) => string; cor: (p: Par | undefined) => string }[] = [
      {
        rotulo: "ROL",
        valor: (p) => formatarCelula(estado.medida, resumo(p, estado.medida).rol),
        cor: (p) => COR_TOM[tom(estado.medida, resumo(p, estado.medida).rol)],
      },
      {
        rotulo: "MC (resultado)",
        valor: (p) => formatarCelula(estado.medida, resumo(p, estado.medida).mc),
        cor: (p) => COR_TOM[tom(estado.medida, resumo(p, estado.medida).mc)],
      },
      {
        rotulo: "% Margem",
        valor: (p) => (p ? formatarMargem(estado.medida, resumo(p, estado.medida).margem) : ""),
        cor: () => "",
      },
    ]
    return itens.map((it) => (
      <tr key={`${prefixo}-${it.rotulo}`} className="bg-navy-mist/60 text-xs">
        <th scope="row" className="sticky left-0 bg-navy-mist py-1 pr-3 text-left font-semibold text-navy" style={{ paddingLeft: recuo }}>
          {it.rotulo}
        </th>
        {colunas.map((m) => (
          <td key={m} className={cn("px-3 py-1 text-right tabular-nums", it.cor(no.meses[m]))}>
            {it.valor(no.meses[m])}
          </td>
        ))}
        <td className={cn("px-3 py-1 text-right font-semibold tabular-nums", it.cor(no.total))}>{it.valor(no.total)}</td>
      </tr>
    ))
  }

  const renderNo = (no: No, caminhoPai: string[], nivel: number): React.ReactNode => {
    const caminho = [...caminhoPai, no.chave]
    const chave = JSON.stringify(caminho)
    const aberto = abertos.has(chave)
    const podeAbrir = nivel < ultimoNivel
    const recuo = 12 + nivel * 20
    const rotulo = no.rotulo || "(sem valor)"
    const estadoFilhos = filhos[chave]
    const dimensao = estado.niveis[nivel]

    return (
      <React.Fragment key={chave}>
        <tr className="border-b border-border/60 hover:bg-teal-tint/40">
          <th scope="row" className="sticky left-0 bg-white py-1 pr-3 text-left font-normal text-navy" style={{ paddingLeft: recuo }}>
            <span className="flex items-center gap-1.5">
              {podeAbrir ? (
                <button
                  type="button"
                  onClick={() => alternar(caminho)}
                  aria-expanded={aberto}
                  aria-label={`${aberto ? "Recolher" : "Expandir"} ${rotulo}`}
                  className="rounded p-0.5 text-teal hover:bg-teal-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
                >
                  {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <span className="inline-block w-5" aria-hidden />
              )}
              <span className="whitespace-nowrap">{rotulo}</span>
            </span>
          </th>
          {colunas.map((m) => (
            <React.Fragment key={m}>{celula(no.meses[m], caminho, m, rotulo)}</React.Fragment>
          ))}
          {celula(no.total, caminho, null, rotulo)}
        </tr>
        {aberto && estadoFilhos?.status === "carregando" && (
          <tr>
            <td colSpan={colunas.length + 2} className="py-2 text-sm text-muted-foreground" style={{ paddingLeft: recuo + 24 }}>
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
              Carregando…
            </td>
          </tr>
        )}
        {aberto && estadoFilhos?.status === "erro" && (
          <tr>
            <td colSpan={colunas.length + 2} role="alert" className="py-2 text-sm text-destructive" style={{ paddingLeft: recuo + 24 }}>
              {estadoFilhos.mensagem}
            </td>
          </tr>
        )}
        {aberto && estadoFilhos?.status === "ok" && (
          <>
            {estadoFilhos.nos.map((filho) => renderNo(filho, caminho, nivel + 1))}
            {!DIMENSOES_FINANCEIRAS.includes(dimensao) && linhasResumo(no, recuo + 24, chave)}
          </>
        )}
      </React.Fragment>
    )
  }

  return (
    <section className="glass reveal delay-2 rounded-3xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {estado.niveis.map(rotuloDimensao).join(" › ")} · clique num número para ver os lançamentos
        </p>
        <div className="flex gap-2">
          {ultimoNivel > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={abrirPrimeiroNivel}>
              Abrir 1º nível
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setAbertos(new Set())}>
            Recolher tudo
          </Button>
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-navy text-white">
            <tr>
              <th scope="col" className="sticky left-0 z-20 bg-navy px-3 py-2 text-left font-semibold">
                {rotuloDimensao(estado.niveis[0])}
              </th>
              {colunas.map((m) => (
                <th key={m} scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                  {rotuloMes(m)}
                </th>
              ))}
              <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                Total do período
              </th>
            </tr>
          </thead>
          <tbody>{raiz.map((no) => renderNo(no, [], 0))}</tbody>
          <tfoot className="border-t-2 border-navy">{linhasResumo(totais, 12, "total")}</tfoot>
        </table>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: A página**

`src/app/dashboards/financeiro/projecoes/page.tsx`:

```tsx
import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"

import { ControlesAnalise } from "@/components/projecoes/ControlesAnalise"
import { ProjecoesInfo } from "@/components/projecoes/ProjecoesInfo"
import { AreaAnalise } from "@/components/projecoes/AreaAnalise"
import { assertTelaVisivel } from "@/lib/dashboard-acesso"
import { escopoDaPagina, TELA_PROJECOES } from "@/lib/projecoes/acesso"
import type { No } from "@/lib/projecoes/calculos"
import {
  getMesesDisponiveis,
  getNivel,
  getSituacaoCarga,
  getTotais,
  type SituacaoCarga,
} from "@/lib/projecoes/dados"
import {
  escreverEstado,
  lerEstado,
  mesesEntre,
  paraURLSearchParams,
  periodoPadrao,
} from "@/lib/projecoes/parametros"

export const metadata: Metadata = { title: "Projeções" }

// Lê a base a cada requisição (sem prerender no build).
export const dynamic = "force-dynamic"

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

export default async function ProjecoesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  await assertTelaVisivel(TELA_PROJECOES)
  const escopo = await escopoDaPagina()
  const estado = lerEstado(paraURLSearchParams(searchParams))

  let meses: string[] = []
  let carga: SituacaoCarga | null = null
  let raiz: No[] = []
  let totais: No | null = null
  let erro: string | null = null

  try {
    ;[meses, carga] = await Promise.all([getMesesDisponiveis(escopo), getSituacaoCarga()])
    estado.periodo ??= periodoPadrao(meses)
    if (estado.periodo) {
      const recorte = { periodo: estado.periodo, filtros: estado.filtros, caminho: [] }
      ;[raiz, totais] = await Promise.all([getNivel(estado.niveis[0], recorte, escopo), getTotais(recorte, escopo)])
    }
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha ao consultar a base do Projeções."
  }

  const colunas = estado.periodo ? mesesEntre(estado.periodo.de, estado.periodo.ate) : []
  const chaveTabela = escreverEstado(estado).toString()

  return (
    <div className="space-y-6">
      <section className="reveal">
        <span className="eyebrow">Financeiro</span>
        <div className="mt-3 flex items-center gap-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-navy">Projeções</h1>
          <ProjecoesInfo />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Realizado × Orçado por conta, CR, gerente e demais recortes — monte a análise empilhando os níveis.
        </p>
      </section>

      {erro ? (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </div>
      ) : !estado.periodo || !totais ? (
        <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
          Ainda não há lançamentos carregados para a sua carteira. Assim que a primeira carga do
          relatório Realizado × Orçado for feita, a análise aparece aqui.
        </div>
      ) : (
        <>
          <ControlesAnalise estado={estado} meses={meses} />
          <AreaAnalise key={chaveTabela} estado={estado} colunas={colunas} raiz={raiz} totais={totais} />
        </>
      )}

      <footer className="space-y-1 text-xs text-muted-foreground">
        {carga?.atualizadoEm && <p>Dados atualizados em {dataHora(carga.atualizadoEm)}.</p>}
        {carga?.erro && escopo.tipo === "todos" && (
          <p role="status" className="text-red-600">
            A última atualização falhou em {dataHora(carga.erro.em)}: {carga.erro.mensagem ?? "sem detalhe"}. A
            tela mostra os dados da última carga concluída.
          </p>
        )}
      </footer>
    </div>
  )
}
```

`AreaAnalise` (client) junta a tabela e a janela de detalhe — criar `src/components/projecoes/AreaAnalise.tsx` nesta task só com a tabela (o detalhe entra na Task 7):

```tsx
"use client"

import * as React from "react"

import { TabelaDinamica, type AlvoDetalhe } from "@/components/projecoes/TabelaDinamica"
import type { No } from "@/lib/projecoes/calculos"
import type { EstadoAnalise } from "@/lib/projecoes/parametros"

export function AreaAnalise(props: { estado: EstadoAnalise; colunas: string[]; raiz: No[]; totais: No }) {
  const [, setDetalhe] = React.useState<AlvoDetalhe | null>(null)
  return <TabelaDinamica {...props} onAbrirDetalhe={setDetalhe} />
}
```


- [ ] **Step 5: Tipos, testes e build**

Run: `npx tsc --noEmit && npm run test && npm run build`
Expected: sem erros; build conclui e lista a rota `/dashboards/financeiro/projecoes`.

- [ ] **Step 6: Conferir no navegador contra o BI**

Com o dev server `hub-inhaus-dev` rodando, abrir `http://localhost:3000/dashboards/financeiro/projecoes`:
- Linhas = Conta, colunas `JUL 2026`, `JUN 2026`, `Total do período`.
- `31101 - RECEITAS DE VENDAS E SERVICOS` jul = **14.955.162**; `41101 - PESSOAL` jul = **−3.934.842**.
- Rodapé: **MC (resultado)** jun = **1.407.294**, jul = **1.763.243**; **ROL** jul = **13.308.570**; **% Margem** jul = **13,2%**.
- Adicionar o nível Gerente, subir para o 1º nível (↑), expandir um gerente: aparecem as contas dele e as linhas ROL/MC/% Margem daquele gerente.
- Trocar para Diferença (R$): células com cor (verde/vermelho).
- Tecla Tab percorre chips, botões e células com foco visível.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboards/financeiro/projecoes src/components/projecoes
git commit -m "feat(projecoes): tela de análise dinâmica Realizado x Orçado"
```

---

### Task 7: Detalhe dos lançamentos (janela + exportar para Excel)

**Files:**
- Create: `src/components/projecoes/DetalheLancamentos.tsx`
- Modify: `src/components/projecoes/AreaAnalise.tsx`

**Interfaces:**
- Consumes: `AlvoDetalhe` (TabelaDinamica), `escreverEstado`, `rotuloMes`, `EstadoAnalise` (parametros), `Lancamento` (csv), `formatarNumero` (`@/lib/format`), `Dialog*` (`@/components/ui/dialog`), rota `/api/projecoes/lancamentos`.
- Produces: `DetalheLancamentos({ estado, alvo, onFechar })`.

- [ ] **Step 1: Componente de detalhe**

`src/components/projecoes/DetalheLancamentos.tsx`:

```tsx
"use client"

import * as React from "react"
import { Download, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { AlvoDetalhe } from "@/components/projecoes/TabelaDinamica"
import { formatarNumero } from "@/lib/format"
import type { Lancamento } from "@/lib/projecoes/csv"
import { escreverEstado, rotuloMes, type EstadoAnalise } from "@/lib/projecoes/parametros"

type Resposta = { linhas: Lancamento[]; total: number; tamanhoPagina: number }

export function DetalheLancamentos({
  estado,
  alvo,
  onFechar,
}: {
  estado: EstadoAnalise
  alvo: AlvoDetalhe
  onFechar: () => void
}) {
  const [pagina, setPagina] = React.useState(1)
  const [dados, setDados] = React.useState<Resposta | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  const consulta = React.useMemo(() => {
    const sp = escreverEstado(estado)
    alvo.caminho.forEach((c) => sp.append("c", c))
    if (alvo.mes) sp.set("mes", alvo.mes)
    return sp
  }, [estado, alvo])

  React.useEffect(() => {
    let vivo = true
    setDados(null)
    setErro(null)
    const sp = new URLSearchParams(consulta)
    sp.set("pagina", String(pagina))
    fetch(`/api/projecoes/lancamentos?${sp.toString()}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? "Falha ao carregar os lançamentos")
        if (vivo) setDados(d as Resposta)
      })
      .catch((e: Error) => vivo && setErro(e.message))
    return () => {
      vivo = false
    }
  }, [consulta, pagina])

  const csv = new URLSearchParams(consulta)
  csv.set("formato", "csv")
  const paginas = dados ? Math.max(1, Math.ceil(dados.total / dados.tamanhoPagina)) : 1

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-navy">{alvo.titulo}</DialogTitle>
          <DialogDescription>
            Lançamentos {alvo.mes ? `de ${rotuloMes(alvo.mes)}` : "do período"} que formam este número
            {dados ? ` · ${formatarNumero(dados.total)} lançamentos` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-auto rounded-xl border border-border">
          {erro ? (
            <p role="alert" className="p-4 text-sm text-destructive">{erro}</p>
          ) : !dados ? (
            <p className="p-4 text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
              Carregando…
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-navy-mist text-left text-navy">
                <tr>
                  <th scope="col" className="px-2 py-1.5">Mês</th>
                  <th scope="col" className="px-2 py-1.5">Conta</th>
                  <th scope="col" className="px-2 py-1.5">CR</th>
                  <th scope="col" className="px-2 py-1.5">Histórico</th>
                  <th scope="col" className="px-2 py-1.5">Lote</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Realizado</th>
                  <th scope="col" className="px-2 py-1.5 text-right">Orçado</th>
                </tr>
              </thead>
              <tbody>
                {dados.linhas.map((l, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="whitespace-nowrap px-2 py-1">{rotuloMes(l.mes)}</td>
                    <td className="px-2 py-1">{l.conta} - {l.desc_conta}</td>
                    <td className="px-2 py-1">{l.cr}</td>
                    <td className="px-2 py-1">{l.historico ?? "—"}</td>
                    <td className="px-2 py-1">{l.lote ?? "—"}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatarNumero(l.realizado, 2)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatarNumero(l.orcado, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-navy">
            <Button type="button" variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </Button>
            <span>
              Página {pagina} de {paginas}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>
              Próxima
            </Button>
          </div>
          <Button asChild variant="gradient" size="sm">
            <a href={`/api/projecoes/lancamentos?${csv.toString()}`} download>
              <Download className="mr-1.5 h-4 w-4" aria-hidden />
              Exportar para Excel
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Ligar o detalhe na área de análise**

Substituir o conteúdo de `src/components/projecoes/AreaAnalise.tsx`:

```tsx
"use client"

import * as React from "react"

import { DetalheLancamentos } from "@/components/projecoes/DetalheLancamentos"
import { TabelaDinamica, type AlvoDetalhe } from "@/components/projecoes/TabelaDinamica"
import type { No } from "@/lib/projecoes/calculos"
import type { EstadoAnalise } from "@/lib/projecoes/parametros"

export function AreaAnalise(props: { estado: EstadoAnalise; colunas: string[]; raiz: No[]; totais: No }) {
  const [detalhe, setDetalhe] = React.useState<AlvoDetalhe | null>(null)
  return (
    <>
      <TabelaDinamica {...props} onAbrirDetalhe={setDetalhe} />
      {detalhe && <DetalheLancamentos estado={props.estado} alvo={detalhe} onFechar={() => setDetalhe(null)} />}
    </>
  )
}
```

- [ ] **Step 3: Tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros. (Se `Button` não aceitar `asChild`, conferir `src/components/ui/button.tsx` — ele usa `@radix-ui/react-slot`; se não houver a prop, trocar o `Button asChild` por um `<a>` com as classes de `buttonVariants({ variant: "gradient", size: "sm" })`.)

- [ ] **Step 4: Conferir no navegador**

Na tela, com Linhas = Conta: clicar em `41604` de JUL 2026 → a janela lista os lançamentos; a soma da coluna Realizado nas páginas = **−56.790**. "Exportar para Excel" baixa `lancamentos-2026-07.csv`, que abre no Excel com acentos e colunas corretas. Esc fecha a janela e o foco volta à célula.

- [ ] **Step 5: Commit**

```bash
git add src/components/projecoes/DetalheLancamentos.tsx src/components/projecoes/AreaAnalise.tsx
git commit -m "feat(projecoes): detalhe dos lançamentos com exportação para Excel"
```

---

### Task 8: Vínculo de CRs na tela Usuários

**Files:**
- Create: `src/components/admin/SeletorCrs.tsx`
- Modify: `src/components/admin/UsuariosAdmin.tsx` (formulário de criação ~linha 265 e de edição ~linha 377)

**Interfaces:**
- Consumes: `GET /api/admin/clientes-crs` → `{ clientes: string[]; crs: { cr: string; cliente: string | null; descricao: string | null }[] }`; `PATCH`/`POST /api/admin/usuarios` já aceitam `crs: string[]`; `UsuarioAdmin.crs`.
- Produces: `SeletorCrs({ value, onChange })`.

- [ ] **Step 1: Confirmar que a API grava `crs`**

Run: `grep -n "crs" src/app/api/admin/usuarios/route.ts src/lib/usuarios-admin.ts`
Expected: o `crs` validado pelo zod chega a `salvarClassificacaoEVinculos(...)` em `usuarios-admin.ts` (tanto no POST quanto no PATCH). Se algum dos dois fluxos não repassar `crs`, repassar `input.crs` na chamada — é o único ajuste de back-end desta task.

- [ ] **Step 2: Seletor**

`src/components/admin/SeletorCrs.tsx`:

```tsx
"use client"

import * as React from "react"

import { type ComboOption } from "@/components/ui/Combobox"
import { MultiCombobox } from "@/components/ui/MultiCombobox"

type Resposta = { crs: { cr: string; descricao: string | null }[] }

/**
 * Escopo de DADOS por CR (Eixo 2): quais CRs o usuário enxerga nos indicadores por CR
 * (ex.: Projeções). Gerente = os CRs da carteira dele. Admin interno vê todos.
 */
export function SeletorCrs({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [opcoes, setOpcoes] = React.useState<ComboOption[]>([])
  const [erro, setErro] = React.useState<string | null>(null)

  React.useEffect(() => {
    let vivo = true
    fetch("/api/admin/clientes-crs", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Resposta>) : Promise.reject(new Error("Falha ao carregar os CRs"))))
      .then((d) => {
        if (vivo) setOpcoes(d.crs.map((c) => ({ value: c.cr, label: c.descricao ? `${c.cr} - ${c.descricao}` : c.cr })))
      })
      .catch((e: Error) => vivo && setErro(e.message))
    return () => {
      vivo = false
    }
  }, [])

  return (
    <div>
      <MultiCombobox
        values={value}
        onChange={onChange}
        options={opcoes}
        placeholder="Nenhum CR vinculado"
        ariaLabel="CRs cujos dados o usuário pode ver"
      />
      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Formulário de EDIÇÃO**

Em `src/components/admin/UsuariosAdmin.tsx`, no componente de edição (o que tem `useState(usuario.hasAccess)`):
1. Importar no topo: `import { SeletorCrs } from "@/components/admin/SeletorCrs"`.
2. Após `const [telas, setTelas] = React.useState<string[]>(usuario.visibleScreens)`, adicionar:
   ```tsx
   const [crs, setCrs] = React.useState<string[]>(usuario.crs)
   ```
3. No `body` do `PATCH`, após `classificacao,`, adicionar `crs,`.
4. Logo depois do bloco `<div className="mt-3 max-w-sm">…Telas visíveis…</div>`, adicionar:
   ```tsx
   <div className="mt-3 max-w-sm">
     <label className="mb-1.5 block text-sm font-medium text-navy">CRs que pode ver (dados)</label>
     <SeletorCrs value={crs} onChange={setCrs} />
     <p className="mt-1.5 text-xs text-muted-foreground">
       {isAdmin && !ehCliente
         ? "Como administrador interno, este usuário vê os dados de todos os CRs."
         : "Gerentes: vincule os CRs da carteira. Sem CR vinculado, os indicadores por CR ficam vazios."}
     </p>
   </div>
   ```

- [ ] **Step 4: Formulário de CRIAÇÃO**

No componente de criação (o que tem `useState("")` para `nome`):
1. Após `const [telas, setTelas] = React.useState<string[]>([])`, adicionar `const [crs, setCrs] = React.useState<string[]>([])`.
2. No `body` do `POST`, adicionar `crs,`.
3. Após o bloco `<SeletorTelas value={telas} onChange={setTelas} />` (e seu wrapper), adicionar o mesmo bloco de rótulo + `<SeletorCrs value={crs} onChange={setCrs} />` + texto de ajuda do Step 3.

- [ ] **Step 5: Tipos, build e conferência**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

Com o dev server: abrir `/dashboards/usuarios`, editar um usuário, vincular 2 CRs, salvar e recarregar — os 2 CRs continuam marcados. Conferir no banco:

```bash
python - <<'EOF'
import sys; sys.path.insert(0, "scripts")
import psycopg2
from _banco import url_banco
conn = psycopg2.connect(url_banco()); cur = conn.cursor()
cur.execute("select auth_user_id, cr from auth_user_cr order by 1"); print(cur.fetchall()); conn.close()
EOF
```

Expected: as linhas do usuário editado com os 2 CRs.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/SeletorCrs.tsx src/components/admin/UsuariosAdmin.tsx src/app/api/admin/usuarios/route.ts src/lib/usuarios-admin.ts
git commit -m "feat(usuarios): reativa o vínculo de CRs (escopo de dados por CR)"
```

---

### Task 9: Verificação final, isolamento e documentação

**Files:**
- Create: `.claude/skills/modulo-projecoes/SKILL.md`
- Modify: `CLAUDE.md` (seção "Módulos — detalhes em skills do projeto")

**Interfaces:**
- Consumes: tudo o que foi entregue.

- [ ] **Step 1: Teste de isolamento de ponta a ponta (Trava 1 + Trava 2 no banco real)**

```bash
npx vitest run src/lib/projecoes src/lib/seguranca
python - <<'EOF'
import sys; sys.path.insert(0, "scripts")
import psycopg2
from _banco import url_banco
conn = psycopg2.connect(url_banco()); cur = conn.cursor()
# Mesmo filtro que a Trava 1 injeta, com um escopo de 1 CR: nenhum outro CR pode aparecer.
cur.execute("""select distinct cr_cod from ft_real_orcado f
                where split_part(btrim(f.cr),' - ',1) = any(%s)""", (["25415"],))
print(cur.fetchall()); conn.close()
EOF
```

Expected: testes PASS; saída `[('25415',)]`.

- [ ] **Step 2: Verificação completa**

Run: `npx tsc --noEmit && npm run test && python -m pytest scripts/test_carga_real_orcado.py -q && npm run build`
Expected: tudo verde; build lista `/dashboards/financeiro/projecoes` e as 3 rotas `/api/projecoes/*`.

- [ ] **Step 3: Skill do módulo**

`.claude/skills/modulo-projecoes/SKILL.md`:

```markdown
---
name: modulo-projecoes
description: "Módulo Projeções (Financeiro): base histórica Realizado × Orçado (ft_real_orcado, dm_conta, ft_carga_real_orcado), carregador/RPA do RE x RO, tabela dinâmica em /dashboards/financeiro/projecoes, ROL/MC/% Margem. Use ao mexer em src/lib/projecoes, na carga do RE x RO ou na etapa 2 (projeção de contratos)."
---

# Módulo Projeções — etapa 1 (base histórica)

Spec: `docs/superpowers/specs/2026-09-23-projecoes-base-historica-design.md` ·
Plano: `docs/superpowers/plans/2026-09-23-projecoes-base-historica.md`.

- **Fonte:** relatório **RE x RO** do sistema da GPS (1 linha = 1 lançamento: conta × CR × mês;
  `RE` = realizado, `OR` = orçado, nunca os dois na mesma linha). Recorte atual: carteira do
  gerente geral Lucas Rodrigues da Silva, desde jul/2025.
- **Tabelas** (`prisma/sql/014_projecoes.sql`): `ft_real_orcado` (grão do export; colunas
  GERADAS `cr_cod`, `pec_cod`, `pec_situacao`, `conta_mae` — nunca gravar), `dm_conta` (30 linhas
  do BI 1.2.05: nome/ordem/grupo), `ft_carga_real_orcado` (log de cargas).
- **Carga:** `scripts/carga_real_orcado.py` (referência para o RPA, Python + psycopg2): numa
  transação apaga os meses do arquivo e reinsere; falha ⇒ rollback + registro `ERRO`.
  Simulação por padrão; `--apply` grava. Idempotente.
- **Regras:** ROL = grupo `3 - RECEITA` (receita bruta + deduções); MC = soma de tudo (TOTAL do BI);
  % Margem = MC ÷ ROL. Diferença % = (R − O) ÷ |O|; positivo = favorável. Mês sem dado = vazio.
  Texto do info em `ProjecoesInfo.tsx` ⇄ topo de `src/lib/projecoes/calculos.ts` (manter em sincronia).
- **Código:** SQL puro e testado em `consulta.ts` (Trava 1 via `predicadoSraCr(escopo, "f.cr", n)`
  em TODA consulta); `dados.ts` executa e aplica a Trava 2 no nível CR e nos lançamentos. Estado da
  análise na URL (`n`, `med`, `de`, `ate`, `f_<dim>`; `c` = caminho da linha) em `parametros.ts`.
- **Tela** `projecoes-analise` → `/dashboards/financeiro/projecoes`: tabela dinâmica (níveis
  empilháveis, meses decrescentes + total), expansão sob demanda (`/api/projecoes/nivel`), detalhe
  e CSV (`/api/projecoes/lancamentos`), filtros (`/api/projecoes/opcoes`). Padrão salvo no navegador.
- **Acesso:** gestão (admin interno) vê tudo; gerente vê os CRs vinculados na tela Usuários
  (`SeletorCrs` → `auth_user_cr`). Sem CR vinculado ⇒ tela vazia (fail-closed).
- **Conferência:** TOTAL jun/2026 = 1.407.294, jul/2026 = 1.763.243; ROL jul/2026 = 13.308.570.
- **Etapa 2 (pendente):** parametrização de contratos (taxas, produtividade, formas de cobrança por
  PEC/CR) e Flash Report semanal (ROL/MC/% projetado × realizado por PEC). Aguarda exemplo de
  cálculo de contrato do usuário.
```

- [ ] **Step 4: Ponteiro no CLAUDE.md**

Em `CLAUDE.md`, na lista da seção "Módulos — detalhes em skills do projeto", após a linha do Portal Enjoei, adicionar:

```markdown
- **Projeções** (Financeiro; Realizado × Orçado do RE x RO, `src/lib/projecoes`) → `modulo-projecoes`.
```

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/modulo-projecoes/SKILL.md CLAUDE.md
git commit -m "docs(projecoes): skill do módulo e ponteiro no CLAUDE.md"
```

---

## Pendências fora do código (para o usuário)

- Exports do RE x RO de **jul/2025 a mai/2026** → rodar `python scripts/carga_real_orcado.py <arquivo> --apply` para cada um.
- Conceder a tela **Projeções** e vincular os CRs de cada gerente na tela Usuários.
- RPA: usar `scripts/carga_real_orcado.py` como referência (mesma regra e mesmas colunas), com `--origem RPA`.
