# Flash Report — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** gestores parametrizam os itens cobrados de cada PEC e enviam, toda semana, a projeção de receita do mês; o financeiro acompanha os envios, reabre quando preciso e exporta o consolidado em Excel no layout da guia "Flash Report".

**Architecture:** módulo `src/lib/flash/` no padrão do RE x OR — núcleo PURO testável (`semanas.ts`, `calculos.ts`, `validacao.ts`, `excel.ts`) + camada server-only (`dados.ts`, `acesso.ts`) que fala com o `db_inhaus` via `inhausPool` e aplica as duas travas de isolamento. Rotas REST em `src/app/api/flash/`. Telas em `/dashboards/financeiro/flash-report` (Server Components) com uma grade de lançamento client-side focada em teclado.

**Tech Stack:** Next.js 14 (App Router), TypeScript, `pg` (`inhausPool`), zod, vitest, Tailwind (tokens do hub), lucide-react, **exceljs** (nova dependência, só para o export).

**Spec:** `docs/superpowers/specs/2026-09-27-flash-report-design.md`

## Global Constraints

- Fase 1 = **somente receita** (bruta e líquida). Nada de custo/MC calculado; colunas MC/% do Excel saem vazias.
- **Semana = semana do mês (1 a 5)**; cada semana projeta o **mês inteiro**. Regra de contagem isolada em `semanaDoMes()` (pendência 1 do usuário).
- Semana nova nasce copiada da **última semana ENVIADA** do PEC; itens ativos sem histórico usam a quantidade padrão.
- Semanas enviadas guardam o **valor unitário do momento**; mudar tarifa não altera o passado.
- Impostos: % = −(impostos realizados 31201) ÷ receita bruta realizada (31101) do PEC nos **últimos 3 meses** com dado; sem histórico → `ALIQUOTA_PADRAO` (pendência 3).
- Tabelas novas com prefixo `dm_`/`ft_`, SQL manual idempotente em `prisma/sql/`, **NUNCA `prisma db push`/`migrate`**. Todas com `cr_cod`.
- Todo dado por CR passa por **Trava 1** (filtro de CR no SQL) e **Trava 2** (`assertLinhasNoEscopo`).
- Toda tela com botão `InfoIndicador` em linguagem de negócio, sem termos técnicos, com exemplo numérico.
- Cores/raios só por tokens (`bg-navy`, `text-teal`, `bg-inhaus-grad`, `.glass`, `.eyebrow`). Sem hex solto. UI, comentários e docs em pt-BR.
- Fora de escopo: importação de BM/histórico, custos, aprovação em 2 etapas, prazo de envio, mobile.

## Review Focus

- **Semana enviada editada por requisição direta** (PUT após envio) → deve responder 409 e não alterar nada. Teste em Task 6 (`salvarRascunho` recusa status ENVIADO).
- **Gestor acessando PEC de CR fora do escopo pela URL/API** → 404/403, nunca dados. Teste em Task 6 (`garantirPecNoEscopo`).
- **Quantidade inválida digitada** (vazio, negativo, texto, decimal em "pessoas") → rejeitada com mensagem clara; hora extra/unitário aceitam decimais. Teste em Task 4.
- **Item desativado na parametrização** → some das semanas NOVAS, mas continua nas semanas já enviadas com o valor da época. Teste em Task 3 (`montarSemanaNova`).
- **Mês com 5ª semana e mês sem** (ex.: fev/2026 tem 28 dias → 4 semanas) → seletor mostra só as semanas existentes. Teste em Task 2.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `prisma/sql/015_flash_report.sql` | Tabelas `dm_flash_pec`, `dm_flash_item`, `ft_flash_semana`, `ft_flash_semana_item`, `ft_flash_evento` |
| `src/lib/flash/semanas.ts` | Regra de semana do mês (pura) |
| `src/lib/flash/calculos.ts` | Valor de item, totais, líquida, diff, semana nova (pura) |
| `src/lib/flash/validacao.ts` | Schemas zod de entrada (pura) |
| `src/lib/flash/excel.ts` | Monta o .xlsx do consolidado (pura, recebe linhas) |
| `src/lib/flash/acesso.ts` | Telas, escopo, guarda de API, usuário atual |
| `src/lib/flash/dados.ts` | Leitura/escrita no banco com as travas |
| `src/app/api/flash/**/route.ts` | Endpoints |
| `src/app/dashboards/financeiro/flash-report/**` | Telas |
| `src/components/flash/*` | Componentes (grade, parametrização, consolidado, info) |
| `src/lib/domains.ts` | Registro das 2 telas |
| `.claude/skills/modulo-flash-report/SKILL.md` | Skill do módulo |

---

### Task 1: Tabelas do banco

**Files:**
- Create: `prisma/sql/015_flash_report.sql`

**Interfaces:**
- Produces: as 5 tabelas abaixo (nomes e colunas usados por `dados.ts`).

- [ ] **Step 1: Escrever o SQL**

```sql
-- 015_flash_report.sql — Flash Report (projeção semanal de receita por PEC).
-- Idempotente. NUNCA aplicar via prisma db push. Uso: python scripts/aplicar_sql.py prisma/sql/015_flash_report.sql

-- 1) PECs habilitados no Flash Report ----------------------------------------------
CREATE TABLE IF NOT EXISTS dm_flash_pec (
  pec_cod      text        PRIMARY KEY,           -- 6 dígitos (casa com ft_real_orcado.pec_cod)
  pec_nome     text        NOT NULL,              -- texto completo do PEC como vem no RE x RO
  cr_cod       text        NOT NULL,              -- chave de isolamento (5 chars)
  gerente      text,                              -- nome do gerente (como no RE x RO)
  criado_por   text        NOT NULL,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  ativo        boolean     NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS dm_flash_pec_cr_idx ON dm_flash_pec (cr_cod);
COMMENT ON TABLE dm_flash_pec IS 'PECs que participam do Flash Report (projeção semanal de receita). Um por PEC.';

-- 2) Itens cobrados (parametrização) ---------------------------------------------------
CREATE TABLE IF NOT EXISTS dm_flash_item (
  id              bigserial     PRIMARY KEY,
  pec_cod         text          NOT NULL REFERENCES dm_flash_pec(pec_cod),
  cr_cod          text          NOT NULL,
  descricao       text          NOT NULL,
  tipo            text          NOT NULL CHECK (tipo IN ('PESSOAS','UNITARIO','HORA_EXTRA','DESCONTO','FIXO')),
  valor_unitario  numeric(18,4) NOT NULL CHECK (valor_unitario >= 0),
  qtd_padrao      numeric(14,2) NOT NULL DEFAULT 0 CHECK (qtd_padrao >= 0),
  conta           text          NOT NULL,        -- conta-mãe do plano do DRE (dm_conta.conta_mae)
  agrupador       text,                          -- área (A220, Loja Suvinil…)
  ordem           integer       NOT NULL DEFAULT 0,
  ativo           boolean       NOT NULL DEFAULT true,
  atualizado_em   timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dm_flash_item_pec_idx ON dm_flash_item (pec_cod);
COMMENT ON TABLE dm_flash_item IS 'Itens cobrados de cada PEC no Flash Report: tipo, valor unitário vigente, quantidade padrão e conta do DRE.';

-- 3) Projeção semanal (cabeçalho) --------------------------------------------------------
CREATE TABLE IF NOT EXISTS ft_flash_semana (
  id              bigserial     PRIMARY KEY,
  pec_cod         text          NOT NULL REFERENCES dm_flash_pec(pec_cod),
  cr_cod          text          NOT NULL,
  mes             date          NOT NULL,        -- 1º dia do mês projetado
  semana          smallint      NOT NULL CHECK (semana BETWEEN 1 AND 5),
  status          text          NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO','ENVIADO','REABERTO')),
  comentario      text,
  receita_bruta   numeric(18,2) NOT NULL DEFAULT 0,
  aliquota        numeric(8,6)  NOT NULL DEFAULT 0,
  receita_liquida numeric(18,2) NOT NULL DEFAULT 0,
  enviado_por     text,
  enviado_em      timestamptz,
  atualizado_em   timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (pec_cod, mes, semana)
);
CREATE INDEX IF NOT EXISTS ft_flash_semana_mes_idx ON ft_flash_semana (mes, semana);
COMMENT ON TABLE ft_flash_semana IS 'Projeção de receita do MÊS feita pelo gestor em uma semana (1 a 5). Travada quando ENVIADO.';

-- 4) Projeção semanal (linhas) -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS ft_flash_semana_item (
  semana_id       bigint        NOT NULL REFERENCES ft_flash_semana(id) ON DELETE CASCADE,
  item_id         bigint        NOT NULL REFERENCES dm_flash_item(id),
  cr_cod          text          NOT NULL,
  valor_unitario  numeric(18,4) NOT NULL,        -- cópia do valor no momento
  quantidade      numeric(14,2) NOT NULL CHECK (quantidade >= 0),
  total           numeric(18,2) NOT NULL,
  PRIMARY KEY (semana_id, item_id)
);
COMMENT ON TABLE ft_flash_semana_item IS 'Quantidade projetada de cada item em uma semana, com o valor unitário congelado.';

-- 5) Trilha de envio/reabertura ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ft_flash_evento (
  id         bigserial   PRIMARY KEY,
  semana_id  bigint      NOT NULL REFERENCES ft_flash_semana(id) ON DELETE CASCADE,
  cr_cod     text        NOT NULL,
  acao       text        NOT NULL CHECK (acao IN ('ENVIO','REABERTURA')),
  usuario    text        NOT NULL,
  motivo     text,
  em         timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE ft_flash_evento IS 'Trilha de auditoria do Flash Report: quem enviou ou reabriu cada semana, quando e por quê.';
```

- [ ] **Step 2: Aplicar e conferir**

