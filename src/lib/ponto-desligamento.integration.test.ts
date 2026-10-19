import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Client } from "pg"
import { loadEnvConfig } from "@next/env"
import { VINCULOS_PONTO_SQL, condicaoCorteDesligamentoSql } from "./ponto-desligamento"

// Opt-in: TESTAR_ABSENTEISMO_DB=1 npm test -- ponto-desligamento.integration.
// Apenas CTEs VALUES em uma transação READ ONLY. Nenhuma tabela é criada/alterada.
describe.skipIf(process.env.TESTAR_ABSENTEISMO_DB !== "1")("corte inclusivo no PostgreSQL", () => {
  let db: Client
  let ids: number[]; let conectado = false
  beforeAll(async () => {
    const ambienteAnterior = process.env.NODE_ENV; Object.assign(process.env, { NODE_ENV: "development" }); try { loadEnvConfig(process.cwd(), true, console, true) } finally { Object.assign(process.env, { NODE_ENV: ambienteAnterior }) }; if (!(process.env.DATABASE_URL_INHAUS || process.env.DATABASE_URL)) throw new Error("Conexão do hub não configurada para o teste de integração")
    db = new Client({
      connectionString: process.env.DATABASE_URL_INHAUS || process.env.DATABASE_URL,
      connectionTimeoutMillis: 15000,
      statement_timeout: 30000,
    })
    await db.connect(); conectado = true
    await db.query("BEGIN READ ONLY")
    const fontes = VINCULOS_PONTO_SQL
      .replaceAll("public.ft_desligados", "baixas_fixture")
      .replaceAll("public.ft_colaboradores_sra_diario", "sra_fixture")
    const { rows } = await db.query<{ id: number }>(`with
      ponto(id, matricula, cr, data) as (
        values
          (1, '17', '68732 - Unidade', date '2026-09-09'),
          (2, '17', '68732 - Unidade', date '2026-09-10'),
          (3, '17', '68732 - Unidade', date '2026-09-11'),
          (4, '17', '68732 - Unidade', date '2026-09-20'),
          (5, '42', '68732 - Unidade', date '2026-09-11'),
          (6, '99', '68732 - Unidade', date '2026-09-11'),
          (7, '55', '68732 - Unidade', date '2026-09-06'),
          (8, '55', '68732 - Unidade', date '2026-09-20'),
          (9, '17', '99999 - Outra unidade', date '2026-09-11')
      ),
      baixas_fixture(matricula, cr, dt_admissao, dt_demissao) as (
        values
          ('17', '68732 - Nome anterior', date '2026-01-01', date '2026-09-10'),
          ('17', '68732 - Nome anterior', date '2026-01-01', date '2026-09-10'),
          ('17', '68732', date '2026-09-20', null),
          ('42', '68732', date '2026-01-01', null),
          ('55', '68732', date '2026-01-01', date '2026-09-05')
      ),
      sra_fixture(matricula, cr, dt_admissao) as (
        values ('55', '68732', date '2026-09-20')
      ), ${fontes}
      select p.id from ponto p where true ${condicaoCorteDesligamentoSql()}
      order by p.id`)
    ids = rows.map((r) => r.id)
  }, 45000)
  afterAll(async () => {
    if (db) { try { if (conectado) await db.query("ROLLBACK") } finally { await db.end() } }
  })
  it("inclui antes/no dia e exclui depois do desligamento", () => {
    expect(ids).toContain(1)
    expect(ids).toContain(2)
    expect(ids).not.toContain(3)
  })
  it("mantém data nula/sem baixa e isola vínculos de outro CR", () => {
    expect(ids).toEqual(expect.arrayContaining([5, 6, 9]))
  })
  it("preserva recontratações comprovadas e não duplica eventos", () => {
    expect(ids).not.toContain(7)
    expect(ids).toEqual([1, 2, 4, 5, 6, 8, 9])
  })
})
