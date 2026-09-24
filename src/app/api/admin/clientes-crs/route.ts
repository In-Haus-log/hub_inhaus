import { NextResponse } from "next/server"
import { guardAdmin } from "@/lib/admin-guard"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Lista os grupos de cliente e os CRs da dm_cr para os seletores da tela de Usuários.
// Inclui também os CRs que só existem no RE x OR (ft_real_orcado) e ainda não foram
// cadastrados na dm_cr — sem isso, o gerente daquele CR não tem como ser vinculado.
export async function GET() {
  const g = await guardAdmin()
  if (!g.ok) return g.response

  const [linhas, extras] = await Promise.all([
    prisma.$queryRaw<{ cr: string; nome_grp_cliente: string | null; descri_cr: string | null }[]>`
      select cr, nome_grp_cliente, descri_cr from dm_cr order by nome_grp_cliente nulls last, cr
    `,
    prisma.$queryRaw<{ cr_cod: string; cr_bruto: string | null }[]>`
      select cr_cod, min(cr) as cr_bruto
        from ft_real_orcado
       where cr_cod is not null
       group by cr_cod
    `,
  ])

  const clientes = Array.from(
    new Set(linhas.map((l) => l.nome_grp_cliente).filter((v): v is string => !!v)),
  )

  const codigosConhecidos = new Set(linhas.map((l) => l.cr))
  const crsExtras = extras
    .filter((e) => !codigosConhecidos.has(e.cr_cod))
    .map((e) => {
      const bruto = e.cr_bruto ?? e.cr_cod
      const partes = bruto.split(" - ")
      const descricao = partes.length > 1 ? partes.slice(1).join(" - ").trim() : bruto
      return { cr: e.cr_cod, cliente: null, descricao }
    })
    .sort((a, b) => a.cr.localeCompare(b.cr))

  const crs = [
    ...linhas.map((l) => ({
      cr: l.cr,
      cliente: l.nome_grp_cliente,
      descricao: l.descri_cr,
    })),
    ...crsExtras,
  ]
  return NextResponse.json({ clientes, crs })
}