Run: `python scripts/aplicar_sql.py prisma/sql/015_flash_report.sql`
Expected: `Aplicado: prisma/sql/015_flash_report.sql`. Rodar de novo: mesma saída (idempotente).

- [ ] **Step 3: Commit**

```bash
git add prisma/sql/015_flash_report.sql
git commit -m "feat(flash-report): tabelas da parametrização e da projeção semanal"
```

---

### Task 2: Regra de semana do mês

**Files:**
- Create: `src/lib/flash/semanas.ts`
- Test: `src/lib/flash/semanas.test.ts`

**Interfaces:**
- Produces:
  - `type Periodo = { mes: string /* "YYYY-MM" */; semana: number }`
  - `semanaDoMes(data: Date): Periodo` — semana = ⌈dia ÷ 7⌉ (1–5), no fuso America/Sao_Paulo.
  - `semanasDoMes(mes: string): number[]` — `[1..⌈diasNoMes ÷ 7⌉]`.
  - `periodoAnterior(p: Periodo): Periodo` — semana 1 volta para a última semana do mês anterior.
  - `rotuloPeriodo(p: Periodo): string` — ex.: `"Set/2026 · Semana 2"`.
  - `mesParaData(mes: string): string` — `"2026-09"` → `"2026-09-01"`.

- [ ] **Step 1: Teste que falha**

```ts
import { describe, expect, it } from "vitest"
import { mesParaData, periodoAnterior, rotuloPeriodo, semanaDoMes, semanasDoMes } from "./semanas"

describe("semanas do mês", () => {
  it("dia 1–7 = semana 1, 8–14 = 2, 29–31 = 5", () => {
    expect(semanaDoMes(new Date("2026-09-01T12:00:00-03:00"))).toEqual({ mes: "2026-09", semana: 1 })
    expect(semanaDoMes(new Date("2026-09-08T12:00:00-03:00"))).toEqual({ mes: "2026-09", semana: 2 })
    expect(semanaDoMes(new Date("2026-09-30T12:00:00-03:00"))).toEqual({ mes: "2026-09", semana: 5 })
  })
  it("usa o fuso de São Paulo (23h do dia 7 local ainda é semana 1)", () => {
    expect(semanaDoMes(new Date("2026-09-08T01:30:00Z"))).toEqual({ mes: "2026-09", semana: 1 })
  })
  it("fevereiro de 28 dias tem 4 semanas; setembro tem 5", () => {
    expect(semanasDoMes("2026-02")).toEqual([1, 2, 3, 4])
    expect(semanasDoMes("2026-09")).toEqual([1, 2, 3, 4, 5])
  })
  it("semana anterior da semana 1 é a última do mês anterior", () => {
    expect(periodoAnterior({ mes: "2026-03", semana: 1 })).toEqual({ mes: "2026-02", semana: 4 })
    expect(periodoAnterior({ mes: "2026-01", semana: 1 })).toEqual({ mes: "2025-12", semana: 5 })
    expect(periodoAnterior({ mes: "2026-09", semana: 3 })).toEqual({ mes: "2026-09", semana: 2 })
  })
  it("rótulo e data", () => {
    expect(rotuloPeriodo({ mes: "2026-09", semana: 2 })).toBe("Set/2026 · Semana 2")
    expect(mesParaData("2026-09")).toBe("2026-09-01")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/flash/semanas.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
/**
 * Semana do mês do Flash Report. Cada semana projeta o fechamento do MÊS inteiro.
 * Regra PROVISÓRIA (pendência do usuário): semana = ⌈dia ÷ 7⌉ → dias 1–7 = 1, …, 29–31 = 5.
 * Qualquer mudança de regra acontece SÓ aqui (e no texto do info).
 */
export type Periodo = { mes: string; semana: number }

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

function partesSaoPaulo(data: Date): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(data).split("-").map(Number)
  return { ano, mes, dia }
}

const doisDigitos = (n: number) => String(n).padStart(2, "0")

export function semanaDoMes(data: Date): Periodo {
  const { ano, mes, dia } = partesSaoPaulo(data)
  return { mes: `${ano}-${doisDigitos(mes)}`, semana: Math.ceil(dia / 7) }
}

function diasNoMes(mes: string): number {
  const [ano, m] = mes.split("-").map(Number)
  return new Date(Date.UTC(ano, m, 0)).getUTCDate()
}

export function semanasDoMes(mes: string): number[] {
  return Array.from({ length: Math.ceil(diasNoMes(mes) / 7) }, (_, i) => i + 1)
}

export function periodoAnterior(p: Periodo): Periodo {
  if (p.semana > 1) return { mes: p.mes, semana: p.semana - 1 }
  const [ano, m] = p.mes.split("-").map(Number)
  const mesAnt = m === 1 ? `${ano - 1}-12` : `${ano}-${doisDigitos(m - 1)}`
  const semanas = semanasDoMes(mesAnt)
  return { mes: mesAnt, semana: semanas[semanas.length - 1] }
}

export function rotuloPeriodo(p: Periodo): string {
  const [ano, m] = p.mes.split("-").map(Number)
  return `${MESES[m - 1]}/${ano} · Semana ${p.semana}`
}

export const mesParaData = (mes: string) => `${mes}-01`
```

- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.

- [ ] **Step 5: Commit** — `git add src/lib/flash/semanas*.ts && git commit -m "feat(flash-report): regra de semana do mês"`

---

### Task 3: Cálculos da projeção

**Files:**
- Create: `src/lib/flash/calculos.ts`
- Test: `src/lib/flash/calculos.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  export type TipoItem = "PESSOAS" | "UNITARIO" | "HORA_EXTRA" | "DESCONTO" | "FIXO"
  export type Item = { id: number; descricao: string; tipo: TipoItem; valorUnitario: number; qtdPadrao: number; conta: string; agrupador: string | null; ordem: number; ativo: boolean }
  export type LinhaSemana = { itemId: number; valorUnitario: number; quantidade: number }
  export const ALIQUOTA_PADRAO = 0.1425
  export const TIPOS: Record<TipoItem, { rotulo: string; decimais: boolean; contaSugerida: string }>
  export function valorLinha(tipo: TipoItem, valorUnitario: number, quantidade: number): number
  export function receitaBruta(itens: Item[], linhas: LinhaSemana[]): number
  export function receitaLiquida(bruta: number, aliquota: number): number
  export function aliquotaDoHistorico(receitaBrutaReal: number, impostosReal: number): number
  export function montarSemanaNova(itens: Item[], ultimaEnviada: LinhaSemana[] | null): LinhaSemana[]
  export type Alteracao = { itemId: number; de: number; para: number }
  export function alteracoes(atual: LinhaSemana[], anterior: LinhaSemana[] | null): Alteracao[]
  ```

- [ ] **Step 1: Teste que falha**

