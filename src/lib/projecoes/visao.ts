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
 * Regra (escopada): ROL = receitas da semana com CR no escopo do usuário × (1 − alíquota da semana);
 * custos = custos com CR no escopo; MC = ROL − custos (ver src/lib/flash/calculos.ts).
 */
export async function listarVisao(escopo: EscopoDados, periodo: Periodo): Promise<LinhaPec[]> {
  const fp = filtroCr(escopo, "p.cr_cod", 3)
  const fi = filtroCr(escopo, "si.cr_cod", 3)
  const { rows } = await inhausPool.query(
    `select p.pec_cod, p.pec_nome, p.cr_cod, p.gerente, cli.cliente,
            s.status,
            case when s.id is null then null else
              round(coalesce((select sum(si.total) from public.ft_flash_semana_item si
                               where si.semana_id = s.id and si.natureza = 'RECEITA'${fi.sql}), 0) * (1 - s.aliquota), 2)::float8 end as rol,
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
