import { inhausPool } from "@/lib/db-inhaus"
import { classificar, getMaxAllowedDate, limparTexto } from "@/lib/clientes/enjoei/absenteismo"
import { assertLinhasNoEscopo, predicadoSraCr, type EscopoDados } from "@/lib/seguranca/escopo-dados"
import { VINCULOS_PONTO_SQL, condicaoCorteDesligamentoSql, codigoCrPontoSql } from "@/lib/ponto-desligamento"

/**
 * Absenteísmo geral, sem regional fixo e sem filtro por situação atual.
 * Elegibilidade até o desligamento inclusive, D-1 em São Paulo e escopo por CR.
 * Presenças e faltas definem os dias escalados; férias/folga não entram na taxa.
 * Taxa do período = faltas / (presenças + faltas), ponderada por dias-pessoa.
 * Gerente/cargo vêm do histórico SRA do ponto. Sem histórico, gerente usa o
 * cadastro atual do CR e cargo usa a categoria profissional do ponto.
 */
export type FiltrosAbsenteismo = { mes: string; gerentes: string[]; crs: string[]; cargos: string[] }
export type OpcoesAbsenteismo = { meses: string[]; gerentes: string[]; crs: string[]; cargos: string[] }
export type FatiaAbsenteismo = { rotulo: string; presencas: number; faltas: number; escalados: number; absenteismo: number }
export type DadosAbsenteismo = {
  colaboradores: number; presencas: number; faltas: number; escalados: number; absenteismo: number
  porDia: FatiaAbsenteismo[]; porCr: FatiaAbsenteismo[]; porGerente: FatiaAbsenteismo[]
}
type Ponto = {
  id?: number | string | null; matricula: string | null; colaborador: string | null
  data: string; entrada: string | null; h_contratual: string | null
  motivo_abono_dispensa: string | null; cr: string | null; gerente: string | null; cargo: string | null
}
const vazio = (): DadosAbsenteismo => ({ colaboradores: 0, presencas: 0, faltas: 0, escalados: 0, absenteismo: 0, porDia: [], porCr: [], porGerente: [] })
export function absenteismoPercentual(faltas: number, escalados: number): number {
  return escalados > 0 ? Math.round((faltas / escalados) * 1000) / 10 : 0
}
const texto = (v: string | null, fallback: string) => limparTexto(v) ?? fallback

export function agregarAbsenteismo(rows: Ponto[]): DadosAbsenteismo {
  const dados = vazio()
  const vistos = new Set<string>()
  const pessoas = new Set<string>()
  const diario = new Map<string, FatiaAbsenteismo>()
  const crs = new Map<string, FatiaAbsenteismo>()
  const gerentes = new Map<string, FatiaAbsenteismo>()
  for (const r of rows) {
    const identidade = r.id != null ? `id:${r.id}` : JSON.stringify([r.matricula, r.colaborador, r.cr, r.data, r.entrada, r.h_contratual, r.motivo_abono_dispensa])
    if (vistos.has(identidade)) continue
    vistos.add(identidade)
    // Matrícula identifica a pessoa sem contar uma transferência de CR duas vezes.
    pessoas.add(limparTexto(r.matricula) ?? `nome:${r.colaborador ?? r.id ?? identidade}`)
    const st = classificar(r.entrada, r.h_contratual, r.motivo_abono_dispensa)
    if (st !== "presente" && st !== "falta") continue
    if (st === "presente") dados.presencas++
    else dados.faltas++
    for (const [mapa, chave] of [[diario, r.data.slice(0, 10)], [crs, texto(r.cr, "Sem CR")], [gerentes, texto(r.gerente, "Sem gerente")]] as const) {
      const fatia = mapa.get(chave) ?? { rotulo: chave, presencas: 0, faltas: 0, escalados: 0, absenteismo: 0 }
      if (st === "presente") fatia.presencas++
      else fatia.faltas++
      fatia.escalados++
      fatia.absenteismo = absenteismoPercentual(fatia.faltas, fatia.escalados)
      mapa.set(chave, fatia)
    }
  }
  dados.colaboradores = pessoas.size
  dados.escalados = dados.presencas + dados.faltas
  dados.absenteismo = absenteismoPercentual(dados.faltas, dados.escalados)
  dados.porDia = [...diario.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo))
  const ordenarRanking = (mapa: Map<string, FatiaAbsenteismo>) => [...mapa.values()].sort((a, b) => b.absenteismo - a.absenteismo || b.escalados - a.escalados || a.rotulo.localeCompare(b.rotulo, "pt-BR"))
  dados.porCr = ordenarRanking(crs)
  dados.porGerente = ordenarRanking(gerentes)
  return dados
}

