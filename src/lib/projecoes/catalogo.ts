import { inhausPool } from "@/lib/db-inhaus"
import { filtroCr } from "@/lib/flash/sql"
import { assertLinhasNoEscopo, type EscopoDados } from "@/lib/seguranca/escopo-dados"

export async function crsDoPec(escopo: EscopoDados, pecCod: string): Promise<{ cr: string; nome: string; pecCod: string; pecNome?: string; gerente: string | null; cliente: string | null }[]> {
  const f = filtroCr(escopo, "c.cr", 2)
  const { rows } = await inhausPool.query(
    `select c.cr, coalesce(c.descri_cr,c.cr) as nome, btrim(c.pec) as pec_cod,
            p.pec_nome, c.gerente, coalesce(nullif(c.nome_grp_cliente,''),c.nome_cliente) as cliente
       from public.dm_cr c
       left join public.dm_flash_pec p on p.pec_cod=btrim(c.pec)
      where btrim(c.pec)=$1${f.sql}
      order by (c.cr=p.cr_cod) desc nulls last, c.cr`, [pecCod, ...f.params])
  assertLinhasNoEscopo(rows, r => r.cr, escopo)
  return rows.map(r => ({ cr: r.cr, nome: r.nome, pecCod: r.pec_cod, pecNome: r.pec_nome ?? undefined, gerente: r.gerente, cliente: r.cliente }))
}
