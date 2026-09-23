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
import type { EscopoDados } from "@/lib/seguranca/escopo-dados"

const TODOS: EscopoDados = { tipo: "todos" }
const LISTA: EscopoDados = { tipo: "lista", crs: ["25415", "68732"] }
const VAZIO: EscopoDados = { tipo: "lista", crs: [] }

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