```ts
import { describe, expect, it } from "vitest"
import {
  ALIQUOTA_PADRAO, aliquotaDoHistorico, alteracoes, montarSemanaNova, receitaBruta, receitaLiquida, valorLinha, type Item,
} from "./calculos"

const item = (p: Partial<Item> & { id: number }): Item => ({
  descricao: "x", tipo: "PESSOAS", valorUnitario: 100, qtdPadrao: 1, conta: "31101",
  agrupador: null, ordem: 0, ativo: true, ...p,
})

describe("valorLinha", () => {
  it("pessoas = tarifa × pessoas", () => expect(valorLinha("PESSOAS", 6978.41, 15)).toBeCloseTo(104676.15, 2))
  it("desconto entra negativo", () => expect(valorLinha("DESCONTO", 50, 10)).toBe(-500))
  it("fixo = valor × quantidade", () => expect(valorLinha("FIXO", 900, 1)).toBe(900))
})

describe("receitas", () => {
  const itens = [item({ id: 1, valorUnitario: 1000 }), item({ id: 2, tipo: "DESCONTO", valorUnitario: 100 })]
  it("bruta soma as linhas usando o valor congelado da linha", () => {
    expect(receitaBruta(itens, [
      { itemId: 1, valorUnitario: 1000, quantidade: 3 },
      { itemId: 2, valorUnitario: 100, quantidade: 2 },
    ])).toBe(2800)
  })
  it("líquida desconta a alíquota; exemplo do info: 1.000.000 × 11,5% = 885.000", () => {
    expect(receitaLiquida(1_000_000, 0.115)).toBe(885_000)
  })
  it("alíquota do histórico = impostos ÷ bruta; sem histórico usa a padrão", () => {
    expect(aliquotaDoHistorico(1_000_000, -115_000)).toBeCloseTo(0.115)
    expect(aliquotaDoHistorico(0, 0)).toBe(ALIQUOTA_PADRAO)
    expect(aliquotaDoHistorico(1000, 0)).toBe(0)
  })
})

describe("montarSemanaNova", () => {
  it("copia quantidades da última enviada, usa tarifa VIGENTE e ignora item desativado", () => {
    const itens = [
      item({ id: 1, valorUnitario: 110, qtdPadrao: 9 }),
      item({ id: 2, ativo: false }),
      item({ id: 3, valorUnitario: 50, qtdPadrao: 4 }),
    ]
    const ultima = [
      { itemId: 1, valorUnitario: 100, quantidade: 15 },
      { itemId: 2, valorUnitario: 100, quantidade: 7 },
    ]
    expect(montarSemanaNova(itens, ultima)).toEqual([
      { itemId: 1, valorUnitario: 110, quantidade: 15 },
      { itemId: 3, valorUnitario: 50, quantidade: 4 },
    ])
  })
  it("sem semana enviada usa a quantidade padrão", () => {
    expect(montarSemanaNova([item({ id: 1, qtdPadrao: 7 })], null)).toEqual([{ itemId: 1, valorUnitario: 100, quantidade: 7 }])
  })
})

describe("alteracoes", () => {
  it("lista só o que mudou vs. semana anterior", () => {
    const ant = [{ itemId: 1, valorUnitario: 1, quantidade: 15 }, { itemId: 2, valorUnitario: 1, quantidade: 4 }]
    const atual = [{ itemId: 1, valorUnitario: 1, quantidade: 13 }, { itemId: 2, valorUnitario: 1, quantidade: 4 }, { itemId: 3, valorUnitario: 1, quantidade: 2 }]
    expect(alteracoes(atual, ant)).toEqual([{ itemId: 1, de: 15, para: 13 }, { itemId: 3, de: 0, para: 2 }])
  })
  it("sem semana anterior não há alterações", () => expect(alteracoes([{ itemId: 1, valorUnitario: 1, quantidade: 3 }], null)).toEqual([]))
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/flash/calculos.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
/**
 * REGRAS DE NEGÓCIO do Flash Report (fase 1: só receita). Manter em sincronia com
 * src/components/flash/FlashInfo.tsx.
 *  - Valor do item = valor unitário × quantidade. Desconto entra NEGATIVO.
 *  - Receita bruta projetada = soma dos itens do PEC na semana (projeção do MÊS inteiro).
 *  - Receita líquida = bruta × (1 − alíquota). Alíquota PROVISÓRIA = impostos realizados ÷
 *    receita bruta realizada do PEC nos últimos 3 meses; sem histórico → ALIQUOTA_PADRAO.
 *  - Semana nova = cópia das quantidades da última semana ENVIADA, com a tarifa vigente;
 *    item desativado sai; item novo entra com a quantidade padrão.
 */
export type TipoItem = "PESSOAS" | "UNITARIO" | "HORA_EXTRA" | "DESCONTO" | "FIXO"

export type Item = {
  id: number; descricao: string; tipo: TipoItem; valorUnitario: number; qtdPadrao: number
  conta: string; agrupador: string | null; ordem: number; ativo: boolean
}
export type LinhaSemana = { itemId: number; valorUnitario: number; quantidade: number }
export type Alteracao = { itemId: number; de: number; para: number }

/** % padrão de impostos para PEC sem histórico (pendência: % fixos a definir pelo financeiro). */
export const ALIQUOTA_PADRAO = 0.1425

export const TIPOS: Record<TipoItem, { rotulo: string; decimais: boolean; contaSugerida: string }> = {
  PESSOAS: { rotulo: "Pessoas por função", decimais: false, contaSugerida: "31101" },
  UNITARIO: { rotulo: "Unitário × quantidade", decimais: true, contaSugerida: "31101" },
  HORA_EXTRA: { rotulo: "Hora extra", decimais: true, contaSugerida: "31101" },
  DESCONTO: { rotulo: "Desconto", decimais: true, contaSugerida: "31101" },
  FIXO: { rotulo: "Valor fixo", decimais: true, contaSugerida: "31101" },
}

const centavos = (v: number) => Math.round(v * 100) / 100

export function valorLinha(tipo: TipoItem, valorUnitario: number, quantidade: number): number {
  const v = centavos(valorUnitario * quantidade)
  return tipo === "DESCONTO" ? -v : v
}

export function receitaBruta(itens: Item[], linhas: LinhaSemana[]): number {
  const tipo = new Map(itens.map((i) => [i.id, i.tipo]))
  return centavos(linhas.reduce((s, l) => s + valorLinha(tipo.get(l.itemId) ?? "UNITARIO", l.valorUnitario, l.quantidade), 0))
}

export const receitaLiquida = (bruta: number, aliquota: number) => centavos(bruta * (1 - aliquota))

export function aliquotaDoHistorico(receitaBrutaReal: number, impostosReal: number): number {
  if (receitaBrutaReal <= 0) return ALIQUOTA_PADRAO
  return Math.max(0, -impostosReal / receitaBrutaReal)
}

export function montarSemanaNova(itens: Item[], ultimaEnviada: LinhaSemana[] | null): LinhaSemana[] {
  const anterior = new Map((ultimaEnviada ?? []).map((l) => [l.itemId, l.quantidade]))
  return itens
    .filter((i) => i.ativo)
    .sort((a, b) => a.ordem - b.ordem || a.id - b.id)
    .map((i) => ({ itemId: i.id, valorUnitario: i.valorUnitario, quantidade: anterior.get(i.id) ?? i.qtdPadrao }))
}

export function alteracoes(atual: LinhaSemana[], anterior: LinhaSemana[] | null): Alteracao[] {
  if (!anterior) return []
  const ant = new Map(anterior.map((l) => [l.itemId, l.quantidade]))
  return atual
    .map((l) => ({ itemId: l.itemId, de: ant.get(l.itemId) ?? 0, para: l.quantidade }))
    .filter((a) => a.de !== a.para)
}
```

- [ ] **Step 4: Rodar e ver passar** → PASS.

- [ ] **Step 5: Commit** — `git add src/lib/flash/calculos*.ts && git commit -m "feat(flash-report): regras de cálculo da projeção"`

---

### Task 4: Validação de entrada

**Files:**
- Create: `src/lib/flash/validacao.ts`
- Test: `src/lib/flash/validacao.test.ts`

**Interfaces:**
- Consumes: `TIPOS`, `TipoItem` (Task 3).
- Produces:
  ```ts
  export const itemSchema      // { descricao, tipo, valorUnitario, qtdPadrao, conta, agrupador?, ordem? }
  export const rascunhoSchema  // { linhas: {itemId, quantidade}[], comentario? }
  export const reaberturaSchema // { motivo: string min 3 }
  export const periodoSchema   // { mes: /^\d{4}-\d{2}$/, semana: 1..5 } (coerce de string)
  export function validarQuantidades(linhas: {itemId:number; quantidade:number}[], tipos: Map<number, TipoItem>): string | null
  ```

- [ ] **Step 1: Teste que falha**

```ts
import { describe, expect, it } from "vitest"
import { itemSchema, periodoSchema, rascunhoSchema, reaberturaSchema, validarQuantidades } from "./validacao"

describe("validação", () => {
  it("item exige descrição, tipo válido, valor ≥ 0 e conta de 5 dígitos", () => {
    expect(itemSchema.safeParse({ descricao: "Separador", tipo: "PESSOAS", valorUnitario: 6978.4, qtdPadrao: 15, conta: "31101" }).success).toBe(true)
    expect(itemSchema.safeParse({ descricao: "", tipo: "PESSOAS", valorUnitario: 1, qtdPadrao: 1, conta: "31101" }).success).toBe(false)
    expect(itemSchema.safeParse({ descricao: "x", tipo: "OUTRO", valorUnitario: 1, qtdPadrao: 1, conta: "31101" }).success).toBe(false)
    expect(itemSchema.safeParse({ descricao: "x", tipo: "FIXO", valorUnitario: -1, qtdPadrao: 1, conta: "31101" }).success).toBe(false)
    expect(itemSchema.safeParse({ descricao: "x", tipo: "FIXO", valorUnitario: 1, qtdPadrao: 1, conta: "311" }).success).toBe(false)
  })
  it("rascunho rejeita quantidade negativa ou não numérica", () => {
    expect(rascunhoSchema.safeParse({ linhas: [{ itemId: 1, quantidade: 3 }] }).success).toBe(true)
    expect(rascunhoSchema.safeParse({ linhas: [{ itemId: 1, quantidade: -1 }] }).success).toBe(false)
    expect(rascunhoSchema.safeParse({ linhas: [{ itemId: 1, quantidade: "abc" }] }).success).toBe(false)
  })
  it("pessoas não aceita fração; hora extra aceita", () => {
    const tipos = new Map([[1, "PESSOAS" as const], [2, "HORA_EXTRA" as const]])
    expect(validarQuantidades([{ itemId: 1, quantidade: 2.5 }], tipos)).toMatch(/inteir/)
    expect(validarQuantidades([{ itemId: 2, quantidade: 12.5 }], tipos)).toBeNull()
    expect(validarQuantidades([{ itemId: 9, quantidade: 1 }], tipos)).toMatch(/não pertence/)
  })
  it("reabertura exige motivo; período valida mês e semana", () => {
    expect(reaberturaSchema.safeParse({ motivo: "" }).success).toBe(false)
    expect(periodoSchema.safeParse({ mes: "2026-09", semana: "2" }).data).toEqual({ mes: "2026-09", semana: 2 })
    expect(periodoSchema.safeParse({ mes: "2026-9", semana: 6 }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
import { z } from "zod"

import { TIPOS, type TipoItem } from "./calculos"

const numero = z.coerce.number({ invalid_type_error: "Informe um número" }).finite("Informe um número")

export const itemSchema = z.object({
  descricao: z.string().trim().min(1, "Descrição é obrigatória").max(120),
  tipo: z.enum(["PESSOAS", "UNITARIO", "HORA_EXTRA", "DESCONTO", "FIXO"], { message: "Tipo inválido" }),
  valorUnitario: numero.min(0, "Valor não pode ser negativo"),
  qtdPadrao: numero.min(0, "Quantidade não pode ser negativa"),
  conta: z.string().regex(/^\d{5}$/, "Escolha uma conta do plano do DRE"),
  agrupador: z.string().trim().max(60).nullish().transform((v) => v || null),
  ordem: z.coerce.number().int().default(0),
})

export const rascunhoSchema = z.object({
  linhas: z.array(z.object({
    itemId: z.number().int().positive(),
    quantidade: z.number({ invalid_type_error: "Informe um número" }).finite().min(0, "Quantidade não pode ser negativa"),
  })),
  comentario: z.string().trim().max(500).nullish().transform((v) => v || null),
})

export const reaberturaSchema = z.object({ motivo: z.string().trim().min(3, "Informe o motivo da reabertura").max(300) })

export const periodoSchema = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido"),
  semana: z.coerce.number().int().min(1).max(5),
})

export function validarQuantidades(
  linhas: { itemId: number; quantidade: number }[],
  tipos: Map<number, TipoItem>,
): string | null {
  for (const l of linhas) {
    const tipo = tipos.get(l.itemId)
    if (!tipo) return `O item ${l.itemId} não pertence a este PEC.`
    if (!TIPOS[tipo].decimais && !Number.isInteger(l.quantidade)) return "Quantidade de pessoas deve ser um número inteiro."
  }
  return null
}
```

- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `git commit -m "feat(flash-report): validação das entradas"`

---

### Task 5: Telas no registro de domínios + acesso

**Files:**
- Modify: `src/lib/domains.ts` (bloco `financeiro`, após a tela `projecoes-analise`)
- Create: `src/lib/flash/acesso.ts`
- Modify: `src/lib/domains.test.ts` (se ele verifica unicidade de chave, nada muda; rodar)

**Interfaces:**
- Produces:
  ```ts
  export const TELA_FLASH = "flash-report"                  // gestor lança
  export const TELA_FLASH_CONSOLIDADO = "flash-report-consolidado" // financeiro/diretoria
  export async function escopoDaPagina(): Promise<EscopoDados>
  export async function usuarioAtual(): Promise<{ nome: string; podeConsolidar: boolean }>
  export async function guardaFlash(opts?: { consolidado?: boolean }):
    Promise<{ ok: true; escopo: EscopoDados; usuario: string; podeConsolidar: boolean } | { ok: false; response: NextResponse }>
  ```

- [ ] **Step 1: Registrar as telas** em `src/lib/domains.ts` (importar `CalendarCheck` e `Sheet` de `lucide-react`):

```ts
      {
        key: "flash-report",
        label: "Flash Report",
        href: "/dashboards/financeiro/flash-report",
        palavrasChave: ["flash", "projecao", "projeção", "semana", "receita", "pec", "parametrizacao"],
        icone: CalendarCheck,
      },
      {
        key: "flash-report-consolidado",
        label: "Flash Report · Consolidado",
        href: "/dashboards/financeiro/flash-report/consolidado",
        palavrasChave: ["flash", "consolidado", "envios", "pendentes", "excel", "corporativo"],
        icone: Sheet,
      },
```

- [ ] **Step 2: Criar `acesso.ts`** (espelha `src/lib/projecoes/acesso.ts`):

```ts
import { NextResponse } from "next/server"

import { getCurrentSession, getSessionReadOnly } from "@/lib/auth-session"
import { acessoLivreLiberado } from "@/lib/dev-auth"
import { resolverEscopoDados, type EscopoDados } from "@/lib/seguranca/escopo-dados"

/**
 * Acesso ao Flash Report.
 *  - Tela `flash-report`: o gestor lança a projeção dos PECs dos SEUS CRs.
 *  - Tela `flash-report-consolidado`: financeiro/diretoria acompanham envios, reabrem e exportam.
 * O recorte de dados é SEMPRE o escopo de CRs do usuário (Trava 1 + Trava 2 em dados.ts).
 */
export const TELA_FLASH = "flash-report"
export const TELA_FLASH_CONSOLIDADO = "flash-report-consolidado"

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

export async function usuarioAtual(): Promise<{ nome: string; podeConsolidar: boolean }> {
  if (acessoLivreLiberado()) return { nome: "Visitante", podeConsolidar: true }
  const r = await getSessionReadOnly()
  if (r.status !== "ok") return { nome: "", podeConsolidar: false }
  const a = r.sessao.authorization
  return { nome: a.nome ?? a.email, podeConsolidar: a.isAdmin || a.visibleScreens.includes(TELA_FLASH_CONSOLIDADO) }
}

export async function guardaFlash(opts: { consolidado?: boolean } = {}): Promise<
  | { ok: true; escopo: EscopoDados; usuario: string; podeConsolidar: boolean }
  | { ok: false; response: NextResponse }
> {
  if (acessoLivreLiberado()) return { ok: true, escopo: { tipo: "todos" }, usuario: "Visitante", podeConsolidar: true }
  const sessao = await getCurrentSession()
  if (!sessao) return { ok: false, response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }
  const { isAdmin, visibleScreens, classificacao, nome, email } = sessao.authorization
  const podeConsolidar = isAdmin || visibleScreens.includes(TELA_FLASH_CONSOLIDADO)
  const podeLancar = isAdmin || visibleScreens.includes(TELA_FLASH)
  if (opts.consolidado ? !podeConsolidar : !(podeLancar || podeConsolidar)) {
    return { ok: false, response: NextResponse.json({ error: "Acesso restrito" }, { status: 403 }) }
  }
  const escopo = await resolverEscopoDados({ authUserId: sessao.user.id, isAdmin, classificacao })
  return { ok: true, escopo, usuario: nome ?? email, podeConsolidar }
}
```

- [ ] **Step 3: Verificar** — `npx vitest run src/lib/domains.test.ts` → PASS; `npx tsc --noEmit` → sem erros.
- [ ] **Step 4: Commit** — `git commit -m "feat(flash-report): telas no registro de domínios e guarda de acesso"`

---

### Task 6: Camada de dados (com as duas travas)

**Files:**
- Create: `src/lib/flash/dados.ts`
- Create: `src/lib/flash/sql.ts` (montagem pura de SQL com Trava 1)
- Test: `src/lib/flash/sql.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4; `inhausPool` (`@/lib/db-inhaus`); `predicadoSraCr`, `assertLinhasNoEscopo`, `EscopoDados`.
- Produces (em `dados.ts`):
  ```ts
  export type PecFlash = { pecCod: string; pecNome: string; crCod: string; gerente: string | null }
  export type ResumoPec = PecFlash & { status: "PENDENTE" | "RASCUNHO" | "ENVIADO" | "REABERTO"; receitaBruta: number; receitaLiquida: number; variacao: number | null }
  export type SemanaCompleta = { id: number; pec: PecFlash; periodo: Periodo; status: "RASCUNHO"|"ENVIADO"|"REABERTO"; comentario: string | null; aliquota: number; itens: Item[]; linhas: LinhaSemana[]; anterior: LinhaSemana[] | null; realizadoUltimoMes: { mes: string; rol: number } | null; enviadoPor: string | null; enviadoEm: string | null }
  export type LinhaConsolidado = { pec: PecFlash; semanas: Record<number, { status: string; receitaBruta: number; receitaLiquida: number } | undefined>; realizadoRol: number | null; negocio: string | null; gerenteRegional: string | null; situacao: string | null }
  export class ErroFlash extends Error { status: number }
  export async function listarMeusPecs(escopo, periodo: Periodo): Promise<ResumoPec[]>
  export async function pecsDisponiveis(escopo): Promise<PecFlash[]>          // PECs do RE x OR ainda não habilitados
  export async function habilitarPec(escopo, pecCod: string, usuario: string): Promise<void>
  export async function garantirPecNoEscopo(escopo, pecCod: string): Promise<PecFlash>   // 404 se fora
  export async function listarItens(escopo, pecCod: string): Promise<Item[]>
  export async function salvarItem(escopo, pecCod: string, dados: z.infer<typeof itemSchema>, id?: number): Promise<Item>
  export async function definirAtivo(escopo, pecCod: string, id: number, ativo: boolean): Promise<void>
  export async function abrirSemana(escopo, pecCod: string, periodo: Periodo): Promise<SemanaCompleta> // cria rascunho se não existir
  export async function salvarRascunho(escopo, pecCod, periodo, entrada: z.infer<typeof rascunhoSchema>): Promise<SemanaCompleta>
  export async function enviarSemana(escopo, pecCod, periodo, entrada, usuario: string): Promise<SemanaCompleta>
  export async function reabrirSemana(escopo, pecCod, periodo, motivo: string, usuario: string): Promise<void>
  export async function consolidado(escopo, mes: string): Promise<LinhaConsolidado[]>
  export async function contasDre(): Promise<{ conta: string; nome: string; grupo: string | null }[]>
  ```

- [ ] **Step 1: Teste que falha para o SQL puro (Trava 1)**

```ts
import { describe, expect, it } from "vitest"
import { filtroCr } from "./sql"

