import { inhausPool } from "@/lib/db-inhaus"
import { assertLinhasNoEscopo, predicadoSraCr, type EscopoDados } from "@/lib/seguranca/escopo-dados"
import { TYPES_OCORRENCIA, type DadosConformidadeLegal, type LinhaConformidadeLegal } from "@/lib/conformidade-legal-modelo"

export { TYPES_OCORRENCIA }
export type { DadosConformidadeLegal, LinhaConformidadeLegal }

type LinhaBanco = {
  competencia: string | Date
  cr_cod: string | null
  cr_nome: string | null
  gerente_regional: string | null
  gerente: string | null
  supervisor: string | null
  funcao: string | null
  colaborador_nome: string | null
  cpf_hash: string | null
  interjornada: number | null
  limite_hr_dia: number | null
  limite_hr_dia_excecao: number | null
  folga_semanal: number | null
  x12x36_limite_ft_mes: number | null
  ferias_com_ponto: number | null
  total_ocorrencias: number | null
  importado_em: string | Date | null
  extraido_em: string | Date | null
}

const mesIso = (valor: string | Date) => {
  if (valor instanceof Date) return `${valor.getUTCFullYear()}-${String(valor.getUTCMonth() + 1).padStart(2, "0")}`
  return valor.slice(0, 7)
}

export async function getConformidadeLegal(escopo: EscopoDados): Promise<DadosConformidadeLegal> {
  if (escopo.tipo === "lista" && escopo.crs.length === 0) return { linhas: [], atualizadoEm: null }
  const pred = predicadoSraCr(escopo, "v.cr_cod", 1)
  const { rows } = await inhausPool.query<LinhaBanco>(
    `select v.competencia, v.cr_cod, v.cr_nome, v.gerente_regional, v.gerente,
            v.supervisor, v.funcao, v.colaborador_nome, v.cpf_hash,
            v.interjornada, v.limite_hr_dia, v.limite_hr_dia_excecao,
            v.folga_semanal, v.x12x36_limite_ft_mes, v.ferias_com_ponto,
            v.total_ocorrencias, v.importado_em, v.extraido_em
       from public.vw_conformidade_legal v
      where 1=1${pred.sql}
      order by v.competencia, v.cr_cod, v.colaborador_nome, v.cpf_hash`,
    pred.params,
  )
  assertLinhasNoEscopo(rows, (r) => r.cr_cod, escopo)

  // O identificador é um ordinal efêmero por resposta. O hash fica exclusivamente no servidor.
  const pessoas = new Map<string, string>()
  let proximaPessoa = 1
  const linhas = rows.map((r): LinhaConformidadeLegal => {
    let pessoaId: string | null = null
    if (r.cpf_hash) {
      pessoaId = pessoas.get(r.cpf_hash) ?? null
      if (!pessoaId) {
        pessoaId = `pessoa-${proximaPessoa++}`
        pessoas.set(r.cpf_hash, pessoaId)
      }
    }
    return {
      mes: mesIso(r.competencia), cr: r.cr_cod, crNome: r.cr_nome,
      regional: r.gerente_regional, gerente: r.gerente, supervisor: r.supervisor,
      funcao: r.funcao, colaborador: r.colaborador_nome, pessoaId,
      interjornada: r.interjornada, limite_hr_dia: r.limite_hr_dia,
      limite_hr_dia_excecao: r.limite_hr_dia_excecao, folga_semanal: r.folga_semanal,
      x12x36_limite_ft_mes: r.x12x36_limite_ft_mes, ferias_com_ponto: r.ferias_com_ponto,
      total: r.total_ocorrencias,
    }
  })
  const atualizacoes = rows.flatMap((r) => [r.importado_em, r.extraido_em]).filter((v): v is string | Date => v != null)
  const maxTimestamp = atualizacoes.reduce((max, v) => Math.max(max, v instanceof Date ? v.getTime() : Date.parse(v)), Number.NEGATIVE_INFINITY)
  const atualizadoEm = Number.isFinite(maxTimestamp) ? new Date(maxTimestamp).toISOString() : null
  return { linhas, atualizadoEm }
}
