import { TYPES_OCORRENCIA, type LinhaConformidadeLegal } from "./conformidade-legal-modelo"

export type FiltrosConformidade = {
  mes: string; cr: string; regional: string; gerente: string; supervisor: string; funcao: string; tipo: string
}
export const FILTROS_CONFORMIDADE_VAZIOS: FiltrosConformidade = {
  mes: "", cr: "", regional: "", gerente: "", supervisor: "", funcao: "", tipo: "",
}
export function lerFiltrosConformidade(params: Record<string, string | string[] | undefined>): FiltrosConformidade {
  const filtros = { ...FILTROS_CONFORMIDADE_VAZIOS }
  for (const chave of Object.keys(filtros) as (keyof FiltrosConformidade)[]) {
    filtros[chave] = typeof params[chave] === "string" ? (params[chave] as string).slice(0, 300) : ""
  }
  if (filtros.mes && !/^\d{4}-(0[1-9]|1[0-2])$/.test(filtros.mes)) filtros.mes = ""
  if (filtros.cr && !/^\d{5}$/.test(filtros.cr)) filtros.cr = ""
  if (!TYPES_OCORRENCIA.some(t => t.key === filtros.tipo)) filtros.tipo = ""
  return filtros
}
export function filtrarConformidade(linhas: LinhaConformidadeLegal[], filtros: FiltrosConformidade): LinhaConformidadeLegal[] {
  const tipo = TYPES_OCORRENCIA.find(t => t.key === filtros.tipo)?.key
  return linhas.filter(l =>
    (!filtros.mes || l.mes === filtros.mes) && (!filtros.cr || l.cr === filtros.cr) &&
    (!filtros.regional || l.regional === filtros.regional) && (!filtros.gerente || l.gerente === filtros.gerente) &&
    (!filtros.supervisor || l.supervisor === filtros.supervisor) && (!filtros.funcao || l.funcao === filtros.funcao) &&
    (!tipo || Number(l[tipo]) > 0)
  )
}
export function linkConformidade(path: string, filtros: FiltrosConformidade): string {
  const params = new URLSearchParams()
  for (const [chave, valor] of Object.entries(filtros)) if (valor) params.set(chave, valor)
  return `${path}${params.size ? `?${params.toString()}` : ""}`
}
