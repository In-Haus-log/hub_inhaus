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
