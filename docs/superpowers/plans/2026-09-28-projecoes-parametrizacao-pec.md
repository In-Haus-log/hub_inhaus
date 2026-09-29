# Projeções — visão de PECs (ROL, MC, % Margem) + parametrização do PEC — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a tela de RE x OR por uma lista de PECs com ROL, MC e % Margem por mês/semana, e criar a tela de parametrização do PEC (receitas e custos, CR por item), reaproveitando o cadastro do Flash Report.

**Architecture:** O cadastro `dm_flash_item` ganha `natureza` (RECEITA/CUSTO) e CR editável por item; a semana congela a natureza. ROL/Custos/MC/% saem de funções puras em `src/lib/flash/calculos.ts`. A tela principal lê as tabelas do Flash (`dm_flash_pec`, `ft_flash_semana`, `ft_flash_semana_item`) por uma consulta nova em `src/lib/projecoes/visao.ts`. A tabela dinâmica antiga vai para `/projecoes/re-x-or` (fora do menu).

**Tech Stack:** Next.js 14 (App Router, Server Components), TypeScript, Tailwind (tokens navy/teal), `pg` (`inhausPool`), zod, vitest.

**Spec:** `docs/superpowers/specs/2026-09-28-projecoes-parametrizacao-pec-design.md`

## Global Constraints

- **NUNCA** `prisma db push` / `prisma migrate`. Schema só por SQL manual idempotente em `prisma/sql/`, aplicado com `python scripts/aplicar_sql.py prisma/sql/016_projecoes_parametrizacao.sql`.
- Toda a interface, comentários e docs em **português do Brasil**.
- Cores/raios/sombras só por tokens do Tailwind (`bg-navy`, `text-teal`, `bg-inhaus-grad`, `.glass`, `shadow-glow`, `bg-navy-mist`, `bg-teal-tint`); **nenhum hex solto**. `rounded-3xl` nos cards, `.reveal` + `.delay-1..5`.
- Acessibilidade: contraste AA, foco visível (`focus-visible:ring-2 focus-visible:ring-teal`), HTML semântico.
- Server Components por padrão; `"use client"` só onde há estado (a parametrização e a grade do Flash já são client).
- **Trava 1** (`filtroCr` em `src/lib/flash/sql.ts`) em TODA consulta das tabelas do Flash; **Trava 2** (`assertLinhasNoEscopo`) em toda saída com CR.
- Chave de CR = código de 5 caracteres (`cr_cod`).
- Botão "info" (`InfoIndicador`) de toda tela, só em regras de negócio (zero termo técnico: nada de tabela, coluna, SQL, API), atualizado na mesma tarefa que muda o cálculo.
- **Fora do escopo:** conta (nenhum vínculo com conta em lugar nenhum), realizado/orçado, agrupar por conta, impostos e benefícios (não mexer na alíquota), gerente no cabeçalho da parametrização.
- Testes: `npx vitest run <arquivo>`. Verificação de cada entrega: `npx tsc --noEmit`.
- Não tocar nos arquivos não rastreados em `scripts/` (`atribuir_cpfs_preenchidos.mjs`, `import_*.mjs`, `seed_v2_amyris.mjs`).
- Commits terminam com a linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Em execução paralela, `git add` só os arquivos da própria tarefa; se der `index.lock`, aguarde e tente de novo.

## Review Focus

- PEC sem semana lançada no período escolhido → mostra "sem lançamento" (—), **não zero**, e fica fora dos totais. (Task 4: teste em `agrupar.test.ts`.)
- ROL = 0 → % Margem vazia (—), nunca `NaN`/`Infinity`. (Task 2: teste em `calculos.test.ts`; Task 4: teste dos totais.)
- Item de custo com CR fora do escopo do usuário: não aparece, não soma no MC dele e salvar com esse CR devolve 403. (Task 2: teste `crNoEscopo` em `sql.test.ts`; Task 3: uso em `salvarItem`.)
- Itens já existentes (receita, com conta preenchida) continuam funcionando após a migração: `natureza` padrão RECEITA, `conta` opcional. (Task 2: teste do `itemSchema` sem `natureza` e sem `conta`; Task 1: consulta de verificação.)
- Trocar natureza/CR de um item com semana em rascunho → as linhas do rascunho acompanham; semana ENVIADA não muda. (Task 3: SQL condicionado a `status = 'RASCUNHO'`; Task 8: conferência no banco.)
- Tipo incompatível com a natureza (ex.: `DESCONTO` em custo, `TAXA` em receita) → erro 400 claro. (Task 2: teste do `itemSchema`.)

## Ordem e paralelismo

- **Onda 1 (paralelo):** Task 1, Task 2.
- **Onda 2 (paralelo, depois da Task 2):** Task 3, Task 4.
- **Onda 3 (paralelo, depois das Tasks 3 e 4):** Task 5, Task 6, Task 7 (arquivos disjuntos).
- **Onda 4:** Task 8 (docs, skills e verificação final).

## Mapa de arquivos

| Arquivo | Ação | Task |
|---|---|---|
| `prisma/sql/016_projecoes_parametrizacao.sql` | criar | 1 |
| `src/lib/flash/calculos.ts` (+ `.test.ts`) | modificar | 2 |
| `src/lib/flash/validacao.ts` (+ `.test.ts`) | modificar | 2 |
| `src/lib/flash/sql.ts` (+ `.test.ts`) | modificar | 2 |
| `src/components/flash/moeda.ts` | modificar (`percentual`) | 2 |
| `src/lib/flash/dados.ts` | modificar | 3 |
| `src/lib/projecoes/agrupar.ts` (+ `.test.ts`) | criar | 4 |
| `src/lib/projecoes/visao.ts` | criar | 4 |
| `src/components/projecoes/ParametrizacaoPec.tsx` | mover de `flash/Parametrizacao.tsx` e reescrever | 5 |
| `src/components/projecoes/ParametrizacaoInfo.tsx` | criar | 5 |
| `src/app/dashboards/financeiro/projecoes/[pec]/page.tsx` | criar | 5 |
| `src/app/dashboards/financeiro/projecoes/page.tsx` | mover para `re-x-or/page.tsx` e criar a nova | 6 |
| `src/components/projecoes/SeletorPeriodo.tsx`, `ListaPecs.tsx`, `ProjecoesVisaoInfo.tsx` | criar | 6 |
| `src/lib/domains.ts` | modificar | 6 |
| `src/components/flash/GradeLancamento.tsx`, `FlashInfo.tsx` | modificar | 7 |
| `src/app/dashboards/financeiro/flash-report/[pec]/page.tsx` | modificar | 7 |
| `CLAUDE.md`, `.claude/skills/modulo-projecoes/SKILL.md`, `.claude/skills/modulo-flash-report/SKILL.md` | modificar | 8 |

---

### Task 1: Migração SQL 016

**Files:**
- Create: `prisma/sql/016_projecoes_parametrizacao.sql`

**Interfaces:**
- Produces: colunas `dm_flash_item.natureza` (`'RECEITA'|'CUSTO'`, padrão `'RECEITA'`), `ft_flash_semana_item.natureza` (mesmo domínio e padrão); `dm_flash_item.tipo` aceita também `'TAXA'` e `'VARIAVEL'`; `dm_flash_item.conta` deixa de ser `NOT NULL`. Índice por `cr_cod` em `ft_flash_semana_item`.

- [ ] **Step 1: Criar o arquivo SQL**

```sql
-- 016_projecoes_parametrizacao.sql — Parametrização do PEC: natureza (receita/custo) e CR por item.
-- Idempotente. NUNCA aplicar via prisma db push. Uso: python scripts/aplicar_sql.py prisma/sql/016_projecoes_parametrizacao.sql

-- 1) Natureza do item (itens atuais continuam RECEITA) ------------------------------------
ALTER TABLE dm_flash_item ADD COLUMN IF NOT EXISTS natureza text NOT NULL DEFAULT 'RECEITA';
DO $$ BEGIN
  ALTER TABLE dm_flash_item
    ADD CONSTRAINT dm_flash_item_natureza_check CHECK (natureza IN ('RECEITA','CUSTO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Novos tipos de custo (TAXA, VARIAVEL) ------------------------------------------------
ALTER TABLE dm_flash_item DROP CONSTRAINT IF EXISTS dm_flash_item_tipo_check;
ALTER TABLE dm_flash_item
  ADD CONSTRAINT dm_flash_item_tipo_check
  CHECK (tipo IN ('PESSOAS','UNITARIO','HORA_EXTRA','DESCONTO','FIXO','TAXA','VARIAVEL'));

-- 3) Conta deixa de ser exigida (vínculo com conta saiu do escopo) ------------------------
ALTER TABLE dm_flash_item ALTER COLUMN conta DROP NOT NULL;

-- 4) Natureza congelada na semana (o histórico não muda se o cadastro mudar) -------------
ALTER TABLE ft_flash_semana_item ADD COLUMN IF NOT EXISTS natureza text NOT NULL DEFAULT 'RECEITA';
DO $$ BEGIN
  ALTER TABLE ft_flash_semana_item
    ADD CONSTRAINT ft_flash_semana_item_natureza_check CHECK (natureza IN ('RECEITA','CUSTO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Somas por CR na visão de Projeções.
CREATE INDEX IF NOT EXISTS ft_flash_semana_item_cr_idx ON ft_flash_semana_item (cr_cod);

COMMENT ON COLUMN dm_flash_item.natureza IS 'RECEITA (entra no ROL) ou CUSTO (sai do MC). O CR do item fica em cr_cod.';
COMMENT ON COLUMN ft_flash_semana_item.natureza IS 'Natureza do item congelada no momento do lançamento da semana.';
```

- [ ] **Step 2: Aplicar no banco (fluxo padrão do projeto)**

Run: `python scripts/aplicar_sql.py prisma/sql/016_projecoes_parametrizacao.sql`
Expected: `Aplicado: prisma/sql/016_projecoes_parametrizacao.sql`

- [ ] **Step 3: Aplicar uma segunda vez (prova de idempotência)**

Run: `python scripts/aplicar_sql.py prisma/sql/016_projecoes_parametrizacao.sql`
Expected: `Aplicado: ...` de novo, sem erro.

- [ ] **Step 4: Verificar o resultado**

Run:
```bash
python -c "import sys; sys.path.insert(0,'scripts'); import psycopg2; from _banco import url_banco; c=psycopg2.connect(url_banco()); cur=c.cursor(); cur.execute(\"select table_name, column_name, is_nullable, column_default from information_schema.columns where table_name in ('dm_flash_item','ft_flash_semana_item') and column_name in ('natureza','conta') order by 1,2\"); print(cur.fetchall()); cur.execute(\"select natureza, count(*) from dm_flash_item group by 1\"); print(cur.fetchall())"
```
Expected: `natureza` existe nas duas tabelas com default `'RECEITA'::text`; `conta` de `dm_flash_item` com `is_nullable = YES`; todos os itens existentes com `natureza = RECEITA`.

- [ ] **Step 5: Commit**

```bash
git add prisma/sql/016_projecoes_parametrizacao.sql
git commit -m "feat(projecoes): SQL 016 — natureza do item (receita/custo) e tipos de custo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regras puras, validação e trava por CR (testadas)

**Files:**
- Modify: `src/lib/flash/calculos.ts`
- Modify: `src/lib/flash/validacao.ts`
- Modify: `src/lib/flash/sql.ts`
- Modify: `src/components/flash/moeda.ts`
- Test: `src/lib/flash/calculos.test.ts`, `src/lib/flash/validacao.test.ts`, `src/lib/flash/sql.test.ts`

**Interfaces:**
- Produces (em `calculos.ts`):
  - `type Natureza = "RECEITA" | "CUSTO"`
  - `type TipoItem = "PESSOAS" | "UNITARIO" | "HORA_EXTRA" | "DESCONTO" | "FIXO" | "TAXA" | "VARIAVEL"`
  - `type Item = { id: number; descricao: string; tipo: TipoItem; natureza: Natureza; crCod: string; valorUnitario: number; qtdPadrao: number; agrupador: string | null; ordem: number; ativo: boolean }` (**sem `conta`**)
  - `TIPOS: Record<TipoItem, { rotulo: string; decimais: boolean }>` (**sem `contaSugerida`**)
  - `TIPOS_POR_NATUREZA: Record<Natureza, TipoItem[]>`
  - `margemPct(mc: number, rol: number): number | null`
  - `resumoSemana(itens: Item[], linhas: LinhaSemana[], aliquota: number): { bruta: number; rol: number; custos: number; mc: number; margem: number | null }`
  - `receitaBruta(itens, linhas)` passa a somar **só itens RECEITA**.
- Produces (em `sql.ts`): `crNoEscopo(escopo: EscopoDados, cr: string): boolean`.
- Produces (em `validacao.ts`): `itemSchema` com `natureza` (padrão `RECEITA`), `crCod` opcional (5 chars, maiúsculo, `null` quando vazio) e **sem `conta`**; erro de tipo incompatível com a natureza.
- Produces (em `moeda.ts`): `percentual(v: number | null): string`.

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/flash/calculos.test.ts`: trocar o helper `item` (remover `conta`, incluir `natureza` e `crCod`) e acrescentar os blocos abaixo. O helper novo:

