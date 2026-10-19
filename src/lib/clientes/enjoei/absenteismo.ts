import { inhausPool } from "@/lib/db-inhaus"
import { assertLinhasNoEscopo, type EscopoDados } from "@/lib/seguranca/escopo-dados"
import { VINCULOS_PONTO_SQL, condicaoCorteDesligamentoSql } from "@/lib/ponto-desligamento"

/** CR único do portal Enjoei (valor bruto da coluna `cr`). Ponto único de manutenção. */
export const CR_ENJOEI = "68732 - SP - LOG - ENJOEI - CABREUVA"

/** Escopo fail-closed do portal Enjoei: apenas o código de CR 68732. */
const ESCOPO_ENJOEI: EscopoDados = { tipo: "lista", crs: ["68732"] }

/** Corte inclusivo por matrícula e CR, compartilhado com o painel geral. */
const CONDICAO_CORTE_DESLIGAMENTO_SQL = condicaoCorteDesligamentoSql()

/**
 * Leitura do ponto real da Enjoei (tabela public.ft_ponto_smartcontrol no
 * db_inhaus), filtrada no CR '68732 - SP - LOG - ENJOEI - CABREUVA'.
 * Regra da coluna `entrada`:
 *  - hora (ex.: "08:04")  → presença
 *  - "FALTA"              → falta
 *  - vazio / "NaN" / nulo → folga / sem registro
 *
 * TODOS os cargos entram na análise — sem exclusão de categorias profissionais.
 * Este indicador NÃO tem meta de absenteísmo definida.
 *
 * Isolamento por CR com DUAS travas: (1) filtro `where cr = $N` em toda query
 * ao banco; (2) `assertLinhasNoEscopo` conferindo defensivamente, na leitura
 * do quadro do mês, que nenhuma linha veio de fora do escopo.
 *
 * A tabela não tem coluna `turno` nem `importado_em`/`observacoes` — por isso
 * este indicador não tem quebra por turno, e a "aderência"/"absenteísmo" usam
 * como denominador os colaboradores ESCALADOS no dia (presença + falta), em
 * vez de um quadro contratado fixo.
 */

export type CellStatus = "presente" | "falta" | "folga" | "ferias"

/** Célula da grade: status do dia + motivo (para o tooltip). */
export type Celula = {
  status: CellStatus
  motivo: string | null
}

export type DiaInfo = {
  iso: string // YYYY-MM-DD
  label: string // DD/MM
  semana: string // SEG, TER, ...
  fimDeSemana: boolean
}

export type Headcount = {
  colaboradores: string[]
  dias: DiaInfo[]
  celulas: Record<string, Record<string, Celula>> // celulas[colaborador][iso]
  totalFaltas: number // total de faltas no mês
  quadro: number // colaboradores distintos no mês
  presencasPorDia: number
  pctPresencas: number
  periodo: { inicio: string; fim: string } | null
}

export type TimelinePonto = {
  dia: string
  presentes: number
  faltas: number
  escalados: number // presentes + faltas no dia
  absenteismo: number // % de faltas sobre os escalados no dia
  domingo: boolean // domingo não tem operação — escondido nos gráficos de presença/absenteísmo/faltas
  // Aderência = presenças ÷ escalados no dia. null nos dias sem escala → sem barra.
  aderencia: number | null
}
export type PresencasTimeline = {
  pontos: TimelinePonto[]
  // % do mês: média das taxas diárias, só dias com operação (escalados > 0)
  mediaAbsenteismo: number
  aderenciaMediaGeral: number
}

/**
 * Data máxima permitida nas consultas ao ponto (D-1, no fuso America/Sao_Paulo).
 * O ponto do dia corrente ainda não está fechado (batidas em aberto), o que
 * distorce KPIs/gráficos/grade — por isso toda consulta à tabela exclui "hoje".
 * Calculado em Node (não `new Date()` cru, não CURRENT_DATE do Postgres) para
 * não depender do fuso horário do servidor de banco.
 */
