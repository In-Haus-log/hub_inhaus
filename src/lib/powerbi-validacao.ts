import { z } from "zod"
import { CHAVES_ICONES_BI } from "@/lib/powerbi-icones"

export function linkPowerBiValido(valor: string): boolean {
  try {
    const url = new URL(valor)
    return url.protocol === "https:" && url.hostname === "app.powerbi.com" &&
      !url.username && !url.password && !url.port &&
      ["/view", "/reportEmbed", "/dashboardEmbed"].includes(url.pathname) && url.search.length > 1
  } catch { return false }
}

const titulo = z.string().trim().min(1, "Informe o título").max(120, "Use até 120 caracteres")
export const cadastroPowerBi = z.object({
    clienteId: z.number().int().positive("Selecione um cliente"), titulo,
    icone: z.enum(CHAVES_ICONES_BI, { invalid_type_error: "Selecione um ícone válido" }).optional(),
    documentacao: z.string().trim().max(20000, "A documentação deve ter até 20.000 caracteres").optional(),
    url: z.string().trim().max(4096).refine(linkPowerBiValido, "Informe um link de incorporação válido do Power BI"),
}).strict()
