import { createHash } from "node:crypto"
import { inhausPool } from "@/lib/db-inhaus"
import { assertLinhasNoEscopo, predicadoSraCr, type EscopoDados } from "@/lib/seguranca/escopo-dados"

/**
 * Absenteísmo GPS: as taxas são ponderadas pelos valores financeiros do período,
 * nunca pela média das taxas individuais. Devoluções reduzem o total descontado;
 * correções negativas são preservadas. Sem verbas na base, a taxa é nula.
 * A identidade de detalhe usa CPF HMAC somente internamente; a resposta expõe
 * apenas um identificador opaco derivado, nunca o hash original.
 */
export type ResumoGps = {
  geral: number | null; injustificado: number | null; justificado: number | null
  colaboradores: number; descontadas: number; abonadas: number; devolucoes: number; verbas: number
}
export type EvolucaoGps = ResumoGps & { mes: string }
export type ColaboradorGps = {
  id: string; nome: string; gerente: string; crCodigo: string; crNome: string
  geral: number | null; injustificado: number | null; justificado: number | null
  descontadas: number; abonadas: number; verbas: number
}
export type FiltrosGps = { mes: string; gerente?: string; cr?: string }
export type OpcoesGps = { meses: string[]; gerentes: string[]; crs: { codigo: string; nome: string }[] }
export type DashboardGps = {
  mes: string; mesAnterior: string; atual: ResumoGps; anterior: ResumoGps | null
  evolucao: EvolucaoGps[]; colaboradores: ColaboradorGps[]; atualizadoEm: string | null
}

export type LinhaGps = {
  competencia: string; gerente: string; cr_codigo: string; cr_nome: string
  cpf_hash: string; colaborador_nome: string
  vl_ausencias_descontadas: number | string | null
  vl_ausencias_abonadas: number | string | null
  vl_devolucoes: number | string | null
  total_ausencias_devolucoes: number | string | null
  vl_verbas_salariais: number | string | null
  importado_em?: string | null
}

