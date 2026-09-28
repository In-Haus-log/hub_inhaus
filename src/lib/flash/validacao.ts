import { z } from "zod"

import { TIPOS, type TipoItem } from "./calculos"

const numero = z.coerce.number({ invalid_type_error: "Informe um número" }).finite("Informe um número")

export const itemSchema = z.object({
  descricao: z.string().trim().min(1, "Descrição é obrigatória").max(120),
  tipo: z.enum(["PESSOAS", "UNITARIO", "HORA_EXTRA", "DESCONTO", "FIXO"], { message: "Tipo inválido" }),
  valorUnitario: numero.min(0, "Valor não pode ser negativo"),
  qtdPadrao: numero.min(0, "Quantidade não pode ser negativa"),
  conta: z.string().regex(/^\d{5}$/, "Escolha uma conta do plano do DRE"),
  agrupador: z.string().trim().max(60).nullish().transform((v) => v || null),
  ordem: z.coerce.number().int().default(0),
})

export const rascunhoSchema = z.object({
  linhas: z.array(z.object({
    itemId: z.number().int().positive(),
    quantidade: z.number({ invalid_type_error: "Informe um número" }).finite().min(0, "Quantidade não pode ser negativa"),
  })),
  comentario: z.string().trim().max(500).nullish().transform((v) => v || null),
})

export const reaberturaSchema = z.object({ motivo: z.string().trim().min(3, "Informe o motivo da reabertura").max(300) })

export const periodoSchema = z.object({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido"),
  semana: z.coerce.number().int().min(1).max(5),
})

export function validarQuantidades(
  linhas: { itemId: number; quantidade: number }[],
  tipos: Map<number, TipoItem>,
): string | null {
  for (const l of linhas) {
    const tipo = tipos.get(l.itemId)
    if (!tipo) return `O item ${l.itemId} não pertence a este PEC.`
    if (!TIPOS[tipo].decimais && !Number.isInteger(l.quantidade)) return "Quantidade de pessoas deve ser um número inteiro."
  }
  return null
}
