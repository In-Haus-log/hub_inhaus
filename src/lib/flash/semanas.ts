/**
 * Semana do mês do Flash Report. Cada semana projeta o fechamento do MÊS inteiro.
 * Regra PROVISÓRIA (pendência do usuário): semana = ⌈dia ÷ 7⌉ → dias 1–7 = 1, …, 29–31 = 5.
 * Qualquer mudança de regra acontece SÓ aqui (e no texto do info).
 */
export type Periodo = { mes: string; semana: number }

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

function partesSaoPaulo(data: Date): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(data).split("-").map(Number)
  return { ano, mes, dia }
}

const doisDigitos = (n: number) => String(n).padStart(2, "0")

export function semanaDoMes(data: Date): Periodo {
  const { ano, mes, dia } = partesSaoPaulo(data)
  return { mes: `${ano}-${doisDigitos(mes)}`, semana: Math.ceil(dia / 7) }
}

function diasNoMes(mes: string): number {
  const [ano, m] = mes.split("-").map(Number)
  return new Date(Date.UTC(ano, m, 0)).getUTCDate()
}

export function semanasDoMes(mes: string): number[] {
  return Array.from({ length: Math.ceil(diasNoMes(mes) / 7) }, (_, i) => i + 1)
}

export function periodoAnterior(p: Periodo): Periodo {
  if (p.semana > 1) return { mes: p.mes, semana: p.semana - 1 }
  const [ano, m] = p.mes.split("-").map(Number)
  const mesAnt = m === 1 ? `${ano - 1}-12` : `${ano}-${doisDigitos(m - 1)}`
  const semanas = semanasDoMes(mesAnt)
  return { mes: mesAnt, semana: semanas[semanas.length - 1] }
}

export function rotuloPeriodo(p: Periodo): string {
  const [ano, m] = p.mes.split("-").map(Number)
  return `${MESES[m - 1]}/${ano} · Semana ${p.semana}`
}

export const mesParaData = (mes: string) => `${mes}-01`
