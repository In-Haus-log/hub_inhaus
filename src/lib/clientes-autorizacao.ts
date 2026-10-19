// Expansão dinâmica das permissões herdadas por cliente contratante.
// O vínculo é a fonte de verdade; visibleScreens pode ter sido salvo antes de
// existirem novos sistemas/telas para o cliente.

import { prisma } from "@/lib/prisma"
import { TODAS_AS_TELAS } from "@/lib/domains"
import { chaveClienteBi } from "@/lib/powerbi-permissoes"

export type ClienteContratanteAutorizacao = {
  id: number
  nome: string
  slug: string
}

const normalizar = (valor: string) =>
  valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR")

/** Acrescenta BI e sistemas estáticos dos contratantes às concessões existentes. */
export function expandirTelasDeContratantes(
  telas: string[],
  clientes: ClienteContratanteAutorizacao[],
): string[] {
  const slugs = new Set(clientes.map((cliente) => cliente.slug))
  const nomes = new Set(clientes.map((cliente) => normalizar(cliente.nome)))
  const herdadas = TODAS_AS_TELAS
    .filter((tela) => tela.clienteKey && (
      slugs.has(tela.clienteKey) || nomes.has(normalizar(tela.clienteLabel ?? ""))
    ))
    .map((tela) => tela.key)

  const telasSemBi = telas.filter((tela) => !/^cliente-bi:\d+$/.test(tela))
  return Array.from(new Set([
    ...telasSemBi,
    ...clientes.map((cliente) => chaveClienteBi(cliente.id)),
    ...herdadas,
  ]))
}

/** Resolve os vínculos ativos no momento da autorização, sem depender do snapshot salvo. */
export async function expandirTelasAutorizadasContratantes(
  telas: string[],
  contratanteIds: number[],
): Promise<string[]> {
  const ids = Array.from(new Set(contratanteIds.filter((id) => Number.isSafeInteger(id) && id > 0)))
  if (!ids.length) return telas

  const clientes = await prisma.clienteContratante.findMany({
    where: { id: { in: ids }, ativo: true },
    select: { id: true, nome: true, slug: true },
  })
  return expandirTelasDeContratantes(telas, clientes)
}
