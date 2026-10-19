import { z } from "zod"

import { TIPOS, TIPOS_POR_NATUREZA, type TipoItem } from "./calculos"
import { semanasDoMes } from "./semanas"

const numero = z.coerce.number({ invalid_type_error: "Informe um número" }).finite("Informe um número")

export const itemSchema = z
  .object({
    descricao: z.string().trim().min(1, "Descrição é obrigatória").max(120),
    natureza: z.enum(["RECEITA", "CUSTO"], { message: "Natureza inválida" }).default("RECEITA"),
    tipo: z.enum(["PESSOAS", "UNITARIO", "HORA_EXTRA", "DESCONTO", "FIXO", "TAXA", "VARIAVEL"], { message: "Tipo inválido" }),
    valorUnitario: numero.min(0, "Valor não pode ser negativo"),
    qtdPadrao: numero.min(0, "Quantidade não pode ser negativa"),
    crCod: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{5}$/, "CR inválido: use os 5 caracteres do CR")
      .nullish()
      .or(z.literal(""))
      .transform((v) => v || null),
    agrupador: z.string().trim().max(60).nullish().transform((v) => v || null),
    ordem: z.coerce.number().int().default(0),
    parametros: z.object({
      aba: z.enum(["Pessoas", "Hora Extra", "Variáveis", "Glosas"]),
      unidadeMedida: z.string().trim().min(1).max(30),
      remuneracao: z.enum(["FIXO", "VARIAVEL"]),
      turno: z.string().trim().max(60).nullable(),
    }).optional(),
  })
  .refine((d) => TIPOS_POR_NATUREZA[d.natureza].includes(d.tipo), {
    message: "Este tipo não existe para a natureza escolhida.",
    path: ["tipo"],
  })
  .refine(d => !d.parametros || !!d.agrupador?.trim(), { message: "Informe Área / Turno.", path: ["agrupador"] })
  .refine(d => !d.parametros || d.parametros.aba !== "Hora Extra" || ["Horas", "Verba"].includes(d.parametros.unidadeMedida), { message: "Hora extra deve ser lançada por horas ou valor consolidado.", path: ["parametros", "unidadeMedida"] })
  .refine(d => d.tipo !== "PESSOAS" || Number.isInteger(d.qtdPadrao), { message: "Quantidade de pessoas deve ser inteira.", path: ["qtdPadrao"] })
  .refine(d => !d.parametros || (d.parametros.aba === "Glosas" ? d.tipo === "DESCONTO" : d.parametros.aba === "Hora Extra" ? d.tipo === "HORA_EXTRA" : d.parametros.aba === "Pessoas" ? d.tipo === "PESSOAS" || d.tipo === "UNITARIO" : d.tipo !== "DESCONTO" && d.tipo !== "HORA_EXTRA" && d.tipo !== "PESSOAS"), { message: "A estrutura do item não corresponde à aba escolhida.", path: ["parametros"] })

export const rascunhoSchema = z.object({
  linhas: z.array(z.object({
    itemId: z.number().int().positive(),
    quantidade: z.number({ invalid_type_error: "Informe um número" }).finite().min(0, "Quantidade não pode ser negativa"),
  })),
  comentario: z.string().trim().max(500).nullish().transform((v) => v || null),
})

export const reaberturaSchema = z.object({ motivo: z.string().trim().min(3, "Informe o motivo da reabertura").max(300) })

export const mesSchema = z.object({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido") })

export const periodoSchema = z.object({
  mes: mesSchema.shape.mes,
  semana: z.coerce.number().int().min(1).max(5),
}).refine((p) => semanasDoMes(p.mes).includes(p.semana), { message: "Esta semana não existe no mês.", path: ["semana"] })

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