```ts
const item = (p: Partial<Item> & { id: number }): Item => ({
  descricao: "x", tipo: "PESSOAS", natureza: "RECEITA", crCod: "12345", valorUnitario: 100, qtdPadrao: 1,
  agrupador: null, ordem: 0, ativo: true, ...p,
})
```

Acrescentar ao final do arquivo (e importar `margemPct`, `resumoSemana`, `TIPOS_POR_NATUREZA`):

```ts
describe("custo e margem", () => {
  const itens = [
    item({ id: 1, natureza: "RECEITA", tipo: "PESSOAS", valorUnitario: 1000 }),
    item({ id: 2, natureza: "CUSTO", tipo: "HORA_EXTRA", valorUnitario: 50 }),
    item({ id: 3, natureza: "CUSTO", tipo: "TAXA", valorUnitario: 200 }),
  ]
  const linhas = [
    { itemId: 1, valorUnitario: 1000, quantidade: 10 }, // 10.000 de receita
    { itemId: 2, valorUnitario: 50, quantidade: 20 },   // 1.000 de custo
    { itemId: 3, valorUnitario: 200, quantidade: 1 },   //   200 de custo
  ]
  it("receitaBruta ignora itens de custo", () => expect(receitaBruta(itens, linhas)).toBe(10_000))
  it("resumo: ROL = bruta × (1 − alíquota); MC = ROL − custos", () => {
    const r = resumoSemana(itens, linhas, 0.1)
    expect(r.bruta).toBe(10_000)
    expect(r.rol).toBe(9_000)
    expect(r.custos).toBe(1_200)
    expect(r.mc).toBe(7_800)
    expect(r.margem).toBeCloseTo(7_800 / 9_000)
  })
  it("linha de item desconhecido é ignorada", () => {
    expect(resumoSemana(itens, [{ itemId: 99, valorUnitario: 5, quantidade: 5 }], 0.1).bruta).toBe(0)
  })
  it("margem é nula quando o ROL é zero (nunca NaN/Infinity)", () => {
    expect(margemPct(-500, 0)).toBeNull()
    expect(resumoSemana(itens, [{ itemId: 2, valorUnitario: 50, quantidade: 20 }], 0.1).margem).toBeNull()
  })
  it("desconto é receita negativa; custo nunca é DESCONTO", () => {
    expect(TIPOS_POR_NATUREZA.CUSTO).not.toContain("DESCONTO")
    expect(TIPOS_POR_NATUREZA.RECEITA).not.toContain("TAXA")
    expect(TIPOS_POR_NATUREZA.CUSTO).toEqual(expect.arrayContaining(["HORA_EXTRA", "TAXA", "VARIAVEL"]))
  })
})
```

Em `src/lib/flash/validacao.test.ts` acrescentar (ajustar os testes existentes do `itemSchema` para não enviar `conta`):

```ts
describe("itemSchema — natureza e CR", () => {
  const base = { descricao: "Hora extra 50%", tipo: "HORA_EXTRA", valorUnitario: 40, qtdPadrao: 0 }
  it("item antigo (sem natureza e sem conta) vira RECEITA e continua válido", () => {
    const r = itemSchema.parse({ ...base, tipo: "PESSOAS" })
    expect(r.natureza).toBe("RECEITA")
    expect(r.crCod).toBeNull()
  })
  it("aceita custo de hora extra, taxa e variável", () => {
    for (const tipo of ["HORA_EXTRA", "TAXA", "VARIAVEL"])
      expect(itemSchema.safeParse({ ...base, natureza: "CUSTO", tipo }).success).toBe(true)
  })
  it("rejeita DESCONTO em custo e TAXA em receita", () => {
    expect(itemSchema.safeParse({ ...base, natureza: "CUSTO", tipo: "DESCONTO" }).success).toBe(false)
    expect(itemSchema.safeParse({ ...base, natureza: "RECEITA", tipo: "TAXA" }).success).toBe(false)
  })
  it("CR do item: 5 caracteres, vira maiúsculo; vazio vira null", () => {
    expect(itemSchema.parse({ ...base, crCod: "c95dr" }).crCod).toBe("C95DR")
    expect(itemSchema.parse({ ...base, crCod: "" }).crCod).toBeNull()
    expect(itemSchema.safeParse({ ...base, crCod: "123" }).success).toBe(false)
  })
})
```

Em `src/lib/flash/sql.test.ts` acrescentar (importar `crNoEscopo`):

```ts
describe("crNoEscopo", () => {
  it("escopo todos aceita qualquer CR", () => expect(crNoEscopo({ tipo: "todos" }, "99999")).toBe(true))
  it("escopo em lista só aceita CR da lista", () => {
    expect(crNoEscopo({ tipo: "lista", crs: ["12345"] }, "12345")).toBe(true)
    expect(crNoEscopo({ tipo: "lista", crs: ["12345"] }, "54321")).toBe(false)
  })
  it("lista vazia não aceita nada (fail-closed)", () => expect(crNoEscopo({ tipo: "lista", crs: [] }, "12345")).toBe(false))
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/flash/calculos.test.ts src/lib/flash/validacao.test.ts src/lib/flash/sql.test.ts`
Expected: FAIL (`resumoSemana`, `margemPct`, `crNoEscopo`, `TIPOS_POR_NATUREZA` não existem).

- [ ] **Step 3: Implementar `calculos.ts`**

Substituir o bloco de tipos, `TIPOS` e `receitaBruta`, e acrescentar as funções novas. O cabeçalho de regras de negócio passa a dizer (manter em sincronia com `FlashInfo.tsx` e `ProjecoesVisaoInfo.tsx`):

```ts
/**
 * REGRAS DE NEGÓCIO do Flash Report / Projeções. Manter em sincronia com
 * src/components/flash/FlashInfo.tsx e src/components/projecoes/ProjecoesVisaoInfo.tsx.
 *  - Valor do item = valor unitário × quantidade. Desconto (só em receita) entra NEGATIVO.
 *  - Receita bruta projetada = soma dos itens de RECEITA do PEC na semana (projeção do MÊS inteiro).
 *  - ROL (receita líquida) = bruta × (1 − alíquota). Alíquota PROVISÓRIA = impostos realizados ÷
 *    receita bruta realizada do PEC nos últimos 3 meses; sem histórico → ALIQUOTA_PADRAO.
 *  - Custos = soma dos itens de CUSTO da semana (taxa, hora extra, variável). Impostos e
 *    benefícios ainda NÃO entram (ficam para depois).
 *  - MC = ROL − Custos. % Margem = MC ÷ ROL (vazia quando o ROL é zero).
 *  - Semana nova = cópia das quantidades da última semana ENVIADA, com a tarifa vigente;
 *    item desativado sai; item novo entra com a quantidade padrão.
 */
export type Natureza = "RECEITA" | "CUSTO"
export type TipoItem = "PESSOAS" | "UNITARIO" | "HORA_EXTRA" | "DESCONTO" | "FIXO" | "TAXA" | "VARIAVEL"

export type Item = {
  id: number; descricao: string; tipo: TipoItem; natureza: Natureza; crCod: string
  valorUnitario: number; qtdPadrao: number; agrupador: string | null; ordem: number; ativo: boolean
}
```

(`LinhaSemana`, `Alteracao`, `ALIQUOTA_PADRAO`, `valorLinha`, `receitaLiquida`, `aliquotaDoHistorico`, `montarSemanaNova`, `alteracoes` ficam como estão.)

```ts
export const TIPOS: Record<TipoItem, { rotulo: string; decimais: boolean }> = {
  PESSOAS: { rotulo: "Pessoas por função", decimais: false },
  UNITARIO: { rotulo: "Unitário × quantidade", decimais: true },
  HORA_EXTRA: { rotulo: "Hora extra", decimais: true },
  DESCONTO: { rotulo: "Desconto", decimais: true },
  FIXO: { rotulo: "Valor fixo", decimais: true },
  TAXA: { rotulo: "Taxa", decimais: true },
  VARIAVEL: { rotulo: "Variável", decimais: true },
}

/** Tipos que fazem sentido para cada natureza (a ordem é a das pílulas na parametrização). */
export const TIPOS_POR_NATUREZA: Record<Natureza, TipoItem[]> = {
  RECEITA: ["PESSOAS", "UNITARIO", "HORA_EXTRA", "DESCONTO", "FIXO"],
  CUSTO: ["HORA_EXTRA", "TAXA", "VARIAVEL", "UNITARIO", "FIXO"],
}
```

`receitaBruta` e as novas funções (depois de `centavos` e `valorLinha`):

```ts
export function receitaBruta(itens: Item[], linhas: LinhaSemana[]): number {
  return resumoSemana(itens, linhas, 0).bruta
}

export const margemPct = (mc: number, rol: number): number | null => (rol === 0 ? null : mc / rol)

/** Números da semana: bruta, ROL, custos, MC e % Margem. Linha de item desconhecido é ignorada. */
export function resumoSemana(itens: Item[], linhas: LinhaSemana[], aliquota: number) {
  const porId = new Map(itens.map((i) => [i.id, i]))
  let bruta = 0
  let custos = 0
  for (const l of linhas) {
    const i = porId.get(l.itemId)
    if (!i) continue
    const v = valorLinha(i.tipo, l.valorUnitario, l.quantidade)
    if (i.natureza === "CUSTO") custos += v
    else bruta += v
  }
  bruta = centavos(bruta)
  custos = centavos(custos)
  const rol = receitaLiquida(bruta, aliquota)
  const mc = centavos(rol - custos)
  return { bruta, rol, custos, mc, margem: margemPct(mc, rol) }
}
```

Como `receitaLiquida` é `const` declarada mais abaixo no arquivo, mova `receitaLiquida` para antes de `resumoSemana` (funções `const` não sobem).

- [ ] **Step 4: Implementar `validacao.ts`**

```ts
import { z } from "zod"

import { TIPOS, TIPOS_POR_NATUREZA, type TipoItem } from "./calculos"
import { semanasDoMes } from "./semanas"

const numero = z.coerce.number({ invalid_type_error: "Informe um número" }).finite("Informe um número")

export const itemSchema = z
  .object({
    descricao: z.string().trim().min(1, "Descrição é obrigatória").max(120),
    natureza: z.enum(["RECEITA", "CUSTO"], { message: "Natureza inválida" }).default("RECEITA"),
    tipo: z.enum(["PESSOAS", "UNITARIO", "HORA_EXTRA", "DESCONTO", "FIXO", "TAXA", "VARIAVEL"], { message: "Tipo inválido" }),
    valorUnitario: numero.min(0, "Valor não pode ser negativo"),
    qtdPadrao: numero.min(0, "Quantidade não pode ser negativa"),
    crCod: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{5}$/, "CR inválido: use os 5 caracteres do CR")
      .nullish()
      .or(z.literal(""))
      .transform((v) => v || null),
    agrupador: z.string().trim().max(60).nullish().transform((v) => v || null),
    ordem: z.coerce.number().int().default(0),
  })
  .refine((d) => TIPOS_POR_NATUREZA[d.natureza].includes(d.tipo), {
    message: "Este tipo não existe para a natureza escolhida.",
    path: ["tipo"],
  })
```

(O restante do arquivo — `rascunhoSchema`, `reaberturaSchema`, `mesSchema`, `periodoSchema`, `validarQuantidades` — não muda.) Antes de fechar, rode `grep -rn "itemSchema.shape\|itemSchema.extend\|itemSchema.pick" src` — se algum uso aparecer, adapte (o schema agora é `ZodEffects`).

