import { margemPct } from "@/lib/flash/calculos"

/** Como a lista de PECs pode ser agrupada na tela de Projeções. */
export type DimVisao = "pec" | "cr" | "gerente" | "cliente"
export const DIMENSOES_VISAO: { chave: DimVisao; rotulo: string }[] = [
  { chave: "pec", rotulo: "PEC" },
  { chave: "cr", rotulo: "CR" },
  { chave: "gerente", rotulo: "Gerente" },
  { chave: "cliente", rotulo: "Cliente" },
]

export const lerDim = (v: unknown): DimVisao => (DIMENSOES_VISAO.some((d) => d.chave === v) ? (v as DimVisao) : "pec")

export type StatusLinha = "PENDENTE" | "RASCUNHO" | "ENVIADO" | "REABERTO"
export type LinhaPec = {
  pecCod: string
  pecNome: string
  crCod: string
  crs?: string[]
  gerente: string | null
  cliente: string | null
  status: StatusLinha
  /** ROL projetado na semana; `null` = sem lançamento. */
  rol: number | null
  custos: number | null
}
export type Totais = { rol: number; mc: number; margem: number | null; lancados: number; total: number }
export type Grupo = { chave: string; rotulo: string; totais: Totais; pecs: LinhaPec[] }

const centavos = (v: number) => Math.round(v * 100) / 100
const SEM_INFO = "Sem informação"

/** MC do PEC na semana: ROL − custos lançados. Sem lançamento não tem MC. */
export const mcDe = (l: LinhaPec): number | null => (l.rol == null ? null : centavos(l.rol - (l.custos ?? 0)))

/** Soma só os PECs com lançamento; PENDENTE fica de fora (não conta como zero). */
export function totalizar(pecs: LinhaPec[]): Totais {
  const lancados = pecs.filter((p) => p.rol != null)
  const rol = centavos(lancados.reduce((s, p) => s + (p.rol ?? 0), 0))
  const mc = centavos(lancados.reduce((s, p) => s + (mcDe(p) ?? 0), 0))
  return { rol, mc, margem: margemPct(mc, rol), lancados: lancados.length, total: pecs.length }
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export function filtrarPecs(pecs: LinhaPec[], busca: string): LinhaPec[] {
  const q = semAcento(busca.trim())
  if (!q) return pecs
  return pecs.filter((p) =>
    semAcento([p.pecCod, p.pecNome, ...(p.crs ?? [p.crCod]), p.gerente ?? "", p.cliente ?? ""].join(" ")).includes(q),
  )
}

export function agruparPecs(pecs: LinhaPec[], dim: DimVisao): Grupo[] {
  const chaveDe = (p: LinhaPec): string =>
    dim === "pec" ? p.pecCod : dim === "cr" ? p.crCod : ((dim === "gerente" ? p.gerente : p.cliente) ?? SEM_INFO)
  const mapa = new Map<string, LinhaPec[]>()
  for (const p of pecs) {
    const k = chaveDe(p)
    mapa.set(k, [...(mapa.get(k) ?? []), p])
  }
  return [...mapa.entries()]
    .map(([chave, lista]) => ({
      chave,
      rotulo: dim === "pec" ? lista[0].pecNome : chave,
      totais: totalizar(lista),
      pecs: [...lista].sort((a, b) => a.pecCod.localeCompare(b.pecCod)),
    }))
    .sort((a, b) => {
      if (a.chave === SEM_INFO) return 1
      if (b.chave === SEM_INFO) return -1
      return dim === "pec" ? a.chave.localeCompare(b.chave) : a.rotulo.localeCompare(b.rotulo, "pt-BR")
    })
}
