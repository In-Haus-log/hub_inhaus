import { inhausPool } from "@/lib/db-inhaus"
import { mesParaData, type Periodo } from "@/lib/flash/semanas"
import { filtroCr } from "@/lib/flash/sql"
import { assertLinhasNoEscopo, type EscopoDados } from "@/lib/seguranca/escopo-dados"
import type { LinhaPec } from "./agrupar"

/** A lista nasce da mesma dm_cr do cadastro de CRs. Uma linha por PEC, sem duplicar totais. */
export async function listarVisao(escopo: EscopoDados, periodo: Periodo): Promise<LinhaPec[]> {
  const fc = filtroCr(escopo, "c.cr", 3)
  const fi = filtroCr(escopo, "si.cr_cod", 3)
  const { rows } = await inhausPool.query(
    `with carteira as (
       select btrim(c.pec) as pec_cod,
              (array_agg(c.cr order by (c.cr=p.cr_cod) desc nulls last,c.cr))[1] as cr_cod,
              array_agg(c.cr order by c.cr) as crs,
              coalesce(max(p.pec_nome),'PEC '||btrim(c.pec)) as pec_nome,
              case when count(distinct nullif(c.gerente,''))>1 then 'Diversos gestores' else max(nullif(c.gerente,'')) end as gerente,
              case when count(distinct coalesce(nullif(c.nome_grp_cliente,''),c.nome_cliente))>1 then 'Diversos clientes' else max(coalesce(nullif(c.nome_grp_cliente,''),c.nome_cliente)) end as cliente
         from public.dm_cr c left join public.dm_flash_pec p on p.pec_cod=btrim(c.pec)
        where nullif(btrim(c.pec),'') is not null${fc.sql}
        group by btrim(c.pec)
     ) select p.*, s.status,
       case when s.id is null then null else
         round(coalesce((select sum(si.total) from public.ft_flash_semana_item si
           where si.semana_id=s.id and si.natureza='RECEITA' and si.cr_cod=any(p.crs)${fi.sql}),0)*(1-s.aliquota),2)::float8 end as rol,
       case when s.id is null then null else
         coalesce((select sum(si.total) from public.ft_flash_semana_item si
           where si.semana_id=s.id and si.natureza='CUSTO' and si.cr_cod=any(p.crs)${fi.sql}),0)::float8 end as custos
       from carteira p left join public.ft_flash_semana s
         on s.pec_cod=p.pec_cod and s.mes=$1::date and s.semana=$2
       order by p.pec_cod`, [mesParaData(periodo.mes), periodo.semana, ...fc.params])
  assertLinhasNoEscopo(rows, r => r.cr_cod, escopo)
  for (const r of rows) assertLinhasNoEscopo(r.crs, cr => String(cr), escopo)
  return rows.map(r => ({ pecCod: r.pec_cod, pecNome: r.pec_nome, crCod: r.cr_cod, crs: r.crs,
    gerente: r.gerente, cliente: r.cliente, status: r.status ?? "PENDENTE", rol: r.rol, custos: r.custos }))
}