describe("filtroCr (Trava 1)", () => {
  it("escopo todos não filtra", () => expect(filtroCr({ tipo: "todos" }, "p.cr_cod", 3)).toEqual({ sql: "", params: [] }))
  it("lista vazia bloqueia tudo", () => expect(filtroCr({ tipo: "lista", crs: [] }, "p.cr_cod", 3).sql).toBe(" and 1=0"))
  it("lista filtra pelo código de CR", () => {
    expect(filtroCr({ tipo: "lista", crs: ["43409"] }, "p.cr_cod", 3)).toEqual({ sql: " and p.cr_cod = any($3::text[])", params: [["43409"]] })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar `sql.ts`** (as tabelas do Flash já guardam o código de 5 chars; nas consultas ao RE x OR usar `predicadoSraCr(escopo, "f.cr", n)`):

```ts
import type { EscopoDados } from "@/lib/seguranca/escopo-dados"

/** Trava 1 para as tabelas do Flash Report (coluna já é o código de 5 chars). */
export function filtroCr(escopo: EscopoDados, coluna: string, placeholder: number): { sql: string; params: unknown[] } {
  if (escopo.tipo === "todos") return { sql: "", params: [] }
  if (escopo.crs.length === 0) return { sql: " and 1=0", params: [] }
  return { sql: ` and ${coluna} = any($${placeholder}::text[])`, params: [escopo.crs] }
}
```

- [ ] **Step 4: Rodar `sql.test.ts`** → PASS.

- [ ] **Step 5: Implementar `dados.ts`.** Regras obrigatórias, cada uma com o trecho abaixo:

```ts
import type { PoolClient } from "pg"
import type { z } from "zod"

import { inhausPool } from "@/lib/db-inhaus"
import { assertLinhasNoEscopo, predicadoSraCr, type EscopoDados } from "@/lib/seguranca/escopo-dados"

import { aliquotaDoHistorico, montarSemanaNova, receitaBruta, receitaLiquida, valorLinha, type Item, type LinhaSemana } from "./calculos"
import { mesParaData, periodoAnterior, type Periodo } from "./semanas"
import { filtroCr } from "./sql"
import { validarQuantidades, type itemSchema, type rascunhoSchema } from "./validacao"

/**
 * Leitura/escrita do Flash Report. Server-only.
 * TRAVA 1: toda consulta filtra por CR (filtroCr / predicadoSraCr).
 * TRAVA 2: toda saída com CR passa por assertLinhasNoEscopo.
 */
export class ErroFlash extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export type PecFlash = { pecCod: string; pecNome: string; crCod: string; gerente: string | null }

const linhaParaItem = (r: any): Item => ({
  id: Number(r.id), descricao: r.descricao, tipo: r.tipo, valorUnitario: Number(r.valor_unitario),
  qtdPadrao: Number(r.qtd_padrao), conta: r.conta, agrupador: r.agrupador, ordem: r.ordem, ativo: r.ativo,
})

export async function garantirPecNoEscopo(escopo: EscopoDados, pecCod: string): Promise<PecFlash> {
  const f = filtroCr(escopo, "p.cr_cod", 2)
  const { rows } = await inhausPool.query(
    `select pec_cod, pec_nome, cr_cod, gerente from public.dm_flash_pec p where p.pec_cod = $1 and p.ativo${f.sql}`,
    [pecCod, ...f.params],
  )
  assertLinhasNoEscopo(rows, (r) => r.cr_cod, escopo)
  if (!rows[0]) throw new ErroFlash("PEC não encontrado.", 404)
  const r = rows[0]
  return { pecCod: r.pec_cod, pecNome: r.pec_nome, crCod: r.cr_cod, gerente: r.gerente }
}

/** PECs do RE x OR (no escopo) ainda não habilitados. Usa o registro mais recente de cada PEC. */
export async function pecsDisponiveis(escopo: EscopoDados): Promise<PecFlash[]> {
  const f = predicadoSraCr(escopo, "f.cr", 1)
  const { rows } = await inhausPool.query(
    `select distinct on (f.pec_cod) f.pec_cod, f.pec, f.cr_cod, f.gerente
       from public.ft_real_orcado f
      where f.pec_cod is not null${f.sql}
        and not exists (select 1 from public.dm_flash_pec p where p.pec_cod = f.pec_cod)
      order by f.pec_cod, f.competencia desc`,
    f.params,
  )
  assertLinhasNoEscopo(rows, (r) => r.cr_cod, escopo)
  return rows.map((r) => ({ pecCod: r.pec_cod, pecNome: r.pec, crCod: r.cr_cod, gerente: r.gerente }))
}

export async function habilitarPec(escopo: EscopoDados, pecCod: string, usuario: string): Promise<void> {
  const pec = (await pecsDisponiveis(escopo)).find((p) => p.pecCod === pecCod)
  if (!pec) throw new ErroFlash("PEC não encontrado ou fora do seu escopo.", 404)
  await inhausPool.query(
    `insert into public.dm_flash_pec (pec_cod, pec_nome, cr_cod, gerente, criado_por) values ($1,$2,$3,$4,$5)
     on conflict (pec_cod) do update set ativo = true`,
    [pec.pecCod, pec.pecNome, pec.crCod, pec.gerente, usuario],
  )
}

export async function listarItens(escopo: EscopoDados, pecCod: string): Promise<Item[]> {
  await garantirPecNoEscopo(escopo, pecCod)
  const { rows } = await inhausPool.query(
    `select * from public.dm_flash_item where pec_cod = $1 order by ativo desc, ordem, id`, [pecCod])
  return rows.map(linhaParaItem)
}

export async function salvarItem(escopo: EscopoDados, pecCod: string, d: z.infer<typeof itemSchema>, id?: number): Promise<Item> {
  const pec = await garantirPecNoEscopo(escopo, pecCod)
  const valores = [d.descricao, d.tipo, d.valorUnitario, d.qtdPadrao, d.conta, d.agrupador, d.ordem]
  const { rows } = id
    ? await inhausPool.query(
        `update public.dm_flash_item set descricao=$1, tipo=$2, valor_unitario=$3, qtd_padrao=$4, conta=$5,
                agrupador=$6, ordem=$7, atualizado_em=now() where id=$8 and pec_cod=$9 returning *`,
        [...valores, id, pecCod])
    : await inhausPool.query(
        `insert into public.dm_flash_item (descricao, tipo, valor_unitario, qtd_padrao, conta, agrupador, ordem, pec_cod, cr_cod)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [...valores, pecCod, pec.crCod])
  if (!rows[0]) throw new ErroFlash("Item não encontrado.", 404)
  // Tarifa nova vale da semana corrente em diante: atualiza só RASCUNHO/REABERTO, nunca ENVIADO.
  await inhausPool.query(
    `update public.ft_flash_semana_item si set valor_unitario = $1,
            total = round(($1 * si.quantidade * case when $3 = 'DESCONTO' then -1 else 1 end)::numeric, 2)
       from public.ft_flash_semana s
      where si.semana_id = s.id and si.item_id = $2 and s.status <> 'ENVIADO'`,
    [d.valorUnitario, rows[0].id, d.tipo])
  return linhaParaItem(rows[0])
}

export async function definirAtivo(escopo: EscopoDados, pecCod: string, id: number, ativo: boolean): Promise<void> {
  await garantirPecNoEscopo(escopo, pecCod)
  const r = await inhausPool.query(`update public.dm_flash_item set ativo=$1, atualizado_em=now() where id=$2 and pec_cod=$3`, [ativo, id, pecCod])
  if (r.rowCount === 0) throw new ErroFlash("Item não encontrado.", 404)
}

async function aliquotaDoPec(pecCod: string, crCod: string): Promise<number> {
  const { rows } = await inhausPool.query(
    `with meses as (select distinct competencia from public.ft_real_orcado where pec_cod = $1 and cr_cod = $2
                     order by competencia desc limit 3)
     select coalesce(sum(case when conta_mae = '31101' then valor_realizado end),0)::float8 as bruta,
            coalesce(sum(case when conta_mae = '31201' then valor_realizado end),0)::float8 as impostos
       from public.ft_real_orcado where pec_cod = $1 and cr_cod = $2 and competencia in (select competencia from meses)`,
    [pecCod, crCod])
  return aliquotaDoHistorico(rows[0].bruta, rows[0].impostos)
}

async function linhasDaSemana(id: number): Promise<LinhaSemana[]> {
  const { rows } = await inhausPool.query(
    `select item_id, valor_unitario, quantidade from public.ft_flash_semana_item where semana_id = $1`, [id])
  return rows.map((r) => ({ itemId: Number(r.item_id), valorUnitario: Number(r.valor_unitario), quantidade: Number(r.quantidade) }))
}

/** Última semana ENVIADA estritamente antes do período (para copiar e comparar). */
async function ultimaEnviadaAntes(pecCod: string, p: Periodo): Promise<LinhaSemana[] | null> {
  const { rows } = await inhausPool.query(
    `select id from public.ft_flash_semana where pec_cod=$1 and status='ENVIADO'
        and (mes, semana) < ($2::date, $3::smallint) order by mes desc, semana desc limit 1`,
    [pecCod, mesParaData(p.mes), p.semana])
  return rows[0] ? linhasDaSemana(Number(rows[0].id)) : null
}

async function gravarTotais(c: PoolClient | typeof inhausPool, id: number, itens: Item[], aliquota: number) {
  const linhas = await linhasDaSemana(id)
  const bruta = receitaBruta(itens, linhas)
  await c.query(`update public.ft_flash_semana set receita_bruta=$1, aliquota=$2, receita_liquida=$3, atualizado_em=now() where id=$4`,
    [bruta, aliquota, receitaLiquida(bruta, aliquota), id])
}
```

Continue `dados.ts` com as funções de semana. Pontos que o revisor vai conferir:

```ts
export type SemanaCompleta = { /* conforme Interfaces */ } // declarar o tipo completo

export async function abrirSemana(escopo: EscopoDados, pecCod: string, periodo: Periodo): Promise<SemanaCompleta> {
  const pec = await garantirPecNoEscopo(escopo, pecCod)
  const itens = await listarItens(escopo, pecCod)
  let { rows } = await inhausPool.query(`select * from public.ft_flash_semana where pec_cod=$1 and mes=$2 and semana=$3`,
    [pecCod, mesParaData(periodo.mes), periodo.semana])
  const anterior = await ultimaEnviadaAntes(pecCod, periodo)
  if (!rows[0]) {
    const aliquota = await aliquotaDoPec(pecCod, pec.crCod)
    const linhas = montarSemanaNova(itens, anterior)
    const c = await inhausPool.connect()
    try {
      await c.query("begin")
      const ins = await c.query(
        `insert into public.ft_flash_semana (pec_cod, cr_cod, mes, semana, aliquota) values ($1,$2,$3,$4,$5)
         on conflict (pec_cod, mes, semana) do nothing returning id`,
        [pecCod, pec.crCod, mesParaData(periodo.mes), periodo.semana, aliquota])
      if (ins.rows[0]) {
        const id = Number(ins.rows[0].id)
        const tipo = new Map(itens.map((i) => [i.id, i.tipo]))
        for (const l of linhas) {
          await c.query(`insert into public.ft_flash_semana_item (semana_id, item_id, cr_cod, valor_unitario, quantidade, total) values ($1,$2,$3,$4,$5,$6)`,
            [id, l.itemId, pec.crCod, l.valorUnitario, l.quantidade, valorLinha(tipo.get(l.itemId)!, l.valorUnitario, l.quantidade)])
        }
        await gravarTotais(c, id, itens, aliquota)
      }
      await c.query("commit")
    } catch (e) { await c.query("rollback"); throw e } finally { c.release() }
    rows = (await inhausPool.query(`select * from public.ft_flash_semana where pec_cod=$1 and mes=$2 and semana=$3`,
      [pecCod, mesParaData(periodo.mes), periodo.semana])).rows
  }
  // Rascunho aberto: itens ativos criados depois entram com a quantidade padrão.
  const s = rows[0]
  if (s.status !== "ENVIADO") {
    for (const i of itens.filter((i) => i.ativo)) {
      await inhausPool.query(
        `insert into public.ft_flash_semana_item (semana_id, item_id, cr_cod, valor_unitario, quantidade, total)
         values ($1,$2,$3,$4,$5,$6) on conflict do nothing`,
        [s.id, i.id, pec.crCod, i.valorUnitario, i.qtdPadrao, valorLinha(i.tipo, i.valorUnitario, i.qtdPadrao)])
    }
    // e itens desativados saem do rascunho
    await inhausPool.query(
      `delete from public.ft_flash_semana_item si using public.dm_flash_item i
        where si.semana_id=$1 and si.item_id=i.id and not i.ativo`, [s.id])
    await gravarTotais(inhausPool, Number(s.id), itens, Number(s.aliquota))
  }
  return montarSemanaCompleta(pec, periodo, Number(s.id), itens, anterior)
}
```

`montarSemanaCompleta` relê o cabeçalho, as linhas (`linhasDaSemana`) e o realizado do último mês fechado:

```sql
select to_char(max(competencia),'YYYY-MM') as mes,
       sum(case when grupo1 like '3%' then valor_realizado else 0 end)::float8 as rol
  from public.ft_real_orcado
 where pec_cod = $1 and cr_cod = $2
   and competencia = (select max(competencia) from public.ft_real_orcado where pec_cod = $1 and cr_cod = $2)
```

Regras de `salvarRascunho` / `enviarSemana` / `reabrirSemana` (transação única cada):
1. `abrirSemana` primeiro (garante escopo e existência).
2. Se `status = 'ENVIADO'` → `throw new ErroFlash("Semana já enviada. Peça ao financeiro para reabrir.", 409)` (salvar e enviar).
3. `validarQuantidades(entrada.linhas, tipos dos itens ATIVOS)` → se erro, `ErroFlash(msg, 400)`.
4. `update ft_flash_semana_item set quantidade=$, total=valorLinha(...)` por linha; `comentario`; `gravarTotais`.
5. Enviar: `status='ENVIADO', enviado_por, enviado_em=now()` + `insert ft_flash_evento (acao 'ENVIO')`.
6. Reabrir: só se `ENVIADO` (senão 409); `status='REABERTO'` + evento `'REABERTURA'` com motivo. Chamado só por rota com `consolidado: true`.

`consolidado(escopo, mes)`: habilitados no escopo (`filtroCr(escopo,"p.cr_cod",2)`) left join semanas do mês; realizado ROL do mês por PEC (`predicadoSraCr(escopo,"f.cr",n)`, `grupo1 like '3%'`), mais `negocio`, `gerente_geral`, `pec_situacao` do registro mais recente de cada PEC. Aplicar `assertLinhasNoEscopo` no resultado de cada query com `cr_cod`.

`listarMeusPecs(escopo, periodo)`: habilitados ativos no escopo (`filtroCr(escopo,"p.cr_cod",3)`) left join `ft_flash_semana` do período (status/receitas; sem linha = `PENDENTE`) e da semana anterior (`periodoAnterior`) para `variacao = liquida atual − liquida anterior` (null se não houver); `assertLinhasNoEscopo` no resultado; ordenar por gerente, PEC.

`contasDre()`: `select conta_mae, nome, grupo2 from public.dm_conta where ativo order by (conta_mae like '311%') desc, ordem` (receita primeiro).

- [ ] **Step 6: Teste de integração manual** (script descartável no scratchpad, NÃO commitar) contra o banco com escopo `{tipo:"lista", crs:["43409"]}`:
  - habilitar PEC 092454, criar 2 itens, abrir Set/2026 sem 1, salvar 15→13, enviar, tentar salvar de novo → **409**;
  - `garantirPecNoEscopo({tipo:"lista",crs:["99999"]}, "092454")` → **404**;
  - abrir semana 2 → quantidades copiadas (13);
  - desativar item 2, abrir semana 3 → item 2 ausente; semana 1 enviada ainda tem item 2.
  Apagar os dados de teste ao final (`delete from dm_flash_pec where pec_cod='092454'` depois de apagar semanas/itens).

- [ ] **Step 7:** `npx tsc --noEmit` → OK. Commit — `git commit -m "feat(flash-report): camada de dados com travas de isolamento"`

---

### Task 7: Rotas de API

**Files (todas com `export const dynamic = "force-dynamic"`):**
- `src/app/api/flash/pecs/route.ts` — `GET` disponíveis; `POST {pecCod}` habilita.
- `src/app/api/flash/pecs/[pec]/itens/route.ts` — `GET` lista; `POST` cria.
- `src/app/api/flash/pecs/[pec]/itens/[id]/route.ts` — `PUT` edita; `PATCH {ativo}`.
- `src/app/api/flash/pecs/[pec]/semanas/[mes]/[semana]/route.ts` — `GET` abre; `PUT` rascunho; `POST` envia.
- `src/app/api/flash/pecs/[pec]/semanas/[mes]/[semana]/reabrir/route.ts` — `POST {motivo}` (guarda `consolidado: true`).
- `src/app/api/flash/consolidado/excel/route.ts` — `GET ?mes=` (Task 8).

**Interfaces:**
- Consumes: `guardaFlash`, funções de `dados.ts`, schemas de `validacao.ts`.

- [ ] **Step 1: Helper de resposta** `src/app/api/flash/_resposta.ts`:

```ts
import { NextResponse } from "next/server"
import type { ZodError } from "zod"

import { ErroFlash } from "@/lib/flash/dados"

export const erroZod = (e: ZodError) => NextResponse.json({ error: e.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })

export function responderErro(e: unknown) {
  if (e instanceof ErroFlash) return NextResponse.json({ error: e.message }, { status: e.status })
  console.error("[flash-report]", e)
  return NextResponse.json({ error: "Falha ao processar o Flash Report." }, { status: 500 })
}
```

- [ ] **Step 2: Rota da semana (modelo para as demais)**

```ts
import { NextResponse } from "next/server"

import { erroZod, responderErro } from "@/app/api/flash/_resposta"
import { guardaFlash } from "@/lib/flash/acesso"
import { abrirSemana, enviarSemana, salvarRascunho } from "@/lib/flash/dados"
import { periodoSchema, rascunhoSchema } from "@/lib/flash/validacao"

export const dynamic = "force-dynamic"

type Ctx = { params: { pec: string; mes: string; semana: string } }

function periodo(ctx: Ctx) {
  return periodoSchema.safeParse({ mes: ctx.params.mes, semana: ctx.params.semana })
}

// GET — abre (ou cria como rascunho) a projeção da semana.
export async function GET(_: Request, ctx: Ctx) {
  const g = await guardaFlash(); if (!g.ok) return g.response
  const p = periodo(ctx); if (!p.success) return erroZod(p.error)
  try { return NextResponse.json(await abrirSemana(g.escopo, ctx.params.pec, p.data)) } catch (e) { return responderErro(e) }
}

// PUT — salva o rascunho (salvamento automático da tela).
export async function PUT(req: Request, ctx: Ctx) {
  const g = await guardaFlash(); if (!g.ok) return g.response
  const p = periodo(ctx); if (!p.success) return erroZod(p.error)
  const b = rascunhoSchema.safeParse(await req.json().catch(() => null)); if (!b.success) return erroZod(b.error)
  try { return NextResponse.json(await salvarRascunho(g.escopo, ctx.params.pec, p.data, b.data)) } catch (e) { return responderErro(e) }
}

// POST — envia a semana (trava).
export async function POST(req: Request, ctx: Ctx) {
  const g = await guardaFlash(); if (!g.ok) return g.response
  const p = periodo(ctx); if (!p.success) return erroZod(p.error)
  const b = rascunhoSchema.safeParse(await req.json().catch(() => null)); if (!b.success) return erroZod(b.error)
  try { return NextResponse.json(await enviarSemana(g.escopo, ctx.params.pec, p.data, b.data, g.usuario)) } catch (e) { return responderErro(e) }
}
```

As demais seguem o mesmo esqueleto (guarda → zod → função de `dados.ts` → `responderErro`). `reabrir` usa `guardaFlash({ consolidado: true })`.

- [ ] **Step 3: Verificar com o dev server** (`hub-inhaus-dev`, acesso livre): `curl -s localhost:3000/api/flash/pecs | head -c 300` → JSON com PECs; `curl -s -X PUT .../semanas/2026-09/9` → 400 "Number must be less than or equal to 5".
- [ ] **Step 4: Commit** — `git commit -m "feat(flash-report): rotas de API"`

---

### Task 8: Exportação Excel (layout da guia "Flash Report")

**Files:**
- Modify: `package.json` (`npm install exceljs`)
- Create: `src/lib/flash/excel.ts`
- Test: `src/lib/flash/excel.test.ts`
- Create: `src/app/api/flash/consolidado/excel/route.ts`

**Interfaces:**
- Consumes: `LinhaConsolidado` (Task 6), `semanasDoMes`, `rotuloPeriodo`.
- Produces: `export async function gerarExcelConsolidado(mes: string, linhas: LinhaConsolidado[]): Promise<Buffer>`

Layout (espelha a planilha atual, um bloco do mês):
- Linha 2: `F2 = "FLASH REPORT SEMANAL"`, `J2 = <MÊS POR EXTENSO EM CAIXA ALTA>`.
- Linha 3: por semana `"SEMANA n"` sobre 3 colunas; depois `"REALIZADO"`.
- Linha 4: totais de cada coluna ROL.
- Linha 5 (cabeçalho): `A CONCATENAR | B PEC. | C NEG. | D CT | E Tipo | F GERENTE REGIONAL | G GERENTE | H PEC | (I vazia) | ROL n | MC n | % n | … | ROL | MC | %`.
- Linhas 6+: uma por PEC. `A = pecCod + gerente`, `B = pecCod`, `C = negocio`, `D = situacao`, `E` vazio, `F = gerenteRegional`, `G = gerente`, `H = pecNome`; ROL = receita **líquida** projetada da semana (vazio se pendente); MC e % vazios (fase 1); bloco REALIZADO com ROL realizado.
- Formato de número `#,##0.00`; cabeçalho em negrito.

- [ ] **Step 1: Teste que falha**

```ts
import ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"
import { gerarExcelConsolidado } from "./excel"

const linha = {
  pec: { pecCod: "092454", pecNome: "092454 (SP) - BASF", crCod: "43409", gerente: "LUCAS" },
  semanas: { 1: { status: "ENVIADO", receitaBruta: 1000, receitaLiquida: 885 }, 2: undefined },
  realizadoRol: 900, negocio: "DIRETO", gerenteRegional: "WESLEY", situacao: "ATIVO",
}

describe("gerarExcelConsolidado", () => {
  it("monta o bloco do mês no layout do Flash Report", async () => {
    const buf = await gerarExcelConsolidado("2026-09", [linha])
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf)
    const ws = wb.getWorksheet("Flash Report")!
    expect(ws.getCell("F2").value).toBe("FLASH REPORT SEMANAL")
    expect(ws.getCell("J2").value).toBe("SETEMBRO")
    expect(ws.getCell("J3").value).toBe("SEMANA 1")
    expect(ws.getCell("J5").value).toBe("ROL 1")
    expect(ws.getCell("B6").value).toBe("092454")
    expect(ws.getCell("J6").value).toBe(885)
    expect(ws.getCell("M6").value).toBeNull()              // semana 2 pendente
    expect(ws.getCell("J4").value).toBe(885)               // total da coluna
    // setembro tem 5 semanas → REALIZADO começa na coluna J + 5×3 = Y
    expect(ws.getCell("Y3").value).toBe("REALIZADO")
    expect(ws.getCell("Y6").value).toBe(900)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
import ExcelJS from "exceljs"

import type { LinhaConsolidado } from "./dados"
import { semanasDoMes } from "./semanas"

/** Excel do consolidado no layout da guia "Flash Report" enviada ao corporativo. Fase 1: MC e % vazios. */
const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"]
const COL_INICIO = 10 // J
const FORMATO = "#,##0.00"

export async function gerarExcelConsolidado(mes: string, linhas: LinhaConsolidado[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Flash Report")
  const semanas = semanasDoMes(mes)
  ws.getCell("F2").value = "FLASH REPORT SEMANAL"
  ws.getCell(2, COL_INICIO).value = MESES[Number(mes.slice(5, 7)) - 1]

  const cab = ["CONCATENAR", "PEC.", "NEG.", "CT", "Tipo", "GERENTE REGIONAL", "GERENTE", "PEC"]
  cab.forEach((t, i) => (ws.getCell(5, i + 1).value = t))

  const blocos = [...semanas.map((n) => ({ titulo: `SEMANA ${n}`, suf: ` ${n}`, n })), { titulo: "REALIZADO", suf: "", n: 0 }]
  blocos.forEach((b, k) => {
    const c = COL_INICIO + k * 3
    ws.getCell(3, c).value = b.titulo
    ws.getCell(5, c).value = `ROL${b.suf}`
    ws.getCell(5, c + 1).value = `MC${b.suf}`
    ws.getCell(5, c + 2).value = `%${b.suf}`
  })

  linhas.forEach((l, i) => {
    const r = 6 + i
    const fixos = [`${l.pec.pecCod}${l.pec.gerente ?? ""}`, l.pec.pecCod, l.negocio, l.situacao, null, l.gerenteRegional, l.pec.gerente, l.pec.pecNome]
    fixos.forEach((v, j) => (ws.getCell(r, j + 1).value = v ?? null))
    blocos.forEach((b, k) => {
      const v = b.n === 0 ? l.realizadoRol : l.semanas[b.n]?.receitaLiquida
      const cel = ws.getCell(r, COL_INICIO + k * 3)
      cel.value = v ?? null
      cel.numFmt = FORMATO
    })
  })

  blocos.forEach((_, k) => {
    const c = COL_INICIO + k * 3
    let soma = 0
    for (let r = 6; r < 6 + linhas.length; r++) soma += Number(ws.getCell(r, c).value ?? 0)
    const cel = ws.getCell(4, c); cel.value = Math.round(soma * 100) / 100; cel.numFmt = FORMATO
  })
  ;[2, 3, 4, 5].forEach((r) => (ws.getRow(r).font = { bold: true }))
  return Buffer.from(await wb.xlsx.writeBuffer())
}
```

- [ ] **Step 4: Rota** `GET /api/flash/consolidado/excel?mes=2026-09` → `guardaFlash({consolidado:true})`, valida mês (`periodoSchema.pick({mes:true})`), `consolidado(escopo, mes)`, responde com `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` e `Content-Disposition: attachment; filename="FLASH REPORT LOGISTICA_<MES><AA>-SEM<n>.xlsx"` (n = última semana com algum envio).
- [ ] **Step 5: Rodar testes** → PASS. Abrir o arquivo gerado no Excel e comparar visualmente com a planilha SET26-SEM2.
- [ ] **Step 6: Commit** — `git commit -m "feat(flash-report): exportação do consolidado em Excel"`

---

### Task 9: Info do indicador + tela "Meus PECs"

**Files:**
- Create: `src/components/flash/FlashInfo.tsx`
- Create: `src/app/dashboards/financeiro/flash-report/page.tsx`
- Create: `src/components/flash/HabilitarPec.tsx` (client: combobox de PECs disponíveis + botão)

**Interfaces:**
- Consumes: `listarMeusPecs`, `pecsDisponiveis`, `semanaDoMes`, `rotuloPeriodo`, `assertTelaVisivel(TELA_FLASH)`.

- [ ] **Step 1: `FlashInfo.tsx`** (texto de negócio, em sincronia com o topo de `calculos.ts`):

```tsx
import { InfoIndicador } from "@/components/dashboard/InfoIndicador"

/** Regras do Flash Report em linguagem de negócio. Sincronizar com src/lib/flash/calculos.ts e semanas.ts. */
export function FlashInfo() {
  return (
    <InfoIndicador titulo="Como funciona o Flash Report">
      <div className="space-y-3 text-sm">
        <p>Toda semana você informa quanto o contrato vai <strong>faturar no mês inteiro</strong>. Por enquanto, só a receita.</p>
        <ul className="list-disc space-y-1 pl-4">
          <li><strong>Semana do mês:</strong> dias 1–7 = Semana 1, 8–14 = Semana 2… 29–31 = Semana 5.</li>
          <li><strong>Cada item</strong> = valor unitário × quantidade. Ex.: Separador R$ 6.978,41 × 15 pessoas = <strong>R$ 104.676,15</strong>.</li>
          <li><strong>Descontos</strong> (faltas, glosas) entram <strong>negativos</strong>.</li>
          <li><strong>Receita bruta</strong> = soma de todos os itens.</li>
          <li><strong>Receita líquida</strong> = bruta menos impostos, pelo % médio que o contrato pagou nos <strong>últimos 3 meses</strong>. Ex.: R$ 1.000.000 com 11,5% → <strong>R$ 885.000</strong>. Contrato novo usa 14,25%.</li>
          <li>A semana <strong>começa igual à última enviada</strong>: mude só o que mudou (◆ marca a alteração).</li>
          <li>Depois de <strong>enviada</strong>, a semana trava. Só o financeiro reabre, informando o motivo.</li>
          <li>Mudou a tarifa? Vale <strong>da semana atual em diante</strong>; semanas enviadas não mudam.</li>
        </ul>
      </div>
    </InfoIndicador>
  )
}
```

- [ ] **Step 2: Página "Meus PECs"** — Server Component; cabeçalho igual ao do RE x OR (`eyebrow` "Financeiro", `h1` "Flash Report" + `<FlashInfo/>`, subtítulo com `rotuloPeriodo(semanaDoMes(new Date()))`). Grade `grid gap-4 sm:grid-cols-2 xl:grid-cols-3` de cartões `.glass rounded-3xl p-5 reveal` (escalonar `delay-1..5`), cada um um `<Link>` para `/dashboards/financeiro/flash-report/<pec>?mes=&semana=` com: nome do PEC (`tituloNome`), CR, **selo de status** (Pendente = `bg-amber-100 text-amber-800`, Rascunho = `bg-mist text-navy`, Enviado = `bg-teal/10 text-teal`, Reaberto = `bg-rose-100 text-rose-800`), receita líquida projetada em `font-display text-2xl tabular-nums`, variação vs. semana anterior (▲ verde / ▼ vermelho). Estado vazio: cartão explicando "Adicione o primeiro PEC" + `<HabilitarPec/>`. Link "Consolidado" no topo se `usuarioAtual().podeConsolidar`.
- [ ] **Step 3: `HabilitarPec.tsx`** — client; `GET /api/flash/pecs`, `<select>` pesquisável (input + lista filtrada por código/nome), `POST` e `router.refresh()`. Label visível, foco visível (`focus-visible:ring-2 ring-teal`).
- [ ] **Step 4: Verificar no navegador** (dev server + acesso livre): habilitar o PEC 092454 e ver o cartão "Pendente". `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `git commit -m "feat(flash-report): tela Meus PECs e info do indicador"`

---

### Task 10: Tela de lançamento semanal (grade por teclado)

**Files:**
- Create: `src/app/dashboards/financeiro/flash-report/[pec]/page.tsx` (server: `assertTelaVisivel`, `abrirSemana`, `contasDre`, abas)
- Create: `src/components/flash/GradeLancamento.tsx` (client)
- Create: `src/components/flash/SeletorSemana.tsx` (links ‹ Sem 1 · Sem 2 · … › via `semanasDoMes`)

**Interfaces:**
- Consumes: `SemanaCompleta`, `TIPOS`, `valorLinha`, `receitaBruta`, `receitaLiquida`, `alteracoes`; `PUT`/`POST` da Task 7.

- [ ] **Step 1: Página** — cabeçalho com breadcrumb, `FlashInfo`, `SeletorSemana` e selo de status; faixa de 4 KPIs (`grid-cols-2 lg:grid-cols-4`, `.glass`): Receita bruta, Receita líquida, Vs. semana anterior, Realizado `<mês>`. Abas como links (`?aba=lancamento|parametrizacao`), `aria-current="page"` na ativa. Se o PEC não tem itens → estado vazio levando à aba Parametrização.

- [ ] **Step 2: `GradeLancamento`** — comportamento obrigatório:

```tsx
"use client"
// Grade de lançamento: SÓ a coluna "Esta semana" é editável. Teclado: Enter desce, Shift+Enter sobe,
// Tab avança (nativo). Salvamento automático 800 ms após a última digitação (PUT). Enviar mostra
// o resumo das alterações (de → para) antes de confirmar (POST).
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { TIPOS, alteracoes, receitaBruta, receitaLiquida, valorLinha } from "@/lib/flash/calculos"
import type { SemanaCompleta } from "@/lib/flash/dados"
import { formatarNumero } from "@/lib/format"

export function GradeLancamento({ semana, url }: { semana: SemanaCompleta; url: string }) {
  const router = useRouter()
  const travada = semana.status === "ENVIADO"
  const [qtd, setQtd] = useState(() => new Map(semana.linhas.map((l) => [l.itemId, String(l.quantidade)])))
  const [comentario, setComentario] = useState(semana.comentario ?? "")
  const [estado, setEstado] = useState<"salvo" | "salvando" | "erro">("salvo")
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  const linhas = useMemo(
    () => semana.linhas.map((l) => ({ ...l, quantidade: Number((qtd.get(l.itemId) ?? "0").replace(",", ".")) || 0 })),
    [qtd, semana.linhas],
  )
  const bruta = receitaBruta(semana.itens, linhas)
  const mudancas = alteracoes(linhas, semana.anterior)

  useEffect(() => { if (!travada) inputs.current[0]?.focus() }, [travada])

  // salvamento automático (debounce)
  useEffect(() => {
    if (travada) return
    const t = setTimeout(async () => {
      setEstado("salvando")
      const r = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linhas: linhas.map(({ itemId, quantidade }) => ({ itemId, quantidade })), comentario }) })
      if (r.ok) { setEstado("salvo"); setErro(null) } else { setEstado("erro"); setErro((await r.json()).error) }
    }, 800)
    return () => clearTimeout(t)
  }, [linhas, comentario, travada, url])

  function teclado(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Enter") { e.preventDefault(); inputs.current[e.shiftKey ? i - 1 : i + 1]?.focus(); inputs.current[e.shiftKey ? i - 1 : i + 1]?.select() }
  }
  // …render: grupos por (tipo, agrupador) em <table> semântica com <caption> oculto, <th scope>,
  // subtotal por grupo, coluna "Sem. ant.", input `inputMode="decimal"` com aria-label
  // "<descrição> — quantidade desta semana", marca ◆ (com texto sr-only "alterado") quando difere,
  // botão "Repetir semana anterior" (preenche qtd com semana.anterior), rodapé `sticky bottom-0 .glass`
  // com total bruto/líquido (tabular-nums), nº de alterações, textarea de comentário, status do
  // salvamento (aria-live="polite") e botão "Enviar semana" (bg-inhaus-grad).
  // Confirmar envio: diálogo (@radix-ui/react-dialog) listando mudancas "Descrição: de → para";
  // POST; em sucesso router.refresh().
}
```

Grupos com muitas linhas (> 20 itens no PEC): começam recolhidos, exceto os que têm alteração (`<details open={temAlteracao}>`). Semana `ENVIADO`: inputs `readOnly`, banner "Enviada por X em dd/mm hh:mm".

- [ ] **Step 3: Verificar no navegador:** PEC 092454 com 3 itens → digitar, Enter desce, ◆ aparece, "Salvo" após ~1 s, recarregar mantém; enviar mostra resumo "15 → 13"; após enviar os campos ficam só leitura; semana seguinte vem com 13. Tentar "2,5" em pessoas → mensagem "Quantidade de pessoas deve ser um número inteiro." Navegação só por teclado com foco visível.
- [ ] **Step 4:** `npx tsc --noEmit`. Commit — `git commit -m "feat(flash-report): grade de lançamento semanal"`

---

### Task 11: Aba Parametrização

**Files:**
- Create: `src/components/flash/Parametrizacao.tsx` (client)

**Interfaces:**
- Consumes: `Item`, `TIPOS`; `contasDre()` (passado pela página); rotas de itens (Task 7).

- [ ] **Step 1: Implementar** — tabela de itens (descrição, tipo, agrupador, valor unitário, qtd. padrão, conta, ativo) + formulário inline "Novo item" no topo:
  - Tipo como grupo de botões (`role="radiogroup"`) com os 5 `TIPOS[..].rotulo`; ao trocar, conta sugerida = `TIPOS[tipo].contaSugerida`.
  - Conta: input de busca (código ou nome) sobre a lista de `contasDre()` — receitas primeiro; mostra `"31101 · RECEITAS DE VENDAS E SERVICOS"`.
  - Agrupador: input com `datalist` dos agrupadores já usados no PEC.
  - Enter no último campo salva e devolve o foco à descrição (cadastro em sequência rápido).
  - Editar = clicar na linha → mesma linha vira formulário; salvar `PUT`.
  - Desativar/reativar com `PATCH` e confirmação "O item sai das próximas semanas; semanas enviadas não mudam."
  - Erros do servidor exibidos junto ao campo (`aria-describedby`).
- [ ] **Step 2: Verificar no navegador:** cadastrar 5 itens por teclado sem mouse; alterar tarifa de um item e ver o rascunho da semana atual recalcular e a semana enviada não mudar.
- [ ] **Step 3: Commit** — `git commit -m "feat(flash-report): parametrização dos itens do PEC"`

---

### Task 12: Tela Consolidado

**Files:**
- Create: `src/app/dashboards/financeiro/flash-report/consolidado/page.tsx`
- Create: `src/components/flash/ReabrirSemana.tsx` (client, diálogo com motivo)

**Interfaces:**
- Consumes: `consolidado`, `assertTelaVisivel(TELA_FLASH_CONSOLIDADO)`, rota `reabrir`, rota Excel.

- [ ] **Step 1: Página** — cabeçalho + `FlashInfo`; seletor de mês (`?mes=`, padrão mês corrente) e semana de referência (padrão semana corrente).
  - **Painel de envio:** "12 de 15 PECs enviados" com barra de progresso (`bg-inhaus-grad`) e lista dos pendentes (gerente · PEC).
  - **Tabela** agrupada por gerente (subtotal por gerente e total geral): PEC, uma coluna por semana do mês (receita líquida; célula com selo de status; vazia = pendente), Realizado. `tabular-nums`, alinhado à direita, cabeçalho `sticky`.
  - Ação **Reabrir** em células ENVIADO (abre `ReabrirSemana`, motivo obrigatório, `router.refresh()`).
  - Botão **Exportar Excel** → `<a href="/api/flash/consolidado/excel?mes=...">`.
- [ ] **Step 2: Verificar:** números da tela = soma no banco:

```sql
select semana, count(*) filter (where status='ENVIADO') enviados, sum(receita_liquida)
  from ft_flash_semana where mes = '2026-09-01' group by semana order by semana;