/** Intervalos de snapshots eliminam uma busca de histórico por cada linha do ponto. */
const DIMENSOES_SQL = `
  historico_ponto as materialized (
    select distinct on (btrim(h.matricula), ${codigoCrPontoSql("h.cr")}, h.data_referencia)
           btrim(h.matricula) as matricula, ${codigoCrPontoSql("h.cr")} as cr_codigo,
           h.data_referencia, h.gerente, h.descricao_funcao
      from public.ft_colaboradores_sra_diario h
     where nullif(btrim(h.matricula), '') is not null
     order by btrim(h.matricula), ${codigoCrPontoSql("h.cr")}, h.data_referencia,
              h.data_extracao desc nulls last, h.dt_admissao desc nulls last,
              h.gerente nulls last, h.descricao_funcao nulls last
  ),
  intervalos_ponto as (
    select *, lead(data_referencia, 1, 'infinity'::date)
       over (partition by matricula, cr_codigo order by data_referencia) as proxima_data
      from historico_ponto
  )
`
const GERENTE_SQL = "coalesce(nullif(btrim(s.gerente), ''), nullif(btrim(c.gerente), ''), 'Sem gerente')"
const CARGO_SQL = "coalesce(nullif(btrim(s.descricao_funcao), ''), nullif(btrim(p.categoria_profissional), ''), 'Sem cargo')"
const JOINS_DIMENSOES_SQL = `
  left join intervalos_ponto s on s.matricula = btrim(p.matricula)
    and s.cr_codigo = ${codigoCrPontoSql("p.cr")}
    and s.data_referencia <= p.data and p.data < s.proxima_data
  left join public.dm_cr c on c.cr = ${codigoCrPontoSql("p.cr")}
`

/** Todas as opções derivam de ponto elegível e do escopo, inclusive os meses. */
export async function getOpcoesAbsenteismo(escopo: EscopoDados): Promise<OpcoesAbsenteismo> {
  if (escopo.tipo === "lista" && !escopo.crs.length) return { meses: [], gerentes: [], crs: [], cargos: [] }
  const pred = predicadoSraCr(escopo, "p.cr", 2)
  const { rows } = await inhausPool.query<{ mes: string; gerente: string; cr: string | null; cargo: string }>(
    `with ${VINCULOS_PONTO_SQL}, ${DIMENSOES_SQL}
     select distinct to_char(p.data, 'YYYY-MM') as mes, p.cr,
            ${GERENTE_SQL} as gerente, ${CARGO_SQL} as cargo
       from public.ft_ponto_smartcontrol p ${JOINS_DIMENSOES_SQL}
      where p.data <= $1::date ${condicaoCorteDesligamentoSql()} ${pred.sql}`,
    [getMaxAllowedDate(), ...pred.params],
  )
  assertLinhasNoEscopo(rows, (r) => r.cr, escopo)
  const unicos = (lista: string[]) => [...new Set(lista)].sort((a, b) => a.localeCompare(b, "pt-BR"))
  return {
    meses: unicos(rows.map((r) => r.mes)).reverse(),
    gerentes: unicos(rows.map((r) => r.gerente)),
    crs: unicos(rows.flatMap((r) => r.cr ? [r.cr] : [])),
    cargos: unicos(rows.map((r) => r.cargo)),
  }
}

export async function getAbsenteismo(filtros: FiltrosAbsenteismo, escopo: EscopoDados): Promise<DadosAbsenteismo> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(filtros.mes)) throw new Error("Mês inválido; use o formato YYYY-MM.")
  if (escopo.tipo === "lista" && !escopo.crs.length) return vazio()
  const [ano, mes] = filtros.mes.split("-").map(Number)
  const inicio = `${filtros.mes}-01`
  const fim = `${filtros.mes}-${String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, "0")}`
  const limite = getMaxAllowedDate()
  const fimEfetivo = fim < limite ? fim : limite
  if (fimEfetivo < inicio) return vazio()
  const pred = predicadoSraCr(escopo, "p.cr", 6)
  const { rows } = await inhausPool.query<Ponto>(
    `with ${VINCULOS_PONTO_SQL}, ${DIMENSOES_SQL}
     select p.id, p.matricula, p.colaborador, p.data::text as data, p.entrada,
            p.h_contratual, p.motivo_abono_dispensa, p.cr,
            ${GERENTE_SQL} as gerente, ${CARGO_SQL} as cargo
       from public.ft_ponto_smartcontrol p ${JOINS_DIMENSOES_SQL}
      where p.data between $1::date and $2::date
        ${condicaoCorteDesligamentoSql()}
        and (cardinality($3::text[])=0 or ${GERENTE_SQL} = any($3::text[]))
        and (cardinality($4::text[])=0 or p.cr = any($4::text[]))
        and (cardinality($5::text[])=0 or ${CARGO_SQL} = any($5::text[]))${pred.sql}`,
    [inicio, fimEfetivo, filtros.gerentes, filtros.crs, filtros.cargos, ...pred.params],
  )
  assertLinhasNoEscopo(rows, (r) => r.cr, escopo)
  return agregarAbsenteismo(rows)
}
