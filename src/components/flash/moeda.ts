import { formatarNumero } from "@/lib/format"

/** R$ no padrão pt-BR, com menos tipográfico. */
export function moeda(valor: number, casas = 0): string {
  return `${valor < 0 ? "−" : ""}R$ ${formatarNumero(Math.abs(valor), casas)}`
}

/** Variação em reais com sinal explícito (+/−). */
export function variacaoMoeda(valor: number): string {
  if (Math.round(valor) === 0) return "R$ 0"
  return `${valor > 0 ? "+" : "−"}R$ ${formatarNumero(Math.abs(valor), 0)}`
}

/** "092454 (SP) - LOG - SUVINIL COATINGS DEMARCHI / ATIVO" → "SUVINIL COATINGS DEMARCHI". */
export function nomeDoPec(pecNome: string): string {
  const semSituacao = pecNome.split(" / ")[0]
  const partes = semSituacao.split(" - ")
  return partes[partes.length - 1] ?? semSituacao
}

/** Percentual com 1 casa (0,132 → "13,2%"); vazio ("—") quando não há base. */
export function percentual(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