const numero = (v: number | string | null | undefined) => v == null ? 0 : Number(v)
const chaveMes = (date: string) => date.slice(0, 7)
const validarMes = (mes: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error("Mês inválido; use o formato YYYY-MM.")
}
const mesOffset = (mes: string, delta: number) => {
  const [ano, m] = mes.split("-").map(Number)
  const data = new Date(Date.UTC(ano, m - 1 + delta, 1))
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`
}
const resumoVazio = (): ResumoGps => ({ geral: null, injustificado: null, justificado: null, colaboradores: 0, descontadas: 0, abonadas: 0, devolucoes: 0, verbas: 0 })

function resumo(rows: LinhaGps[]): ResumoGps {
  if (!rows.length) return resumoVazio()
  const soma = (campo: keyof LinhaGps) => rows.reduce((acc, row) => acc + numero(row[campo] as number | string | null), 0)
  const descontadas = soma("vl_ausencias_descontadas")
  const abonadas = soma("vl_ausencias_abonadas")
  const devolucoes = soma("vl_devolucoes")
  const verbas = soma("vl_verbas_salariais")
  const taxa = (n: number) => verbas === 0 ? null : 100 * n / verbas
  return {
    geral: taxa(soma("total_ausencias_devolucoes")),
    injustificado: taxa(descontadas - devolucoes),
    justificado: taxa(abonadas),
    colaboradores: new Set(rows.map((r) => r.cpf_hash)).size,
    descontadas, abonadas, devolucoes, verbas,
  }
}

/** Agregador puro para regras e cenários de histórico sem conexão com banco. */
export function agregarDashboardGps(rows: LinhaGps[], filtros: FiltrosGps): DashboardGps {
  validarMes(filtros.mes)
  const mesAnterior = mesOffset(filtros.mes, -1)
  const inicioEvolucao = mesOffset(filtros.mes, -11)
  const noPeriodo = rows.filter((r) => chaveMes(r.competencia) >= inicioEvolucao && chaveMes(r.competencia) <= filtros.mes
    && (!filtros.gerente || r.gerente === filtros.gerente) && (!filtros.cr || r.cr_codigo === filtros.cr))
  const doMes = noPeriodo.filter((r) => chaveMes(r.competencia) === filtros.mes)
  const filtradas = doMes
  const anteriorRows = noPeriodo.filter((r) => chaveMes(r.competencia) === mesAnterior)
  const porMes = new Map<string, LinhaGps[]>()
  for (const row of noPeriodo) {
    const mes = chaveMes(row.competencia)
    const grupo = porMes.get(mes)
    if (grupo) grupo.push(row)
    else porMes.set(mes, [row])
  }
  const evolucao: EvolucaoGps[] = Array.from({ length: 12 }, (_, i) => {
    const mes = mesOffset(filtros.mes, i - 11)
    return { mes, ...resumo(porMes.get(mes) ?? []) }
  })
  const grupos = new Map<string, LinhaGps[]>()
  for (const row of filtradas) {
    const k = JSON.stringify([row.cpf_hash, row.cr_codigo, row.gerente])
    const grupo = grupos.get(k)
    if (grupo) grupo.push(row)
    else grupos.set(k, [row])
  }
  const colaboradores: ColaboradorGps[] = [...grupos.entries()].map(([key, grupo]) => {
    const primeiro = grupo[0]
    const agregado = resumo(grupo)
    return {
      id: createHash("sha256").update(key).digest("hex").slice(0, 24),
      nome: primeiro.colaborador_nome, gerente: primeiro.gerente,
      crCodigo: primeiro.cr_codigo, crNome: primeiro.cr_nome,
      geral: agregado.geral, injustificado: agregado.injustificado, justificado: agregado.justificado,
      descontadas: agregado.descontadas, abonadas: agregado.abonadas, verbas: agregado.verbas,
    }
  }).sort((a, b) => (b.geral ?? -Infinity) - (a.geral ?? -Infinity) || a.nome.localeCompare(b.nome, "pt-BR"))
  const importacoes = noPeriodo.map((r) => r.importado_em).filter((v): v is string => Boolean(v)).sort()
  return {
    mes: filtros.mes, mesAnterior, atual: resumo(filtradas),
    anterior: anteriorRows.length ? resumo(anteriorRows.filter((r) => (!filtros.gerente || r.gerente === filtros.gerente) && (!filtros.cr || r.cr_codigo === filtros.cr))) : null,
    evolucao, colaboradores, atualizadoEm: importacoes.at(-1) ?? null,
  }
}

const SQL_COLUNAS = `competencia::text, gerente, cr_codigo, cr_nome, cpf_hash, colaborador_nome,
  vl_ausencias_descontadas, vl_ausencias_abonadas, vl_devolucoes,
  total_ausencias_devolucoes, vl_verbas_salariais, importado_em::text`

/** Todas as opções vêm exclusivamente de linhas dentro do escopo recebido. */
export async function getOpcoesAbsenteismoGps(escopo: EscopoDados): Promise<OpcoesGps> {
  if (escopo.tipo === "lista" && !escopo.crs.length) return { meses: [], gerentes: [], crs: [] }
  const pred = predicadoSraCr(escopo, "t.cr_codigo", 1)
  const { rows } = await inhausPool.query<{ competencia: string; gerente: string; cr_codigo: string; cr_nome: string }>(
    `select distinct to_char(t.competencia, 'YYYY-MM') as competencia, t.gerente, t.cr_codigo, t.cr_nome
       from public.tb_absenteismo t where true${pred.sql}
      order by competencia desc, t.gerente, t.cr_codigo`, pred.params,
  )
  assertLinhasNoEscopo(rows, (r) => r.cr_codigo, escopo)
  const meses = [...new Set(rows.map((r) => r.competencia))].sort().reverse()
  const gerentes = [...new Set(rows.map((r) => r.gerente))].sort((a, b) => a.localeCompare(b, "pt-BR"))
  const crs = [...new Map(rows.map((r) => [r.cr_codigo, { codigo: r.cr_codigo, nome: r.cr_nome }])).values()]
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"))
  return { meses, gerentes, crs }
}

export async function getDashboardAbsenteismoGps(filtros: FiltrosGps, escopo: EscopoDados): Promise<DashboardGps> {
  validarMes(filtros.mes)
  const vazio = agregarDashboardGps([], filtros)
  if (escopo.tipo === "lista" && !escopo.crs.length) return vazio
  const inicio = `${mesOffset(filtros.mes, -11)}-01`
  const fim = `${mesOffset(filtros.mes, 1)}-01`
  const pred = predicadoSraCr(escopo, "t.cr_codigo", 3)
  const { rows } = await inhausPool.query<LinhaGps>(
    `select ${SQL_COLUNAS} from public.tb_absenteismo t
      where t.competencia >= $1::date and t.competencia < $2::date${pred.sql}
      order by t.competencia, t.cr_codigo, t.gerente, t.cpf_hash`,
    [inicio, fim, ...pred.params],
  )
  assertLinhasNoEscopo(rows, (r) => r.cr_codigo, escopo)
  return agregarDashboardGps(rows, filtros)
}
