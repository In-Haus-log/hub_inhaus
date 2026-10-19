import { inhausPool } from "@/lib/db-inhaus"
import { assertLinhasNoEscopo, type EscopoDados } from "@/lib/seguranca/escopo-dados"
import { filtroCr } from "@/lib/flash/sql"

export const GERENTE_REGIONAL_PROJECOES = "LUCAS RODRIGUES DA SILVA"

/** Recorte operacional de Projeções; sempre intersecta a carteira autorizada. */
export async function escopoRegionalProjecoes(escopo: EscopoDados): Promise<EscopoDados> {
  const f = filtroCr(escopo, "c.cr", 2)
  const { rows } = await inhausPool.query(
    `select c.cr from public.dm_cr c where btrim(c.gerente_regional)=$1${f.sql} order by c.cr`,
    [GERENTE_REGIONAL_PROJECOES, ...f.params])
  assertLinhasNoEscopo(rows, r => r.cr, escopo)
  return { tipo: "lista", crs: rows.map(r => r.cr) }
}

export function escopoRegionalDaRequisicao(req: Request, escopo: EscopoDados): Promise<EscopoDados> {
  return new URL(req.url).searchParams.get("regional") === "lucas"
    ? escopoRegionalProjecoes(escopo) : Promise.resolve(escopo)
}