export function getMaxAllowedDate(): string {
  const hojeSP = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()) // YYYY-MM-DD (hoje em SP)
  const [ano, mes, dia] = hojeSP.split("-").map(Number)
  // Usa UTC para o cálculo do dia anterior (evita cair em DST/half-hour edge cases).
  const ontem = new Date(Date.UTC(ano, mes - 1, dia))
  ontem.setUTCDate(ontem.getUTCDate() - 1)
  const yyyy = ontem.getUTCFullYear()
  const mm = String(ontem.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(ontem.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

const HORA = /^\d{1,2}:\d{2}/

/** Arredonda para 1 casa decimal (ex.: 2.44 → 2.4). */
const uma_casa = (v: number) => Math.round((v + Number.EPSILON) * 10) / 10

const up = (s: string | null) => (s ?? "").toUpperCase()
/** Detecta FÉRIAS com ou sem acento. */
const temFerias = (s: string) => s.includes("FERIA") || s.includes("FÉRIA")

/** Limpa valores de texto do ponto: "NaN"/vazio viram null. */
export function limparTexto(s: string | null): string | null {
  if (s == null) return null
  const t = s.trim()
  if (t === "" || t.toUpperCase() === "NAN") return null
  return t
}

/**
 * Classifica o dia do colaborador.
 * - Férias: a escala (h_contratual) ou o motivo indicam FÉRIAS.
 * - Folga: a escala (h_contratual) do dia está marcada como FOLGA.
 * - Presença: bateu o ponto de entrada (há um horário).
 * - Falta: entrada = "FALTA".
 * - Caso contrário (sem registro / dia não escalado): folga.
 */
export function classificar(
  entrada: string | null,
  hContratual: string | null,
  motivo: string | null,
): CellStatus {
  const hc = up(hContratual)
  const mo = up(motivo)
  if (temFerias(hc) || temFerias(mo)) return "ferias"
  if (hc.includes("FOLGA")) return "folga"
  if (!entrada) return "folga"
  const e = entrada.trim()
  if (e === "" || e.toUpperCase() === "NAN") return "folga"
  if (e.toUpperCase() === "FALTA") return "falta"
  if (HORA.test(e)) return "presente"
  return "folga"
}

type Linha = {
  colaborador: string | null
  iso: string
  entrada: string | null
  h_contratual: string | null
  motivo_abono_dispensa: string | null
  cr: string | null
}

/** Meses (YYYY-MM) presentes na coluna `data`, do mais recente para o mais antigo. */
export async function getMesesDisponiveis(): Promise<string[]> {
  const { rows } = await inhausPool.query<{ mes: string }>(
    `with ${VINCULOS_PONTO_SQL}
    select distinct to_char(p.data, 'YYYY-MM') as mes
       from public.ft_ponto_smartcontrol p

      where p.cr = $1
        and p.data <= $2
      ${CONDICAO_CORTE_DESLIGAMENTO_SQL}
      order by mes desc`,
    [CR_ENJOEI, getMaxAllowedDate()],
  )
  return rows.map((r) => r.mes)
}

export async function getHeadcount(mes: string): Promise<Headcount> {
  const { rows } = await inhausPool.query<Linha>(
    `with ${VINCULOS_PONTO_SQL}
    select p.colaborador,
            to_char(p.data, 'YYYY-MM-DD') as iso,
            p.entrada,
            p.h_contratual,
            p.motivo_abono_dispensa,
            p.cr
       from public.ft_ponto_smartcontrol p

      where to_char(p.data, 'YYYY-MM') = $1
        and p.cr = $2
        and p.data <= $3
      ${CONDICAO_CORTE_DESLIGAMENTO_SQL}
      order by p.colaborador, p.data`,
    [mes, CR_ENJOEI, getMaxAllowedDate()],
  )
  assertLinhasNoEscopo(rows, (r) => r.cr, ESCOPO_ENJOEI)

  const colaboradoresSet = new Set<string>()
  const diasComRegistro = new Set<string>()
  const celulas: Record<string, Record<string, Celula>> = {}
  let presentes = 0
  let faltas = 0

  for (const r of rows) {
    const nome = (r.colaborador ?? "—").trim()
    colaboradoresSet.add(nome)
    diasComRegistro.add(r.iso)

    const st = classificar(r.entrada, r.h_contratual, r.motivo_abono_dispensa)
    if (st === "presente") presentes += 1
    else if (st === "falta") faltas += 1

    ;(celulas[nome] ??= {})[r.iso] = {
      status: st,
      motivo: limparTexto(r.motivo_abono_dispensa),
    }
  }

  // Eixo X = todos os dias fixos do mês (dias sem registro ficam cinza na grade).
  const [anoStr, mesStr] = mes.split("-")
  const ano = Number(anoStr)
  const mesNum = Number(mesStr) // 1..12
  const totalDias = new Date(ano, mesNum, 0).getDate()
  const SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"]
  const dias: DiaInfo[] = []
  for (let d = 1; d <= totalDias; d++) {
    const dow = new Date(ano, mesNum - 1, d).getDay()
    const dd = String(d).padStart(2, "0")
    dias.push({
      iso: `${anoStr}-${mesStr}-${dd}`,
      label: `${dd}/${mesStr}`,
      semana: SEMANA[dow],
      fimDeSemana: dow === 0 || dow === 6,
    })
  }

  const colaboradores = Array.from(colaboradoresSet).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  )

  // Médias sobre os dias que têm registro (evita diluir com dias sem lançamento).
  const diasRegistrados = diasComRegistro.size
  const presencasPorDia = diasRegistrados ? Math.round(presentes / diasRegistrados) : 0
  const pctPresencas =
    presentes + faltas ? Math.round((presentes / (presentes + faltas)) * 100) : 0

  return {
    colaboradores,
    dias,
    celulas,
    totalFaltas: faltas,
    quadro: colaboradores.length,
    presencasPorDia,
    pctPresencas,
    periodo: dias.length
      ? { inicio: dias[0].label, fim: dias[dias.length - 1].label }
      : null,
  }
}

/**
 * Linha do tempo por dia do mês: presenças e faltas no dia.
 * Aderência = presenças ÷ escalados no dia (presenças + faltas), não há quadro
 * contratado fixo definido para a Enjoei.
 */
export async function getPresencasTimeline(mes: string): Promise<PresencasTimeline> {
  const { rows } = await inhausPool.query<{
    iso: string
    presentes: string
    faltas: string
    cr: string
  }>(
    `with ${VINCULOS_PONTO_SQL}
    select to_char(p.data, 'YYYY-MM-DD') as iso,
            p.cr,
            count(*) filter (where p.entrada ~ '^[0-9]{1,2}:[0-9]{2}') as presentes,
            count(*) filter (where upper(trim(p.entrada)) = 'FALTA') as faltas
       from public.ft_ponto_smartcontrol p

      where to_char(p.data, 'YYYY-MM') = $1
        and p.cr = $2
        and p.data <= $3
      ${CONDICAO_CORTE_DESLIGAMENTO_SQL}
      group by 1, p.cr`,
    [mes, CR_ENJOEI, getMaxAllowedDate()],
  )
  assertLinhasNoEscopo(rows, (r) => r.cr, ESCOPO_ENJOEI)
  const porIso = new Map(rows.map((r) => [r.iso, r]))

  const [anoStr, mesStr] = mes.split("-")
  const ano = Number(anoStr)
  const mesNum = Number(mesStr)
  const totalDias = new Date(ano, mesNum, 0).getDate()

  const pontos: TimelinePonto[] = []
  // Média = média das taxas diárias, só dias com operação (escalados > 0).
  let somaAbsenteismo = 0
  let diasComOperacao = 0
  let somaAderencia = 0
  let diasComAderencia = 0

  for (let d = 1; d <= totalDias; d++) {
    const domingo = new Date(ano, mesNum - 1, d).getDay() === 0
    const dd = String(d).padStart(2, "0")
    const r = porIso.get(`${anoStr}-${mesStr}-${dd}`)
    const presentes = Number(r?.presentes ?? 0)
    const faltas = Number(r?.faltas ?? 0)
    const escalados = presentes + faltas

    const aderencia = escalados > 0 ? Math.round((presentes / escalados) * 100) : null
    // 1 casa decimal para não esconder pequenas variações no absenteísmo.
    const absenteismo = escalados > 0 ? uma_casa((faltas / escalados) * 100) : 0

    pontos.push({ dia: dd, presentes, faltas, escalados, absenteismo, domingo, aderencia })

    if (escalados > 0) {
      somaAbsenteismo += faltas / escalados
      diasComOperacao += 1
    }
    if (aderencia != null) {
      somaAderencia += aderencia
      diasComAderencia += 1
    }
  }

  const mediaPct = (soma: number, dias: number) => (dias > 0 ? uma_casa((soma / dias) * 100) : 0)
  const mediaAd = (soma: number, dias: number) => (dias > 0 ? Math.round(soma / dias) : 0)

  return {
    pontos,
    mediaAbsenteismo: mediaPct(somaAbsenteismo, diasComOperacao),
    aderenciaMediaGeral: mediaAd(somaAderencia, diasComAderencia),
  }
}
