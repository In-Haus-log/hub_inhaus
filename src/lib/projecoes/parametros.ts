import { DIMENSOES, MAX_NIVEIS, NIVEIS_PADRAO, ehDimensao, type DimensaoKey } from "./dimensoes"

/**
 * Estado da análise (níveis, valor exibido, período e filtros) ⇄ URL.
 * Módulo PURO, compartilhado entre a página (server) e os controles (client).
 * Meses são sempre "AAAA-MM".
 */

export type Medida = "realizado" | "orcado" | "diferenca" | "diferenca_pct"

export const MEDIDAS: { key: Medida; label: string }[] = [
  { key: "realizado", label: "Realizado" },
  { key: "orcado", label: "Orçado" },
  { key: "diferenca", label: "Diferença (R$)" },
  { key: "diferenca_pct", label: "Diferença (%)" },
]

export type Periodo = { de: string; ate: string }
export type Filtros = Partial<Record<DimensaoKey, string[]>>
export type EstadoAnalise = {
  niveis: DimensaoKey[]
  medida: Medida
  periodo: Periodo | null
  filtros: Filtros
}

const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/
const NOMES_MES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]

function unicos<T>(lista: T[]): T[] {
  return Array.from(new Set(lista))
}

export function lerEstado(sp: URLSearchParams): EstadoAnalise {
  const niveis = unicos(sp.getAll("n").filter(ehDimensao)).slice(0, MAX_NIVEIS)
  const med = sp.get("med")
  const medida = MEDIDAS.some((m) => m.key === med) ? (med as Medida) : "realizado"

  const de = sp.get("de")
  const ate = sp.get("ate")
  let periodo: Periodo | null = null
  if (de && ate && RE_MES.test(de) && RE_MES.test(ate)) {
    periodo = de <= ate ? { de, ate } : { de: ate, ate: de }
  }

  const filtros: Filtros = {}
  for (const d of DIMENSOES) {
    const valores = unicos(sp.getAll(`f_${d.key}`).filter((v) => v !== ""))
    if (valores.length) filtros[d.key] = valores
  }

  return { niveis: niveis.length ? niveis : [...NIVEIS_PADRAO], medida, periodo, filtros }
}

export function escreverEstado(e: EstadoAnalise): URLSearchParams {
  const sp = new URLSearchParams()
  for (const n of e.niveis) sp.append("n", n)
  sp.set("med", e.medida)
  if (e.periodo) {
    sp.set("de", e.periodo.de)
    sp.set("ate", e.periodo.ate)
  }
  for (const d of DIMENSOES) {
    for (const v of e.filtros[d.key] ?? []) sp.append(`f_${d.key}`, v)
  }
  return sp
}

/** Converte o caminho de uma linha (valores dos níveis-pai) em pares nível/valor. */
export function caminhoDe(
  niveis: DimensaoKey[],
  valores: string[],
): { dim: DimensaoKey; valor: string }[] | null {
  if (valores.length > niveis.length) return null
  return valores.map((valor, i) => ({ dim: niveis[i], valor }))
}

/** searchParams do Next (Record) → URLSearchParams. */
export function paraURLSearchParams(
  obj: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const sp = new URLSearchParams()
  for (const [chave, valor] of Object.entries(obj)) {
    if (Array.isArray(valor)) valor.forEach((v) => sp.append(chave, v))
    else if (valor !== undefined) sp.append(chave, valor)
  }
  return sp
}

export function somarMeses(mes: string, n: number): string {
  const [ano, m] = mes.split("-").map(Number)
  const total = ano * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`
}

/** Todos os meses de `de` a `ate`, do mais recente para o mais antigo (como o BI). */
export function mesesEntre(de: string, ate: string): string[] {
  const meses: string[] = []
  for (let m = ate; m >= de; m = somarMeses(m, -1)) meses.push(m)
  return meses
}

/** Últimos 12 meses até o mais recente com dado (limitado ao mais antigo com dado). */
export function periodoPadrao(mesesComDado: string[]): Periodo | null {
  if (!mesesComDado.length) return null
  const ordenados = [...mesesComDado].sort()
  const ate = ordenados[ordenados.length - 1]
  const inicio = somarMeses(ate, -11)
  const de = ordenados[0] > inicio ? ordenados[0] : inicio
  return { de, ate }
}

export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-")
  return `${NOMES_MES[Number(m) - 1]} ${ano}`
}
