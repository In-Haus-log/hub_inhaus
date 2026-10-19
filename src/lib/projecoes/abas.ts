import type { Item, TipoItem } from "@/lib/flash/calculos"

export const ABAS = ["Pessoas", "Hora Extra", "Variáveis", "Glosas"] as const
export type Aba = typeof ABAS[number]
export type ParametrosItem = { aba: Aba; unidadeMedida: string; remuneracao: "FIXO" | "VARIAVEL"; turno: string | null }

export function abaDoItem(item: Pick<Item, "tipo" | "parametros">): Aba {
  // O tipo contábil sempre prevalece sobre a etiqueta visual.
  if (item.tipo === "DESCONTO") return "Glosas"
  if (item.tipo === "HORA_EXTRA") return "Hora Extra"
  if (item.tipo === "PESSOAS") return "Pessoas"
  return item.parametros?.aba === "Pessoas" ? "Pessoas" : "Variáveis"
}
export function tipoDaAba(aba: Aba, unidade: string): TipoItem {
  if (aba === "Glosas") return "DESCONTO"
  if (aba === "Hora Extra") return "HORA_EXTRA"
  if (aba === "Pessoas" && unidade === "Pessoas") return "PESSOAS"
  return "UNITARIO"
}
export function unidadeDoItem(item: Item): string {
  return item.parametros?.unidadeMedida ?? (item.tipo === "PESSOAS" ? "Pessoas" : item.tipo === "HORA_EXTRA" ? "Horas" : "Unidades")
}
export const numeroTexto = (n: number) => String(n).replace(".", ",")
export function numeroEntrada(texto: string): number {
  const t = texto.trim()
  if (!t || !/^\d+(?:[.,]\d+)?$/.test(t)) return NaN
  return Number(t.replace(",", "."))
}

export const valorUnitarioTexto = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n)