Se `.toUpperCase()` não existir na versão instalada do zod (`grep '"version"' node_modules/zod/package.json`, precisa ser ≥ 3.22), troque por `z.string().trim().transform((s) => s.toUpperCase()).pipe(z.string().regex(...))`.

- [ ] **Step 5: Implementar `sql.ts` e `moeda.ts`**

Acrescentar em `src/lib/flash/sql.ts`:

```ts
/** O CR (5 chars) está dentro do escopo do usuário? Lista vazia nunca aceita (fail-closed). */
export function crNoEscopo(escopo: EscopoDados, cr: string): boolean {
  return escopo.tipo === "todos" || escopo.crs.includes(cr)
}
```

Acrescentar em `src/components/flash/moeda.ts`:

```ts
/** Percentual com 1 casa (0,132 → "13,2%"); vazio ("—") quando não há base. */
export function percentual(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
```

- [ ] **Step 6: Rodar os testes**

Run: `npx vitest run src/lib/flash`
Expected: PASS em todos os arquivos de `src/lib/flash`. (Falhas de tipo em `dados.ts`, `Parametrizacao.tsx`, `GradeLancamento.tsx` por causa do `conta` removido serão corrigidas nas Tasks 3, 5 e 7 — não corrija aqui.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/flash/calculos.ts src/lib/flash/calculos.test.ts src/lib/flash/validacao.ts src/lib/flash/validacao.test.ts src/lib/flash/sql.ts src/lib/flash/sql.test.ts src/components/flash/moeda.ts
git commit -m "feat(projecoes): regras de ROL, custos, MC e % margem; natureza e CR por item

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Camada de dados do Flash (`dados.ts`)

**Files:**
- Modify: `src/lib/flash/dados.ts`

**Interfaces:**
- Consumes (Task 2): `Item` com `natureza`/`crCod` (sem `conta`), `crNoEscopo`, `itemSchema` novo, `valorLinha`, `receitaLiquida`.
- Produces:
  - `listarItens(escopo, pecCod): Promise<Item[]>` — itens do PEC **cujo CR está no escopo**, receitas antes de custos.
  - `crsDoEscopo(escopo): Promise<{ cr: string; nome: string }[]>`
  - `salvarItem` valida o CR do item no escopo (403) e grava `natureza` e `cr_cod`.
  - `contasDre` **removida**.
  - `gravarTotais(c, id, aliquota)` (interna) soma só as linhas de RECEITA já gravadas.

- [ ] **Step 1: `linhaParaItem`**

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const linhaParaItem = (r: any): Item => ({
  id: Number(r.id),
  descricao: r.descricao,
  tipo: r.tipo,
  natureza: r.natureza,
  crCod: r.cr_cod,
  valorUnitario: Number(r.valor_unitario),
  qtdPadrao: Number(r.qtd_padrao),
  agrupador: r.agrupador,
  ordem: Number(r.ordem),
  ativo: r.ativo,
})
```

- [ ] **Step 2: `listarItens` por escopo (não mais pelo CR do PEC)**

```ts
export async function listarItens(escopo: EscopoDados, pecCod: string): Promise<Item[]> {
  await garantirPecNoEscopo(escopo, pecCod)
  const f = filtroCr(escopo, "i.cr_cod", 2)
  const { rows } = await inhausPool.query(
    `select * from public.dm_flash_item i where i.pec_cod = $1${f.sql}
      order by (i.natureza = 'CUSTO'), i.ativo desc, i.ordem, i.id`,
    [pecCod, ...f.params],
  )
  assertLinhasNoEscopo(rows, (r) => r.cr_cod, escopo)
  return rows.map(linhaParaItem)
}
```

- [ ] **Step 3: `salvarItem` (natureza, CR do item, sem conta)**

Trocar a função inteira por:

```ts
export async function salvarItem(
  escopo: EscopoDados,
  pecCod: string,
  d: z.infer<typeof itemSchema>,
  id?: number,
): Promise<Item> {
  const pec = await garantirPecNoEscopo(escopo, pecCod)
  const crItem = d.crCod ?? pec.crCod
  if (!crNoEscopo(escopo, crItem)) throw new ErroFlash("Este CR está fora do seu escopo.", 403)
  const valores = [d.descricao, d.tipo, d.valorUnitario, d.qtdPadrao, d.agrupador, d.ordem, d.natureza, crItem]
  const c = await inhausPool.connect()
  try {
    await c.query("begin")
    const f = filtroCr(escopo, "cr_cod", 11)
    const { rows } = id
      ? await c.query(
          `update public.dm_flash_item set descricao=$1, tipo=$2, valor_unitario=$3, qtd_padrao=$4,
                  agrupador=$5, ordem=$6, natureza=$7, cr_cod=$8, atualizado_em=now()
            where id=$9 and pec_cod=$10${f.sql} returning *`,
          [...valores, id, pecCod, ...f.params],
        )
      : await c.query(
          `insert into public.dm_flash_item (descricao, tipo, valor_unitario, qtd_padrao, agrupador, ordem, natureza, cr_cod, pec_cod)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
          [...valores, pecCod],
        )
    if (!rows[0]) throw new ErroFlash("Item não encontrado.", 404)
    // Mudança vale da semana corrente em diante: só semanas em RASCUNHO acompanham (valor, natureza e CR).
    // Semana ENVIADA ou REABERTA mantém a foto da época.
    const afetadas = await c.query(
      `update public.ft_flash_semana_item si set valor_unitario = $1, natureza = $4, cr_cod = $5,
              total = round(($1 * si.quantidade * case when $3 = 'DESCONTO' then -1 else 1 end)::numeric, 2)
         from public.ft_flash_semana s
        where si.semana_id = s.id and si.item_id = $2 and s.status = 'RASCUNHO'
        returning s.id, s.aliquota`,
      [d.valorUnitario, rows[0].id, d.tipo, d.natureza, crItem],
    )
    for (const s of afetadas.rows) await gravarTotais(c, Number(s.id), Number(s.aliquota))
    await c.query("commit")
    return linhaParaItem(rows[0])
  } catch (e) {
    await c.query("rollback")
    throw e
  } finally {
    c.release()
  }
}
```

No `update`, a lista de parâmetros tem 8 valores + `id` (`$9`) + `pecCod` (`$10`) + o CR do escopo (`$11`). No `insert`, 8 valores + `pecCod` (`$9`). Atualizar o import: `import { crNoEscopo, filtroCr } from "./sql"`.

Contexto: o `update` do item de outro CR fora do escopo devolve 0 linhas ⇒ 404 (a trava do `filtroCr`).

- [ ] **Step 4: Remover `contasDre` e criar `crsDoEscopo`**

Apagar `contasDre` inteira e no lugar dela:

```ts
/** CRs que o usuário pode escolher para um item (todos, ou só os do escopo). */
export async function crsDoEscopo(escopo: EscopoDados): Promise<{ cr: string; nome: string }[]> {
  const f = filtroCr(escopo, "c.cr", 1)
  const { rows } = await inhausPool.query(
    `select c.cr, coalesce(nullif(c.descri_cr, ''), nullif(c.nome_cliente, ''), c.cr) as nome
       from public.dm_cr c where true${f.sql} order by c.cr`,
    f.params,
  )
  assertLinhasNoEscopo(rows, (r) => r.cr, escopo)
  return rows.map((r) => ({ cr: r.cr, nome: r.nome }))
}
```

- [ ] **Step 5: `gravarTotais` soma só a RECEITA gravada**

Trocar a função e **todas** as chamadas (`gravarTotais(c, id, itens, aliquota)` → `gravarTotais(c, id, aliquota)`), que estão em `abrirSemana` (2 vezes) e `gravarQuantidades`:

```ts
/** Receita bruta = soma dos totais já gravados das linhas de RECEITA; custos não entram no ROL. */
async function gravarTotais(c: Executor, id: number, aliquota: number): Promise<void> {
  const { rows } = await c.query(
    `select coalesce(sum(total), 0)::float8 as bruta from public.ft_flash_semana_item
      where semana_id = $1 and natureza = 'RECEITA'`,
    [id],
  )
  const bruta = Math.round(rows[0].bruta * 100) / 100
  await c.query(
    `update public.ft_flash_semana set receita_bruta=$1, aliquota=$2, receita_liquida=$3, atualizado_em=now() where id=$4`,
    [bruta, aliquota, receitaLiquida(bruta, aliquota), id],
  )
}
```

Remover `receitaBruta` do import de `./calculos` se ficar sem uso.

- [ ] **Step 6: `abrirSemana` — CR e natureza por item**

No ramo de semana nova, trocar `const tipo = new Map(...)` e o `insert` das linhas:

```ts
const porId = new Map(itens.map((i) => [i.id, i]))
// ... dentro do for (const l of linhas):
const it = porId.get(l.itemId)!
await c.query(
  `insert into public.ft_flash_semana_item (semana_id, item_id, cr_cod, natureza, valor_unitario, quantidade, total)
   values ($1,$2,$3,$4,$5,$6,$7)`,
  [id, l.itemId, it.crCod, it.natureza, l.valorUnitario, l.quantidade, valorLinha(it.tipo, l.valorUnitario, l.quantidade)],
)
```

No ramo `RASCUNHO`, o `insert ... on conflict do nothing` passa a ser:

```ts
await c.query(
  `insert into public.ft_flash_semana_item (semana_id, item_id, cr_cod, natureza, valor_unitario, quantidade, total)
   values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing`,
  [s.id, i.id, i.crCod, i.natureza, i.valorUnitario, i.qtdPadrao, valorLinha(i.tipo, i.valorUnitario, i.qtdPadrao)],
)
```

- [ ] **Step 7: Conferir compilação e consumidores**

Run: `npx tsc --noEmit`
Expected: sem erros em `src/lib/flash/*` (erros em `Parametrizacao.tsx`, `GradeLancamento.tsx` e `flash-report/[pec]/page.tsx` são esperados e tratados nas Tasks 5 e 7). Rode `grep -rn "\.conta\b\|contaSugerida\|contasDre" src` e confirme que só sobram esses três arquivos de tela; se `excel.ts` ou o consolidado usarem `conta`, remova o uso.

- [ ] **Step 8: Commit**

```bash
git add src/lib/flash/dados.ts
git commit -m "feat(projecoes): itens com natureza e CR próprio; totais só de receita

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Dados da tela principal (lista de PECs, agrupamento)

**Files:**
- Create: `src/lib/projecoes/agrupar.ts`
- Create: `src/lib/projecoes/visao.ts`
- Test: `src/lib/projecoes/agrupar.test.ts`

**Interfaces:**
- Consumes (Task 1/2): colunas novas; `margemPct` de `@/lib/flash/calculos`; `filtroCr` de `@/lib/flash/sql`; `mesParaData`, `Periodo` de `@/lib/flash/semanas`.
- Produces (`agrupar.ts`, puro):
  - `type DimVisao = "pec" | "cr" | "gerente" | "cliente"`; `DIMENSOES_VISAO: { chave: DimVisao; rotulo: string }[]`; `lerDim(v: unknown): DimVisao` (padrão `"pec"`)
  - `type StatusLinha = "PENDENTE" | "RASCUNHO" | "ENVIADO" | "REABERTO"`
  - `type LinhaPec = { pecCod: string; pecNome: string; crCod: string; gerente: string | null; cliente: string | null; status: StatusLinha; rol: number | null; custos: number | null }`
  - `type Totais = { rol: number; mc: number; margem: number | null; lancados: number; total: number }`
  - `type Grupo = { chave: string; rotulo: string; totais: Totais; pecs: LinhaPec[] }`
  - `mcDe(l: LinhaPec): number | null`, `totalizar(pecs: LinhaPec[]): Totais`, `agruparPecs(pecs: LinhaPec[], dim: DimVisao): Grupo[]`, `filtrarPecs(pecs: LinhaPec[], busca: string): LinhaPec[]`
- Produces (`visao.ts`, server): `listarVisao(escopo: EscopoDados, periodo: Periodo): Promise<LinhaPec[]>`.

- [ ] **Step 1: Escrever os testes que falham** (`src/lib/projecoes/agrupar.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { agruparPecs, filtrarPecs, lerDim, mcDe, totalizar, type LinhaPec } from "./agrupar"

const pec = (p: Partial<LinhaPec> & { pecCod: string }): LinhaPec => ({
  pecNome: `PEC ${p.pecCod}`, crCod: "11111", gerente: "ANA", cliente: "SUVINIL", status: "ENVIADO",
  rol: 1000, custos: 200, ...p,
})

describe("mcDe", () => {
  it("MC = ROL − custos", () => expect(mcDe(pec({ pecCod: "1" }))).toBe(800))
  it("sem lançamento não tem MC (não é zero)", () => expect(mcDe(pec({ pecCod: "1", status: "PENDENTE", rol: null, custos: null }))).toBeNull())
  it("sem custo lançado, MC = ROL", () => expect(mcDe(pec({ pecCod: "1", custos: null }))).toBe(1000))
})

describe("totalizar", () => {
  it("soma só o que foi lançado e ignora PENDENTE", () => {
    const t = totalizar([
      pec({ pecCod: "1", rol: 1000, custos: 200 }),
      pec({ pecCod: "2", rol: 3000, custos: 1000 }),
      pec({ pecCod: "3", status: "PENDENTE", rol: null, custos: null }),
    ])
    expect(t.rol).toBe(4000)
    expect(t.mc).toBe(2800)
    expect(t.margem).toBeCloseTo(0.7)
    expect(t.lancados).toBe(2)
    expect(t.total).toBe(3)
  })
  it("ROL total zero → margem nula (sem NaN)", () => {
    expect(totalizar([]).margem).toBeNull()
    expect(totalizar([pec({ pecCod: "1", rol: 0, custos: 50 })]).margem).toBeNull()
  })
})

describe("agruparPecs", () => {
  const pecs = [
    pec({ pecCod: "1", gerente: "BETO", crCod: "22222" }),
    pec({ pecCod: "2", gerente: "ANA", crCod: "11111" }),
    pec({ pecCod: "3", gerente: null, crCod: "11111" }),
    pec({ pecCod: "4", gerente: "ANA", crCod: "33333" }),
  ]
  it("por PEC: um grupo por PEC, ordenado por código", () => {
    const g = agruparPecs(pecs, "pec")
    expect(g.map((x) => x.chave)).toEqual(["1", "2", "3", "4"])
    expect(g.every((x) => x.pecs.length === 1)).toBe(true)
  })
  it("por gerente: ordena por nome e manda 'Sem informação' para o fim", () => {
    const g = agruparPecs(pecs, "gerente")
    expect(g.map((x) => x.rotulo)).toEqual(["ANA", "BETO", "Sem informação"])
    expect(g[0].pecs.map((p) => p.pecCod)).toEqual(["2", "4"])
    expect(g[0].totais.rol).toBe(2000)
  })
  it("por CR agrupa pelo código do CR", () => {
    expect(agruparPecs(pecs, "cr").map((x) => x.chave)).toEqual(["11111", "22222", "33333"])
  })
})

describe("filtrarPecs e lerDim", () => {
  const pecs = [pec({ pecCod: "092454", pecNome: "092454 - SUVINIL" }), pec({ pecCod: "555555", gerente: "JOÃO", cliente: "AMYRIS" })]
  it("busca por código, nome, CR, gerente ou cliente, sem acento e sem caixa", () => {
    expect(filtrarPecs(pecs, "suvinil")).toHaveLength(1)
    expect(filtrarPecs(pecs, "joao")[0].pecCod).toBe("555555")
    expect(filtrarPecs(pecs, "amyris")[0].pecCod).toBe("555555")
    expect(filtrarPecs(pecs, "  ")).toHaveLength(2)
  })
  it("lerDim aceita só dimensões conhecidas", () => {
    expect(lerDim("gerente")).toBe("gerente")
    expect(lerDim("conta")).toBe("pec")
    expect(lerDim(undefined)).toBe("pec")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/projecoes/agrupar.test.ts`
Expected: FAIL (módulo `./agrupar` não existe).

- [ ] **Step 3: Implementar `agrupar.ts`**

```ts
import { margemPct } from "@/lib/flash/calculos"

/** Como a lista de PECs pode ser agrupada na tela de Projeções. */
export type DimVisao = "pec" | "cr" | "gerente" | "cliente"
export const DIMENSOES_VISAO: { chave: DimVisao; rotulo: string }[] = [
  { chave: "pec", rotulo: "PEC" },
  { chave: "cr", rotulo: "CR" },
  { chave: "gerente", rotulo: "Gerente" },
  { chave: "cliente", rotulo: "Cliente" },
]

export const lerDim = (v: unknown): DimVisao => (DIMENSOES_VISAO.some((d) => d.chave === v) ? (v as DimVisao) : "pec")

export type StatusLinha = "PENDENTE" | "RASCUNHO" | "ENVIADO" | "REABERTO"
export type LinhaPec = {
  pecCod: string
  pecNome: string
  crCod: string
  gerente: string | null
  cliente: string | null
  status: StatusLinha
  /** ROL projetado na semana; `null` = sem lançamento. */
  rol: number | null
  custos: number | null
}
export type Totais = { rol: number; mc: number; margem: number | null; lancados: number; total: number }
export type Grupo = { chave: string; rotulo: string; totais: Totais; pecs: LinhaPec[] }

const centavos = (v: number) => Math.round(v * 100) / 100
const SEM_INFO = "Sem informação"

/** MC do PEC na semana: ROL − custos lançados. Sem lançamento não tem MC. */
export const mcDe = (l: LinhaPec): number | null => (l.rol == null ? null : centavos(l.rol - (l.custos ?? 0)))

/** Soma só os PECs com lançamento; PENDENTE fica de fora (não conta como zero). */
export function totalizar(pecs: LinhaPec[]): Totais {
  const lancados = pecs.filter((p) => p.rol != null)
  const rol = centavos(lancados.reduce((s, p) => s + (p.rol ?? 0), 0))
  const mc = centavos(lancados.reduce((s, p) => s + (mcDe(p) ?? 0), 0))
  return { rol, mc, margem: margemPct(mc, rol), lancados: lancados.length, total: pecs.length }
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export function filtrarPecs(pecs: LinhaPec[], busca: string): LinhaPec[] {
  const q = semAcento(busca.trim())
  if (!q) return pecs
  return pecs.filter((p) =>
    semAcento([p.pecCod, p.pecNome, p.crCod, p.gerente ?? "", p.cliente ?? ""].join(" ")).includes(q),
  )
}

export function agruparPecs(pecs: LinhaPec[], dim: DimVisao): Grupo[] {
  const chaveDe = (p: LinhaPec): string =>
    dim === "pec" ? p.pecCod : dim === "cr" ? p.crCod : ((dim === "gerente" ? p.gerente : p.cliente) ?? SEM_INFO)
  const mapa = new Map<string, LinhaPec[]>()
  for (const p of pecs) {
    const k = chaveDe(p)
    mapa.set(k, [...(mapa.get(k) ?? []), p])
  }
  return [...mapa.entries()]
    .map(([chave, lista]) => ({
      chave,
      rotulo: dim === "pec" ? lista[0].pecNome : chave,
      totais: totalizar(lista),
      pecs: [...lista].sort((a, b) => a.pecCod.localeCompare(b.pecCod)),
    }))
    .sort((a, b) => {
      if (a.chave === SEM_INFO) return 1
      if (b.chave === SEM_INFO) return -1
      return dim === "pec" ? a.chave.localeCompare(b.chave) : a.rotulo.localeCompare(b.rotulo, "pt-BR")
    })
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run src/lib/projecoes/agrupar.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar `visao.ts`**

```ts
import { inhausPool } from "@/lib/db-inhaus"
import { mesParaData, type Periodo } from "@/lib/flash/semanas"
import { filtroCr } from "@/lib/flash/sql"
import { assertLinhasNoEscopo, type EscopoDados } from "@/lib/seguranca/escopo-dados"

import type { LinhaPec } from "./agrupar"

/**
 * PECs do escopo com ROL e custos da semana escolhida. Server-only.
 * TRAVA 1: `filtroCr` no PEC e em CADA soma de custo (o custo com CR fora do escopo não entra no MC do usuário).
 * TRAVA 2: `assertLinhasNoEscopo` na saída.
 * O cliente vem do registro mais recente do RE x OR do mesmo PEC e CR — a junção herda o filtro do PEC.
 * Regra: ROL vem do Flash (receita líquida); MC = ROL − custos (ver src/lib/flash/calculos.ts).
 */
export async function listarVisao(escopo: EscopoDados, periodo: Periodo): Promise<LinhaPec[]> {
  const fp = filtroCr(escopo, "p.cr_cod", 3)
  const fi = filtroCr(escopo, "si.cr_cod", 3)
  const { rows } = await inhausPool.query(
    `select p.pec_cod, p.pec_nome, p.cr_cod, p.gerente, cli.cliente,
            s.status,
            case when s.id is null then null else s.receita_liquida::float8 end as rol,
            case when s.id is null then null else
              coalesce((select sum(si.total) from public.ft_flash_semana_item si
                         where si.semana_id = s.id and si.natureza = 'CUSTO'${fi.sql}), 0)::float8 end as custos
       from public.dm_flash_pec p
       left join public.ft_flash_semana s
              on s.pec_cod = p.pec_cod and s.cr_cod = p.cr_cod and s.mes = $1::date and s.semana = $2
       left join lateral (
              select f.cliente from public.ft_real_orcado f
               where f.pec_cod = p.pec_cod and f.cr_cod = p.cr_cod
               order by f.competencia desc limit 1) cli on true
      where p.ativo${fp.sql}
      order by p.pec_cod`,
    [mesParaData(periodo.mes), periodo.semana, ...fp.params],
  )
  assertLinhasNoEscopo(rows, (r) => r.cr_cod, escopo)
  return rows.map((r) => ({
    pecCod: r.pec_cod,
    pecNome: r.pec_nome,
    crCod: r.cr_cod,
    gerente: r.gerente,
    cliente: r.cliente,
    status: r.status ?? "PENDENTE",
    rol: r.rol,
    custos: r.custos,
  }))
}
```

- [ ] **Step 6: Conferir compilação e a consulta no banco (somente leitura)**

Run: `npx tsc --noEmit` — sem erros em `src/lib/projecoes/agrupar.ts` e `visao.ts`.
Run:
```bash
python -c "import sys; sys.path.insert(0,'scripts'); import psycopg2; from _banco import url_banco; c=psycopg2.connect(url_banco()); cur=c.cursor(); cur.execute(\"select p.pec_cod, s.status, s.receita_liquida from dm_flash_pec p left join ft_flash_semana s on s.pec_cod=p.pec_cod and s.cr_cod=p.cr_cod and s.mes=date_trunc('month', current_date) limit 5\"); print(cur.fetchall())"
```
Expected: executa sem erro (lista pode estar vazia).

- [ ] **Step 7: Commit**

```bash
git add src/lib/projecoes/agrupar.ts src/lib/projecoes/agrupar.test.ts src/lib/projecoes/visao.ts
git commit -m "feat(projecoes): consulta e agrupamento da lista de PECs (ROL, MC, % margem)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tela de parametrização do PEC

**Files:**
- Move + rewrite: `src/components/flash/Parametrizacao.tsx` → `src/components/projecoes/ParametrizacaoPec.tsx`
- Create: `src/components/projecoes/ParametrizacaoInfo.tsx`
- Create: `src/app/dashboards/financeiro/projecoes/[pec]/page.tsx`

**Interfaces:**
- Consumes: `Item`, `Natureza`, `TipoItem`, `TIPOS`, `TIPOS_POR_NATUREZA`, `valorLinha` (Task 2); `listarItens`, `crsDoEscopo`, `garantirPecNoEscopo`, `ErroFlash` (Task 3); as rotas `POST /api/flash/pecs/[pec]/itens`, `PUT|PATCH /api/flash/pecs/[pec]/itens/[id]` (já existem; aceitam o `itemSchema` novo).
- Produces: `ParametrizacaoPec({ pecCod, crPadrao, itens, crs })` (client); a rota `/dashboards/financeiro/projecoes/[pec]`.

- [ ] **Step 1: Mover o componente preservando o histórico**

```bash
git mv src/components/flash/Parametrizacao.tsx src/components/projecoes/ParametrizacaoPec.tsx
```

- [ ] **Step 2: Reescrever `ParametrizacaoPec.tsx`**

```tsx
"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Plus, Power, X } from "lucide-react"

import { moeda } from "@/components/flash/moeda"
import { Combobox } from "@/components/ui/Combobox"
import { TIPOS, TIPOS_POR_NATUREZA, valorLinha, type Item, type Natureza, type TipoItem } from "@/lib/flash/calculos"
import { formatarNumero } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Parametrização do PEC: itens de RECEITA e de CUSTO, cada um com o seu CR.
 * Cadastro em sequência pelo teclado: Enter no formulário salva e devolve o foco à descrição.
 */

type Cr = { cr: string; nome: string }
type Form = { descricao: string; natureza: Natureza; tipo: TipoItem; valorUnitario: string; qtdPadrao: string; crCod: string; agrupador: string }

const ROTULO_QTD: Record<TipoItem, string> = {
  PESSOAS: "Pessoas", UNITARIO: "Quantidade", HORA_EXTRA: "Horas", DESCONTO: "Quantidade", FIXO: "Quantidade", TAXA: "Quantidade", VARIAVEL: "Quantidade",
}
const ROTULO_VALOR: Record<TipoItem, string> = {
  PESSOAS: "Valor por pessoa/mês", UNITARIO: "Valor unitário", HORA_EXTRA: "Valor da hora", DESCONTO: "Valor do desconto",
  FIXO: "Valor mensal", TAXA: "Valor da taxa", VARIAVEL: "Valor variável",
}
const NATUREZAS: { valor: Natureza; rotulo: string }[] = [
  { valor: "RECEITA", rotulo: "Receita" },
  { valor: "CUSTO", rotulo: "Custo" },
]

const num = (t: string) => Number(t.replace(/\./g, "").replace(",", "."))
const campo =
  "h-10 w-full rounded-xl border border-navy/15 bg-white px-3 text-sm text-navy outline-none transition focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/30"

export function ParametrizacaoPec({ pecCod, crPadrao, itens, crs }: { pecCod: string; crPadrao: string; itens: Item[]; crs: Cr[] }) {
  const router = useRouter()
  const vazio: Form = { descricao: "", natureza: "RECEITA", tipo: "PESSOAS", valorUnitario: "", qtdPadrao: "", crCod: crPadrao, agrupador: "" }
  const [form, setForm] = useState<Form>(vazio)
  const [editando, setEditando] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const descricaoRef = useRef<HTMLInputElement>(null)

  const opcoesCr = useMemo(() => crs.map((c) => ({ value: c.cr, label: `${c.cr} · ${c.nome}` })), [crs])
  const nomeCr = useMemo(() => new Map(crs.map((c) => [c.cr, c.nome])), [crs])
  const agrupadores = useMemo(() => [...new Set(itens.map((i) => i.agrupador).filter(Boolean))] as string[], [itens])
  const base = `/api/flash/pecs/${pecCod}/itens`

  function trocarNatureza(natureza: Natureza) {
    setForm((f) => ({ ...f, natureza, tipo: TIPOS_POR_NATUREZA[natureza].includes(f.tipo) ? f.tipo : TIPOS_POR_NATUREZA[natureza][0] }))
  }

  function editar(i: Item) {
    setEditando(i.id)
    setErro(null)
    setForm({
      descricao: i.descricao,
      natureza: i.natureza,
      tipo: i.tipo,
      valorUnitario: formatarNumero(i.valorUnitario, 2).replace(/\./g, ""),
      qtdPadrao: formatarNumero(i.qtdPadrao, Number.isInteger(i.qtdPadrao) ? 0 : 2).replace(/\./g, ""),
      crCod: i.crCod,
      agrupador: i.agrupador ?? "",
    })
    descricaoRef.current?.focus()
  }

  function cancelar() {
    setEditando(null)
    setForm(vazio)
    setErro(null)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    const ordemAtual = editando ? itens.find((i) => i.id === editando)?.ordem ?? 0 : itens.length
    setSalvando(true)
    const r = await fetch(editando ? `${base}/${editando}` : base, {
      method: editando ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: form.descricao,
        natureza: form.natureza,
        tipo: form.tipo,
        valorUnitario: num(form.valorUnitario || "x"),
        qtdPadrao: form.tipo === "FIXO" && !form.qtdPadrao ? 1 : num(form.qtdPadrao || "0"),
        crCod: form.crCod,
        agrupador: form.agrupador || null,
        ordem: ordemAtual,
      }),
    })
    setSalvando(false)
    if (!r.ok) return setErro((await r.json()).error ?? "Falha ao salvar.")
    setEditando(null)
    setForm((f) => ({ ...vazio, natureza: f.natureza, tipo: f.tipo, crCod: f.crCod, agrupador: f.agrupador }))
    router.refresh()
    descricaoRef.current?.focus()
  }

  async function alternarAtivo(i: Item) {
    if (i.ativo && !confirm("O item sai das próximas semanas; semanas já enviadas não mudam. Desativar?")) return
    const r = await fetch(`${base}/${i.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !i.ativo }),
    })
    if (!r.ok) return setErro((await r.json()).error ?? "Falha ao atualizar.")
    router.refresh()
  }

  const secoes: { natureza: Natureza; titulo: string; vazioTxt: string }[] = [
    { natureza: "RECEITA", titulo: "Receitas", vazioTxt: "Nenhuma receita cadastrada. Comece pelas funções do contrato (tarifa × pessoas)." },
    { natureza: "CUSTO", titulo: "Custos", vazioTxt: "Nenhum custo cadastrado. Inclua hora extra, taxas e variáveis do contrato." },
  ]

  return (
    <div className="space-y-5">
      <form onSubmit={salvar} className="glass space-y-4 rounded-3xl p-5" aria-labelledby="titulo-form-item">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-form-item" className="font-display text-base font-semibold text-navy">
            {editando ? "Editar item" : "Novo item"}
          </h2>
          {editando && (
            <button type="button" onClick={cancelar} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
              <X className="h-4 w-4" aria-hidden /> Cancelar edição
            </button>
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">O que é</legend>
          <div role="radiogroup" className="inline-flex rounded-2xl border border-navy/10 bg-white/70 p-1">
            {NATUREZAS.map((n) => (
              <button
                key={n.valor}
                type="button"
                role="radio"
                aria-checked={form.natureza === n.valor}
                onClick={() => trocarNatureza(n.valor)}
                className={cn(
                  "rounded-xl px-4 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
                  form.natureza === n.valor ? "bg-inhaus-grad text-white shadow-glow" : "text-navy hover:bg-navy-mist",
                )}
              >
                {n.rotulo}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">Como é {form.natureza === "CUSTO" ? "lançado" : "cobrado"}</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {TIPOS_POR_NATUREZA[form.natureza].map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={form.tipo === t}
                onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
                  form.tipo === t ? "border-transparent bg-inhaus-grad text-white shadow-glow" : "border-navy/15 bg-white/70 text-navy hover:border-teal/40",
                )}
              >
                {TIPOS[t].rotulo}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 md:grid-cols-12">
          <label className="md:col-span-4">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Descrição</span>
            <input
              ref={descricaoRef}
              required
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder={form.natureza === "CUSTO" ? "Ex.: Hora extra 50% — separação" : form.tipo === "PESSOAS" ? "Ex.: Separador 1º turno" : "Ex.: Locação de caminhão"}
              className={campo}
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{ROTULO_VALOR[form.tipo]} (R$)</span>
            <input required inputMode="decimal" value={form.valorUnitario} onChange={(e) => setForm({ ...form, valorUnitario: e.target.value })} placeholder="0,00" className={cn(campo, "text-right tabular-nums")} />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{ROTULO_QTD[form.tipo]} padrão</span>
            <input inputMode="decimal" value={form.qtdPadrao} onChange={(e) => setForm({ ...form, qtdPadrao: e.target.value })} placeholder={form.tipo === "FIXO" ? "1" : "0"} className={cn(campo, "text-right tabular-nums")} />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Área (opcional)</span>
            <input list="agrupadores-pec" value={form.agrupador} onChange={(e) => setForm({ ...form, agrupador: e.target.value })} placeholder="Ex.: A220" className={campo} />
            <datalist id="agrupadores-pec">
              {agrupadores.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
          <div className="flex items-end md:col-span-2">
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-inhaus-grad px-4 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              {editando ? "Salvar" : "Adicionar"}
            </button>
          </div>
          <div className="md:col-span-6">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">CR do item</span>
            <Combobox
              value={form.crCod}
              onChange={(v) => setForm((f) => ({ ...f, crCod: v ?? f.crCod }))}
              options={opcoesCr}
              placeholder="Busque pelo código ou nome do CR"
              ariaLabel="CR do item"
            />
          </div>
        </div>
        {erro && (
          <p role="alert" className="text-sm text-red-700">
            {erro}
          </p>
        )}
      </form>

      {secoes.map((s) => {
        const lista = itens.filter((i) => i.natureza === s.natureza)
        return (
          <section key={s.natureza} aria-labelledby={`secao-${s.natureza}`} className="space-y-2">
            <h2 id={`secao-${s.natureza}`} className="font-display text-base font-semibold text-navy">
              {s.titulo} <span className="text-sm font-normal text-muted-foreground">({lista.filter((i) => i.ativo).length})</span>
            </h2>
            {lista.length === 0 ? (
              <p className="glass rounded-3xl p-6 text-center text-sm text-muted-foreground">{s.vazioTxt}</p>
            ) : (
              <div className="glass overflow-x-auto rounded-3xl">
                <table className="w-full text-sm">
                  <caption className="sr-only">Itens de {s.titulo.toLowerCase()} do PEC</caption>
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th scope="col" className="px-5 py-3 font-medium">Item</th>
                      <th scope="col" className="px-3 py-3 font-medium">Tipo</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Valor unit.</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Qtd. padrão</th>
                      <th scope="col" className="px-3 py-3 text-right font-medium">Mês (padrão)</th>
                      <th scope="col" className="px-3 py-3 font-medium">CR</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((i) => (
                      <tr key={i.id} className={cn("border-t border-navy/5", !i.ativo && "opacity-50", editando === i.id && "bg-teal-tint/60")}>
                        <th scope="row" className="px-5 py-2.5 text-left font-normal text-navy">
                          {i.descricao}
                          {i.agrupador && <span className="ml-2 text-xs text-muted-foreground">{i.agrupador}</span>}
                          {!i.ativo && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}
                        </th>
                        <td className="px-3 py-2.5 text-muted-foreground">{TIPOS[i.tipo].rotulo}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatarNumero(i.valorUnitario, 2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatarNumero(i.qtdPadrao, Number.isInteger(i.qtdPadrao) ? 0 : 2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-navy">{moeda(valorLinha(i.tipo, i.valorUnitario, i.qtdPadrao), 2)}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground" title={nomeCr.get(i.crCod)}>
                          {i.crCod}
                          {nomeCr.get(i.crCod) ? ` · ${nomeCr.get(i.crCod)}` : ""}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-right">
                          <button type="button" onClick={() => editar(i)} aria-label={`Editar ${i.descricao}`} className="rounded-lg p-1.5 text-navy hover:bg-navy-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => alternarAtivo(i)}
                            aria-label={`${i.ativo ? "Desativar" : "Reativar"} ${i.descricao}`}
                            className={cn("rounded-lg p-1.5 hover:bg-navy-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal", i.ativo ? "text-red-700" : "text-teal")}
                          >
                            <Power className="h-4 w-4" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
```

Antes de salvar, confira a assinatura real de `Combobox` (`src/components/ui/Combobox.tsx`): se `onChange` receber só `string`, o `v ?? f.crCod` continua válido; se as props tiverem outro nome, ajuste apenas a chamada.

- [ ] **Step 3: Criar o texto do info** (`src/components/projecoes/ParametrizacaoInfo.tsx`)

```tsx
import { InfoIndicador } from "@/components/dashboard/InfoIndicador"

/** Regras da parametrização do PEC em linguagem de negócio. Sincronizar com src/lib/flash/calculos.ts. */
export function ParametrizacaoInfo() {
  return (
    <InfoIndicador titulo="Como parametrizar o contrato">
      <div className="space-y-3 text-sm">
        <p>Aqui você cadastra <strong>uma vez só</strong> o que compõe o contrato. Toda semana, na projeção, você só ajusta as quantidades.</p>
        <ul className="list-disc space-y-1 pl-4">
          <li><strong>Receita:</strong> o que é cobrado do cliente (funções, hora extra cobrada, locações, descontos). Forma a <strong>receita bruta</strong>.</li>
          <li><strong>Custo:</strong> o que o contrato gasta (hora extra, taxas, variáveis). Sai da <strong>margem de contribuição (MC)</strong>.</li>
          <li><strong>Cada item</strong> = valor unitário × quantidade. Ex.: hora extra R$ 40,00 × 120 horas = <strong>R$ 4.800,00</strong> de custo.</li>
          <li><strong>CR do item:</strong> a qual centro de resultado o custo pertence. Por padrão é o CR do contrato; você pode escolher outro.</li>
          <li><strong>Margem:</strong> receita líquida − custos = MC. Ex.: R$ 100.000 líquidos − R$ 4.800 = <strong>R$ 95.200</strong>.</li>
          <li>Mudou um valor? Vale <strong>da semana atual em diante</strong>; semanas já enviadas não mudam.</li>
          <li>Desativar um item o tira das próximas semanas, sem apagar o histórico.</li>
        </ul>
        <p className="text-xs text-muted-foreground">Impostos e benefícios entram numa próxima etapa.</p>
      </div>
    </InfoIndicador>
  )
}
```

- [ ] **Step 4: Criar a página** (`src/app/dashboards/financeiro/projecoes/[pec]/page.tsx`)

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarCheck } from "lucide-react"

import { moeda, nomeDoPec } from "@/components/flash/moeda"
import { ParametrizacaoInfo } from "@/components/projecoes/ParametrizacaoInfo"
import { ParametrizacaoPec } from "@/components/projecoes/ParametrizacaoPec"
import { assertTelaVisivel } from "@/lib/dashboard-acesso"
import { escopoDaPagina, TELA_FLASH } from "@/lib/flash/acesso"
import { crsDoEscopo, ErroFlash, garantirPecNoEscopo, listarItens } from "@/lib/flash/dados"
import { tituloNome } from "@/lib/nomes"

export const metadata: Metadata = { title: "Projeções · Parametrização do PEC" }
export const dynamic = "force-dynamic"

export default async function ParametrizacaoPecPage({
  params,
  searchParams,
}: {
  params: { pec: string }
  searchParams: Record<string, string | string[] | undefined>
}) {
  await assertTelaVisivel(TELA_FLASH)
  const escopo = await escopoDaPagina()

  let pec
  try {
    pec = await garantirPecNoEscopo(escopo, params.pec)
  } catch (e) {
    if (e instanceof ErroFlash && e.status === 404) notFound()
    throw e
  }
  const [itens, crs] = await Promise.all([listarItens(escopo, pec.pecCod), crsDoEscopo(escopo)])

  const mes = typeof searchParams.mes === "string" ? searchParams.mes : null
  const semana = typeof searchParams.semana === "string" ? searchParams.semana : null
  const voltar = `/dashboards/financeiro/projecoes${mes && semana ? `?mes=${encodeURIComponent(mes)}&semana=${encodeURIComponent(semana)}` : ""}`
  const lancar = `/dashboards/financeiro/flash-report/${pec.pecCod}${mes && semana ? `?mes=${encodeURIComponent(mes)}&semana=${encodeURIComponent(semana)}` : ""}`
  const ativos = itens.filter((i) => i.ativo)
  const receitaMes = ativos.filter((i) => i.natureza === "RECEITA").reduce((s, i) => s + (i.tipo === "DESCONTO" ? -1 : 1) * i.valorUnitario * i.qtdPadrao, 0)
  const custoMes = ativos.filter((i) => i.natureza === "CUSTO").reduce((s, i) => s + i.valorUnitario * i.qtdPadrao, 0)

  return (
    <div className="space-y-6">
      <section className="reveal">
        <nav aria-label="Caminho" className="text-xs text-muted-foreground">
          <Link href={voltar} className="hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
            Projeções
          </Link>{" "}
          › PEC {pec.pecCod}
        </nav>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-navy">{tituloNome(nomeDoPec(pec.pecNome))}</h1>
          <ParametrizacaoInfo />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          PEC {pec.pecCod} · CR padrão {pec.crCod}
        </p>
      </section>

      <section className="reveal delay-1 grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Resumo do cadastro">
        <div className="glass rounded-3xl p-4">
          <p className="text-xs text-muted-foreground">Itens ativos</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-navy">{ativos.length}</p>
        </div>
        <div className="glass rounded-3xl p-4">
          <p className="text-xs text-muted-foreground">Receita padrão do mês</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-navy">{moeda(receitaMes)}</p>
        </div>
        <div className="glass col-span-2 rounded-3xl p-4 lg:col-span-1">
          <p className="text-xs text-muted-foreground">Custo padrão do mês</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-navy">{moeda(custoMes)}</p>
        </div>
      </section>

      <div className="flex justify-end">
        <Link
          href={lancar}
          className="inline-flex items-center gap-2 rounded-xl border border-navy/10 bg-white/70 px-4 py-2 text-sm font-medium text-navy transition hover:-translate-y-0.5 hover:border-teal/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <CalendarCheck className="h-4 w-4 text-teal" aria-hidden /> Lançar a semana
        </Link>
      </div>

      <ParametrizacaoPec pecCod={pec.pecCod} crPadrao={pec.crCod} itens={itens} crs={crs} />
    </div>
  )
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros nos arquivos desta tarefa. (Erros restantes só em `flash-report/[pec]/page.tsx` e `GradeLancamento.tsx`, da Task 7.)

- [ ] **Step 6: Commit**

```bash
git add src/components/projecoes/ParametrizacaoPec.tsx src/components/projecoes/ParametrizacaoInfo.tsx "src/app/dashboards/financeiro/projecoes/[pec]/page.tsx"
git commit -m "feat(projecoes): tela de parametrização do PEC (receitas, custos e CR por item)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Tela principal de Projeções e menu

**Files:**
- Move: `src/app/dashboards/financeiro/projecoes/page.tsx` → `src/app/dashboards/financeiro/projecoes/re-x-or/page.tsx` (sem alterar o conteúdo)
- Create: `src/app/dashboards/financeiro/projecoes/page.tsx` (nova)
- Create: `src/components/projecoes/SeletorPeriodo.tsx`, `src/components/projecoes/ListaPecs.tsx`, `src/components/projecoes/ProjecoesVisaoInfo.tsx`
- Modify: `src/lib/domains.ts` (entrada `projecoes-analise`, ~linha 231)

**Interfaces:**
- Consumes: `listarVisao` (Task 4); `agruparPecs`, `filtrarPecs`, `totalizar`, `lerDim`, `mcDe`, `DIMENSOES_VISAO`, `Grupo`, `DimVisao` (Task 4); `moeda`, `nomeDoPec`, `percentual` (`@/components/flash/moeda`); `SeloStatus`; `periodoSchema`, `semanaDoMes`, `semanasDoMes`, `rotuloPeriodo`, `Periodo`; `TELA_PROJECOES`, `escopoDaPagina` de `@/lib/projecoes/acesso`.
- Produces: rota `/dashboards/financeiro/projecoes` (nova) e `/dashboards/financeiro/projecoes/re-x-or` (antiga, fora do menu).

- [ ] **Step 1: Mover a tela antiga (escondida)**

```bash
mkdir -p src/app/dashboards/financeiro/projecoes/re-x-or
git mv src/app/dashboards/financeiro/projecoes/page.tsx src/app/dashboards/financeiro/projecoes/re-x-or/page.tsx
```
Não mude nada dentro do arquivo movido (os imports são por alias `@/`). O título `RE x OR` da página antiga permanece.

- [ ] **Step 2: Texto do info** (`src/components/projecoes/ProjecoesVisaoInfo.tsx`)

```tsx
import { InfoIndicador } from "@/components/dashboard/InfoIndicador"

/** Regras da tela de Projeções em linguagem de negócio. Sincronizar com o topo de src/lib/flash/calculos.ts. */
export function ProjecoesVisaoInfo() {
  return (
    <InfoIndicador titulo="Como ler as projeções">
      <div className="space-y-3 text-sm">
        <p>Cada linha é um <strong>contrato (PEC)</strong> com a projeção da <strong>semana escolhida</strong>. Cada semana projeta o fechamento do <strong>mês inteiro</strong>.</p>
        <ul className="list-disc space-y-1 pl-4">
          <li><strong>ROL</strong> (receita líquida) = receita bruta projetada − impostos, pelo % médio que o contrato pagou nos últimos 3 meses.</li>
          <li><strong>MC</strong> (margem de contribuição) = ROL − custos do contrato (hora extra, taxas e variáveis lançados na semana).</li>
          <li><strong>% Margem</strong> = MC ÷ ROL.</li>
          <li>Contrato <strong>sem lançamento</strong> na semana aparece com traço (—) e <strong>não entra</strong> nos totais.</li>
          <li><strong>Agrupar por</strong> junta os contratos por CR, gerente ou cliente e soma os números de cada grupo.</li>
          <li>Clique num contrato para <strong>parametrizar</strong>: receitas, custos e o CR de cada custo.</li>
        </ul>
        <p className="rounded-xl bg-navy-mist p-3">
          <strong>Exemplo:</strong> ROL R$ 900.000 e custos R$ 120.000 → <strong>MC R$ 780.000</strong>. Margem = 780.000 ÷ 900.000 = <strong>86,7%</strong>.
        </p>
        <p className="text-xs text-muted-foreground">Impostos e benefícios entram numa próxima etapa. Cada pessoa vê apenas os CRs da própria carteira.</p>
      </div>
    </InfoIndicador>
  )
}
```

- [ ] **Step 3: Seletor de período** (`src/components/projecoes/SeletorPeriodo.tsx`, Server Component)

```tsx
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { semanasDoMes, type Periodo } from "@/lib/flash/semanas"
import { cn } from "@/lib/utils"

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

function mesVizinho(mes: string, passo: number): string {
  const [a, m] = mes.split("-").map(Number)
  const d = new Date(Date.UTC(a, m - 1 + passo, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Navegação de mês e semana por links (estado na URL). `href` monta a URL preservando os demais filtros. */
export function SeletorPeriodo({ periodo, href }: { periodo: Periodo; href: (p: Periodo) => string }) {
  const [ano, mesNum] = periodo.mes.split("-").map(Number)
  const seta = "rounded-lg p-1.5 text-navy hover:bg-navy-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Período">
      <div className="flex items-center gap-1">
        <Link href={href({ mes: mesVizinho(periodo.mes, -1), semana: 1 })} aria-label="Mês anterior" className={seta}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Link>
        <span className="min-w-[8.5rem] text-center font-display text-sm font-semibold text-navy">
          {MESES[mesNum - 1]} {ano}
        </span>
        <Link href={href({ mes: mesVizinho(periodo.mes, 1), semana: 1 })} aria-label="Próximo mês" className={seta}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className="flex rounded-2xl border border-navy/10 bg-white/70 p-1">
        {semanasDoMes(periodo.mes).map((n) => {
          const ativa = n === periodo.semana
          return (
            <Link
              key={n}
              href={href({ mes: periodo.mes, semana: n })}
              aria-current={ativa ? "page" : undefined}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
                ativa ? "bg-inhaus-grad text-white shadow-glow" : "text-navy hover:bg-navy-mist",
              )}
            >
              Sem {n}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Lista de PECs** (`src/components/projecoes/ListaPecs.tsx`, Server Component)

```tsx
import Link from "next/link"

import { moeda, nomeDoPec, percentual } from "@/components/flash/moeda"
import { SeloStatus } from "@/components/flash/SeloStatus"
import type { Periodo } from "@/lib/flash/semanas"
import { mcDe, type DimVisao, type Grupo, type LinhaPec, type Totais } from "@/lib/projecoes/agrupar"
import { tituloNome } from "@/lib/nomes"
import { cn } from "@/lib/utils"

const num = "px-4 py-3 text-right tabular-nums"
const corMc = (v: number | null) => (v == null ? "text-muted-foreground" : v < 0 ? "text-red-700" : "text-navy")

function Celulas({ rol, mc, margem }: { rol: number | null; mc: number | null; margem: number | null }) {
  return (
    <>
      <td className={cn(num, "text-navy")}>{rol == null ? "—" : moeda(rol)}</td>
      <td className={cn(num, corMc(mc))}>{mc == null ? "—" : moeda(mc)}</td>
      <td className={cn(num, corMc(mc))}>{percentual(margem)}</td>
    </>
  )
}

function LinhaDoPec({ p, periodo }: { p: LinhaPec; periodo: Periodo }) {
  const mc = mcDe(p)
  const margem = p.rol != null && p.rol !== 0 && mc != null ? mc / p.rol : null
  return (
    <tr className="relative border-t border-navy/5 transition hover:bg-teal-tint/50 focus-within:bg-teal-tint/50">
      <th scope="row" className="px-4 py-3 text-left font-normal">
        <Link
          href={`/dashboards/financeiro/projecoes/${p.pecCod}?mes=${periodo.mes}&semana=${periodo.semana}`}
          className="block font-medium text-navy after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-teal"
        >
          {tituloNome(nomeDoPec(p.pecNome))}
        </Link>
        <span className="text-xs text-muted-foreground">
          PEC {p.pecCod} · CR {p.crCod}
          {p.gerente ? ` · ${tituloNome(p.gerente)}` : ""}
        </span>
      </th>
      <td className="px-4 py-3">
        <SeloStatus status={p.status} />
      </td>
      <Celulas rol={p.rol} mc={mc} margem={margem} />
    </tr>
  )
}

function CabecalhoDoGrupo({ g }: { g: Grupo }) {
  const t: Totais = g.totais
  return (
    <tr className="bg-navy-mist/70">
      <th scope="rowgroup" colSpan={2} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-navy">
        {g.rotulo} <span className="font-normal normal-case tracking-normal text-muted-foreground">({t.lancados}/{t.total} lançados)</span>
      </th>
      <Celulas rol={t.lancados ? t.rol : null} mc={t.lancados ? t.mc : null} margem={t.margem} />
    </tr>
  )
}

/** Lista de PECs (uma linha por PEC) ou de grupos com os PECs dentro. Clique na linha → parametrização. */
export function ListaPecs({ grupos, dim, periodo }: { grupos: Grupo[]; dim: DimVisao; periodo: Periodo }) {
  return (
    <div className="glass overflow-x-auto rounded-3xl">
      <table className="w-full text-sm">
        <caption className="sr-only">Projeção por contrato: ROL, MC e % Margem</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-3 font-medium">Contrato</th>
            <th scope="col" className="px-4 py-3 font-medium">Situação</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">ROL</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">MC</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">% Margem</th>
          </tr>
        </thead>
        {grupos.map((g) => (
          <tbody key={g.chave}>
            {dim !== "pec" && <CabecalhoDoGrupo g={g} />}
            {g.pecs.map((p) => (
              <LinhaDoPec key={p.pecCod} p={p} periodo={periodo} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
```

Confira em `src/components/flash/SeloStatus.tsx` o tipo aceito em `status` (`"PENDENTE" | StatusSemana`); `LinhaPec.status` é o mesmo conjunto.

- [ ] **Step 5: Nova página** (`src/app/dashboards/financeiro/projecoes/page.tsx`)

```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { AlertTriangle, Search } from "lucide-react"

import { moeda, percentual } from "@/components/flash/moeda"
import { ListaPecs } from "@/components/projecoes/ListaPecs"
import { ProjecoesVisaoInfo } from "@/components/projecoes/ProjecoesVisaoInfo"
import { SeletorPeriodo } from "@/components/projecoes/SeletorPeriodo"
import { assertTelaVisivel } from "@/lib/dashboard-acesso"
import { rotuloPeriodo, semanaDoMes, type Periodo } from "@/lib/flash/semanas"
import { periodoSchema } from "@/lib/flash/validacao"
import { agruparPecs, DIMENSOES_VISAO, filtrarPecs, lerDim, totalizar, type LinhaPec } from "@/lib/projecoes/agrupar"
import { escopoDaPagina, TELA_PROJECOES } from "@/lib/projecoes/acesso"
import { listarVisao } from "@/lib/projecoes/visao"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Projeções" }
export const dynamic = "force-dynamic"

export default async function ProjecoesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await assertTelaVisivel(TELA_PROJECOES)
  const escopo = await escopoDaPagina()
  const lido = periodoSchema.safeParse({ mes: searchParams.mes, semana: searchParams.semana })
  const periodo: Periodo = lido.success ? lido.data : semanaDoMes(new Date())
  const dim = lerDim(searchParams.agrupar)
  const busca = typeof searchParams.q === "string" ? searchParams.q : ""

  let pecs: LinhaPec[] = []
  let erro: string | null = null
  try {
    pecs = await listarVisao(escopo, periodo)
  } catch (e) {
    erro = e instanceof Error ? e.message : "Falha ao carregar os contratos."
  }
  const visiveis = filtrarPecs(pecs, busca)
  const totais = totalizar(visiveis)
  const grupos = agruparPecs(visiveis, dim)

  const href = (p: Periodo, d = dim, q = busca) => {
    const u = new URLSearchParams({ mes: p.mes, semana: String(p.semana), agrupar: d })
    if (q) u.set("q", q)
    return `/dashboards/financeiro/projecoes?${u.toString()}`
  }

  const cards = [
    { rotulo: "ROL", valor: totais.lancados ? moeda(totais.rol) : "—", destaque: true, nota: "Receita líquida projetada" },
    { rotulo: "MC", valor: totais.lancados ? moeda(totais.mc) : "—", nota: "ROL menos os custos", negativo: totais.mc < 0 },
    { rotulo: "% Margem", valor: percentual(totais.margem), nota: "MC ÷ ROL", negativo: totais.mc < 0 },
  ]

  return (
    <div className="space-y-6">
      <section className="reveal">
        <span className="eyebrow">Financeiro</span>
        <div className="mt-3 flex items-center gap-2.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-navy">Projeções</h1>
          <ProjecoesVisaoInfo />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {rotuloPeriodo(periodo)}
          {pecs.length > 0 && <> · {totais.lancados} de {totais.total} contratos com lançamento</>}
        </p>
      </section>

      <section className="reveal delay-1 flex flex-wrap items-center justify-between gap-4" aria-label="Filtros">
        <SeletorPeriodo periodo={periodo} href={(p) => href(p)} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2" role="group" aria-label="Agrupar por">
            <span className="text-xs text-muted-foreground">Agrupar por</span>
            <div className="flex rounded-2xl border border-navy/10 bg-white/70 p-1">
              {DIMENSOES_VISAO.map((d) => (
                <Link
                  key={d.chave}
                  href={href(periodo, d.chave)}
                  aria-current={d.chave === dim ? "page" : undefined}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
                    d.chave === dim ? "bg-inhaus-grad text-white shadow-glow" : "text-navy hover:bg-navy-mist",
                  )}
                >
                  {d.rotulo}
                </Link>
              ))}
            </div>
          </div>
          <form method="get" role="search" className="relative">
            <input type="hidden" name="mes" value={periodo.mes} />
            <input type="hidden" name="semana" value={periodo.semana} />
            <input type="hidden" name="agrupar" value={dim} />
            <label htmlFor="busca-pec" className="sr-only">Buscar contrato</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="busca-pec"
              name="q"
              defaultValue={busca}
              placeholder="Buscar PEC, CR, gerente ou cliente"
              className="h-10 w-72 rounded-xl border border-navy/15 bg-white pl-9 pr-3 text-sm text-navy outline-none transition focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/30"
            />
          </form>
        </div>
      </section>

      {erro && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {erro}
        </div>
      )}

      {!erro && pecs.length > 0 && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Totais do recorte">
          {cards.map((c, i) => (
            <div key={c.rotulo} className={cn("reveal rounded-3xl p-5", `delay-${i + 1}`, c.destaque ? "bg-inhaus-grad text-white shadow-glow" : "glass")}>
              <p className={cn("text-xs", c.destaque ? "text-white/75" : "text-muted-foreground")}>{c.rotulo}</p>
              <p className={cn("mt-1 font-display text-2xl font-semibold tabular-nums", c.destaque ? "text-white" : c.negativo ? "text-red-700" : "text-navy")}>{c.valor}</p>
              <p className={cn("mt-0.5 text-xs", c.destaque ? "text-white/70" : "text-muted-foreground")}>{c.nota}</p>
            </div>
          ))}
        </section>
      )}

      {!erro && pecs.length === 0 && (
        <div className="glass rounded-3xl p-8 text-center">
          <p className="font-display text-lg font-semibold text-navy">Nenhum contrato parametrizado ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Habilite um PEC no Flash Report para começar a projetar.</p>
          <Link href="/dashboards/financeiro/flash-report" className="mt-4 inline-flex h-10 items-center rounded-xl bg-inhaus-grad px-5 text-sm font-semibold text-white shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2">
            Ir para o Flash Report
          </Link>
        </div>
      )}

      {!erro && pecs.length > 0 && visiveis.length === 0 && (
        <p className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">Nenhum contrato encontrado para “{busca}”.</p>
      )}

      {!erro && visiveis.length > 0 && <ListaPecs grupos={grupos} dim={dim} periodo={periodo} />}
    </div>
  )
}
```

- [ ] **Step 6: Menu (`src/lib/domains.ts`)**

Trocar a entrada `projecoes-analise` por:

```ts
      {
        key: "projecoes-analise",
        label: "Projeções",
        href: "/dashboards/financeiro/projecoes",
        palavrasChave: ["projecao", "projeção", "pec", "contrato", "rol", "mc", "margem", "parametrizacao", "parametrização"],
        icone: BarChart3,
      },
```
(A chave é mantida: as permissões já concedidas continuam valendo. A RE x OR não tem mais entrada de menu.)

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit`
Expected: sem erros nos arquivos desta tarefa.
Run: `grep -rn "financeiro/projecoes" src --include=*.tsx --include=*.ts`
Expected: só `domains.ts`, a nova página, os links de `ListaPecs`/`[pec]` e as rotas `re-x-or`/API. Nenhum link do app aponta para a RE x OR antiga.

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboards/financeiro/projecoes src/components/projecoes/SeletorPeriodo.tsx src/components/projecoes/ListaPecs.tsx src/components/projecoes/ProjecoesVisaoInfo.tsx src/lib/domains.ts
git commit -m "feat(projecoes): nova tela de Projeções (ROL, MC, % margem por PEC); RE x OR sai do menu

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Grade do Flash com custos + aba do Flash leva à nova parametrização

**Files:**
- Modify: `src/components/flash/GradeLancamento.tsx`
- Modify: `src/components/flash/FlashInfo.tsx`
- Modify: `src/app/dashboards/financeiro/flash-report/[pec]/page.tsx`

**Interfaces:**
- Consumes: `resumoSemana`, `TIPOS`, `valorLinha`, `Item` (Task 2); `percentual` (Task 2); `SemanaCompleta` (Task 3).
- Produces: grade com grupos de custo; cartões de ROL/Custos/MC no topo; `aba=parametrizacao` redireciona para `/dashboards/financeiro/projecoes/[pec]`.

- [ ] **Step 1: `GradeLancamento.tsx` — agrupar por natureza e usar `resumoSemana`**

1. Trocar o import de cálculos: `import { TIPOS, alteracoes, resumoSemana, valorLinha, type Item } from "@/lib/flash/calculos"` e acrescentar `import { moeda, percentual } from "@/components/flash/moeda"` (substitui o import atual de `moeda`).
2. Em `agrupar`, incluir a natureza na chave e no título, com receitas antes de custos:

```ts
function agrupar(itens: Item[]): Grupo[] {
  const grupos = new Map<string, Grupo>()
  for (const i of itens) {
    const chave = `${i.natureza}|${i.tipo}|${i.agrupador ?? ""}`
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave,
        titulo: [i.natureza === "CUSTO" ? "Custo" : null, TIPOS[i.tipo].rotulo, i.agrupador].filter(Boolean).join(" · "),
        itens: [],
      })
    }
    grupos.get(chave)!.itens.push(i)
  }
  return [...grupos.values()].sort((a, b) => Number(a.chave.startsWith("CUSTO")) - Number(b.chave.startsWith("CUSTO")))
}
```
3. Trocar o cálculo do resumo (`const bruta = ...; const liquida = ...`) por:

```ts
const resumo = useMemo(() => resumoSemana(semana.itens, linhas, semana.aliquota), [semana.itens, semana.aliquota, linhas])
const { bruta, rol: liquida, custos, mc, margem } = resumo
```
(Remover os usos antigos de `receitaBruta` e `receitaLiquida`.)
4. Na barra fixa inferior, trocar o bloco de "Receita bruta / Líquida" por quatro números, mantendo as classes já usadas:

```tsx
<p>
  <span className="text-xs text-muted-foreground">Receita bruta </span>
  <span className="font-display text-lg font-semibold tabular-nums text-navy">{moeda(bruta, 2)}</span>
</p>
<p>
  <span className="text-xs text-muted-foreground">ROL </span>
  <span className="font-display text-lg font-semibold tabular-nums text-teal">{moeda(liquida, 2)}</span>
</p>
<p>
  <span className="text-xs text-muted-foreground">Custos </span>
  <span className="font-display text-lg font-semibold tabular-nums text-navy">{moeda(custos, 2)}</span>
</p>
<p>
  <span className="text-xs text-muted-foreground">MC </span>
  <span className={cn("font-display text-lg font-semibold tabular-nums", mc < 0 ? "text-red-700" : "text-navy")}>{moeda(mc, 2)}</span>
  <span className="ml-1 text-xs text-muted-foreground">({percentual(margem)})</span>
</p>
```
5. No diálogo de confirmação, trocar a frase por: `Depois de enviada, a semana fica travada. ROL projetado: <strong>{moeda(liquida, 2)}</strong> · MC: <strong>{moeda(mc, 2)}</strong>.`
6. O subtotal de cada grupo (`valorLinha`) e a coluna "Total" já usam `valorLinha(i.tipo, ...)`; para custos o valor é positivo e o grupo é identificado pelo prefixo "Custo" no título — nada mais a mudar ali.

- [ ] **Step 2: `FlashInfo.tsx` — texto de regras**

Substituir os itens da lista por (mantendo o mesmo componente e estilo):

```tsx
<p>Toda semana você informa quanto o contrato vai <strong>faturar no mês inteiro</strong> e quanto vai <strong>custar</strong>.</p>
<ul className="list-disc space-y-1 pl-4">
  <li><strong>Semana do mês:</strong> dias 1–7 = Semana 1, 8–14 = Semana 2… 29–31 = Semana 5.</li>
  <li><strong>Cada item</strong> = valor unitário × quantidade. Ex.: Separador R$ 6.978,41 × 15 pessoas = <strong>R$ 104.676,15</strong>.</li>
  <li><strong>Descontos</strong> (faltas, glosas) entram <strong>negativos</strong> na receita.</li>
  <li><strong>Receita bruta</strong> = soma dos itens de receita.</li>
  <li><strong>ROL</strong> (receita líquida) = bruta menos impostos, pelo % médio que o contrato pagou nos <strong>últimos 3 meses</strong>. Ex.: R$ 1.000.000 com 11,5% → <strong>R$ 885.000</strong>. Contrato novo usa 14,25%.</li>
  <li><strong>Custos</strong> = hora extra, taxas e variáveis lançados na semana. <strong>MC</strong> = ROL − custos; <strong>% Margem</strong> = MC ÷ ROL. Ex.: R$ 885.000 − R$ 60.000 = <strong>R$ 825.000</strong> (93,2%).</li>
  <li>A semana <strong>começa igual à última enviada</strong>: mude só o que mudou (◆ marca a alteração).</li>
  <li>Depois de <strong>enviada</strong>, a semana trava. Só o financeiro reabre, informando o motivo; a semana reaberta mantém os itens e valores da época — corrige-se só a quantidade.</li>
  <li>Mudou um valor no cadastro? Vale <strong>da semana atual em diante</strong>; semanas enviadas não mudam.</li>
</ul>
```
E atualizar o comentário do topo do componente para citar também `ProjecoesVisaoInfo`.

- [ ] **Step 3: `flash-report/[pec]/page.tsx`**

1. Imports: remover `Parametrizacao`, `contasDre`, `Settings2` só se ficarem sem uso (o estado vazio continua usando `Settings2`); acrescentar `redirect` de `next/navigation`, `percentual` de `@/components/flash/moeda`, `resumoSemana` de `@/lib/flash/calculos`.
2. Logo após o `assertTelaVisivel` e o cálculo de `periodo`, redirecionar a aba antiga:

```ts
if (searchParams.aba === "parametrizacao") {
  redirect(`/dashboards/financeiro/projecoes/${params.pec}?mes=${periodo.mes}&semana=${periodo.semana}`)
}
```
3. Remover a variável `aba` e `contas`; a linha do `abrirSemana` passa a ser:

```ts
const itens = await listarItens(escopo, pec.pecCod)
if (itens.some((i) => i.ativo)) { try { semana = await abrirSemana(escopo, pec.pecCod, periodo) } catch (e) { erro = e instanceof Error ? e.message : "Falha ao abrir a semana." } }
```
(mantendo o `let semana`/`let erro` existentes). O `link` passa a ser `(p: Periodo) => \`${base}?mes=${p.mes}&semana=${p.semana}\``.
4. Cartões do topo: trocar o array por seis cartões, `grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6`:

```tsx
const r = semana ? resumoSemana(semana.itens, semana.linhas, semana.aliquota) : null
// ...
[
  { rotulo: "Receita bruta", valor: moeda(r.bruta), destaque: false },
  { rotulo: "ROL", valor: moeda(r.rol), destaque: true, nota: `Impostos ${(semana.aliquota * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` },
  { rotulo: "Custos", valor: moeda(r.custos) },
  { rotulo: "MC", valor: moeda(r.mc), cor: r.mc < 0 ? "text-red-700" : "", nota: `Margem ${percentual(r.margem)}` },
  { rotulo: "Vs. semana anterior", valor: variacao == null ? "—" : variacaoMoeda(variacao), cor: variacao == null ? "" : variacao >= 0 ? "text-emerald-700" : "text-red-700", nota: variacao == null ? "Sem semana enviada antes" : "ROL" },
  { rotulo: semana.realizadoUltimoMes ? `Realizado ${semana.realizadoUltimoMes.mes.split("-").reverse().join("/")}` : "Realizado", valor: semana.realizadoUltimoMes ? moeda(semana.realizadoUltimoMes.rol) : "—", nota: "ROL do último mês fechado" },
]
```
A condição de renderização dos cartões passa a ser `{semana && r && (...)}`; `variacao` continua `semana.receitaLiquida - semana.liquidaAnterior`.
5. Navegação de seções: no lugar das duas abas, um único `Link` "Parametrização (N)" que leva a `/dashboards/financeiro/projecoes/${pec.pecCod}?mes=${periodo.mes}&semana=${periodo.semana}`, no mesmo estilo dos botões secundários do projeto. Remover o `<nav aria-label="Seções do PEC">` e o ramo `aba === "parametrizacao"` do JSX; o estado vazio ("Configure o contrato primeiro") mantém o texto e passa a apontar o botão para essa mesma URL.
6. Cabeçalho: manter como está (o gerente continua aparecendo no Flash — a restrição de "sem gerente" vale só para a parametrização).

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: **0 erros** em todo o projeto.
Run: `npx vitest run`
Expected: todos os testes passam.

- [ ] **Step 5: Commit**

```bash
git add src/components/flash/GradeLancamento.tsx src/components/flash/FlashInfo.tsx "src/app/dashboards/financeiro/flash-report/[pec]/page.tsx"
git commit -m "feat(flash): grade com custos, ROL/MC/% e aba de parametrização levando a Projeções

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Documentação, skills e verificação final

**Files:**
- Modify: `CLAUDE.md`
- Modify: `.claude/skills/modulo-projecoes/SKILL.md`
- Modify: `.claude/skills/modulo-flash-report/SKILL.md`

- [ ] **Step 1: Atualizar as skills**

- `modulo-projecoes/SKILL.md`: acrescentar, no topo, que a tela `projecoes-analise` (`/dashboards/financeiro/projecoes`) agora é a **visão de PECs (ROL, MC, % Margem)**, lida do Flash Report por `src/lib/projecoes/visao.ts` + `agrupar.ts`; a tabela dinâmica do RE x OR foi para `/dashboards/financeiro/projecoes/re-x-or` (**fora do menu**, ainda funcional); a parametrização do PEC fica em `/projecoes/[pec]` (`ParametrizacaoPec`). Manter o restante como histórico do RE x OR.
- `modulo-flash-report/SKILL.md`: documentar `natureza` (RECEITA/CUSTO), tipos `TAXA`/`VARIAVEL`, CR por item (`dm_flash_item.cr_cod` editável, validado no escopo), `conta` sem uso, `ft_flash_semana_item.natureza` congelada, `gravarTotais` só da receita, `resumoSemana` (ROL, custos, MC, % margem) e o redirecionamento da aba antiga para Projeções.

- [ ] **Step 2: `CLAUDE.md`**

Na lista de módulos, trocar a linha do RE x OR por: `**Projeções** (Financeiro; visão de PECs com ROL, MC e % Margem + parametrização do PEC; a tabela RE x OR ficou em /projecoes/re-x-or, fora do menu) → modulo-projecoes.` Manter a linha do Flash Report.

- [ ] **Step 3: Verificação completa**

Run: `npx tsc --noEmit` → 0 erros.
Run: `npx vitest run` → tudo verde.
Run: `npm run build` → build conclui sem erro; as rotas `/dashboards/financeiro/projecoes`, `/dashboards/financeiro/projecoes/[pec]` e `/dashboards/financeiro/projecoes/re-x-or` aparecem na lista.

- [ ] **Step 4: Conferência dos números direto no banco (leitura)**

Para um PEC com semana lançada (se houver), comparar a consulta da tela com a soma manual:
```bash
python -c "import sys; sys.path.insert(0,'scripts'); import psycopg2; from _banco import url_banco; c=psycopg2.connect(url_banco()); cur=c.cursor(); cur.execute(\"select s.pec_cod, s.mes, s.semana, s.receita_liquida, coalesce(sum(si.total) filter (where si.natureza='CUSTO'),0) as custos from ft_flash_semana s left join ft_flash_semana_item si on si.semana_id=s.id group by 1,2,3,4 order by s.mes desc, s.semana desc limit 5\"); print(cur.fetchall())"
```
Expected: `ROL − custos` bate com o MC mostrado na tela para o mesmo PEC/mês/semana. Sem semanas lançadas, registrar isso e validar só o estado vazio.

- [ ] **Step 5: Verificação visual (feita pelo coordenador com o `hub-inhaus-dev` do `.claude/launch.json`, `HUB_ACESSO_LIVRE=1`)**

Conferir: (a) tela principal com 3 cards, seletor de mês/semana, "Agrupar por" trocando entre PEC/CR/Gerente/Cliente, busca; (b) clique no PEC abre a parametrização; (c) cadastro de um custo com CR próprio aparece na seção Custos; (d) `flash-report/[pec]?aba=parametrizacao` redireciona; (e) foco visível por teclado e nenhum hex solto (`grep -rn "#[0-9a-fA-F]\{6\}" src/components/projecoes src/app/dashboards/financeiro/projecoes`).

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md .claude/skills/modulo-projecoes/SKILL.md .claude/skills/modulo-flash-report/SKILL.md
git commit -m "docs(projecoes): skills e CLAUDE.md da nova tela de Projeções e da parametrização do PEC

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Auto-revisão (spec × plano)

- **Cobertura da spec:** dados (Task 1, 3) · cálculo puro e testado (Task 2) · tela principal com 3 números, período, agrupar por PEC/CR/gerente/cliente e busca (Tasks 4 e 6) · parametrização sem conta e sem gerente, com CR por item (Task 5) · aba do Flash aponta para a mesma tela (Task 7) · grade com custos (Task 7) · RE x OR fora do menu (Task 6) · isolamento por CR nas duas travas (Tasks 2, 3, 4) · `InfoIndicador` na tela principal e na parametrização (Tasks 5 e 6) e texto do Flash atualizado (Task 7) · skills e CLAUDE.md (Task 8).
- **Desvio consciente da spec:** o "filtro discreto (gerente, CR)" virou uma **busca única** que casa PEC, CR, gerente e cliente; junto com "Agrupar por", cobre o mesmo uso com menos controles (pedido do cliente: tela menos carregada).
- **Consistência de tipos:** `Item` (`natureza`, `crCod`, sem `conta`), `resumoSemana`, `margemPct`, `crNoEscopo`, `LinhaPec`, `Grupo`, `Totais`, `DimVisao` têm as mesmas assinaturas em todas as tasks; `gravarTotais(c, id, aliquota)` é atualizada em todos os chamadores na Task 3.
- **Sem placeholders:** os trechos que dependem de leitura do código real (assinatura do `Combobox`, tipo de `SeloStatus`, versão do zod) trazem a instrução exata de conferência.
