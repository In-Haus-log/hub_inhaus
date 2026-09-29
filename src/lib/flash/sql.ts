import type { EscopoDados } from "@/lib/seguranca/escopo-dados"

/** Trava 1 para as tabelas do Flash Report (coluna já é o código de 5 chars). */
export function filtroCr(escopo: EscopoDados, coluna: string, placeholder: number): { sql: string; params: unknown[] } {
  if (escopo.tipo === "todos") return { sql: "", params: [] }
  if (escopo.crs.length === 0) return { sql: " and 1=0", params: [] }
  return { sql: ` and ${coluna} = any($${placeholder}::text[])`, params: [escopo.crs] }
}

/** O CR (5 chars) está dentro do escopo do usuário? Lista vazia nunca aceita (fail-closed). */
export function crNoEscopo(escopo: EscopoDados, cr: string): boolean {
  return escopo.tipo === "todos" || escopo.crs.includes(cr)
}
