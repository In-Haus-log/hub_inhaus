/**
 * Dimensões da tabela dinâmica do Projeções (chave estável → rótulo).
 * Módulo PURO: usado no client (controles) e no server (montagem do SQL).
 * O mapeamento chave → coluna do banco fica em consulta.ts (só no server).
 */
export const DIMENSOES = [
  { key: "gerente", label: "Gerente" },
  { key: "supervisor", label: "Supervisor" },
  { key: "pec", label: "PEC" },
  { key: "cr", label: "CR" },
  { key: "cliente", label: "Cliente" },
  { key: "regional", label: "Regional" },
  { key: "negocio", label: "Negócio" },
  { key: "situacao", label: "Situação do PEC" },
  { key: "grupo", label: "Grupo de contas" },
  { key: "conta", label: "Conta" },
  { key: "subconta", label: "Subconta" },
] as const

export type DimensaoKey = (typeof DIMENSOES)[number]["key"]

const CHAVES = new Set<string>(DIMENSOES.map((d) => d.key))

export function ehDimensao(valor: string): valor is DimensaoKey {
  return CHAVES.has(valor)
}

export function rotuloDimensao(key: DimensaoKey): string {
  return DIMENSOES.find((d) => d.key === key)?.label ?? key
}

/** Dimensões de conta: sob elas ROL/MC não fazem sentido (não geram linhas de resumo). */
export const DIMENSOES_FINANCEIRAS: DimensaoKey[] = ["grupo", "conta", "subconta"]

/** Abertura padrão = o BI 1.2.05 (contas nas linhas). */
export const NIVEIS_PADRAO: DimensaoKey[] = ["conta"]

export const MAX_NIVEIS = 5