```

- [ ] **Step 3: Commit** — `git commit -m "feat(flash-report): consolidado com envios, reabertura e Excel"`

---

### Task 13: Skill do módulo, documentação e verificação final

**Files:**
- Create: `.claude/skills/modulo-flash-report/SKILL.md`
- Modify: `CLAUDE.md` (lista "Módulos — detalhes em skills": `- **Flash Report** (Financeiro; projeção semanal de receita por PEC, src/lib/flash) → modulo-flash-report.`)

- [ ] **Step 1: Skill** com frontmatter (`name: modulo-flash-report`, descrição de quando usar) e: telas/rotas, tabelas, regras de cálculo (copiar do topo de `calculos.ts`), travas, fluxo de status, layout do Excel, as 3 pendências do usuário (regra de semana, prazo, % fixos de impostos) e "fase 2 = custos/MC".
- [ ] **Step 2: Verificação completa**

Run: `npx vitest run` → todos PASS.
Run: `npx tsc --noEmit` → sem erros.
Run: `npm run build` → build OK.
Conferir no banco um PEC de ponta a ponta (itens × quantidades = `receita_bruta`; `receita_liquida = bruta × (1 − aliquota)`), e o Excel exportado contra a planilha SET26-SEM2.

- [ ] **Step 3: Commit** — `git commit -m "docs(flash-report): skill do módulo e referência no CLAUDE.md"`
