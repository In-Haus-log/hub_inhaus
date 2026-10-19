import { TYPES_OCORRENCIA, type LinhaConformidadeLegal } from "@/lib/conformidade-legal-modelo"

export type DimensaoConformidade = "regional" | "gerente" | "cr" | "supervisor" | "funcao" | "mes"
export type ColunaDinamica = "mes" | "tipo" | "nenhuma"
export type MetricaDinamica = "ocorrencias" | "pessoas"
export type ChaveTipoConformidade = (typeof TYPES_OCORRENCIA)[number]["key"]

export type ConfiguracaoDinamica = {
  linha: DimensaoConformidade
  segundaLinha?: DimensaoConformidade | "nenhuma"
  coluna: ColunaDinamica
  metrica: MetricaDinamica
  tipo?: string | null
}

export type ColunaPivot = { chave: string; rotulo: string }
export type LinhaPivot = { chave: string; rotulos: string[]; valores: number[]; total: number }
export type ResultadoPivot = { colunas: ColunaPivot[]; linhas: LinhaPivot[]; totaisColuna: number[]; total: number }

const DIMENSOES: Record<DimensaoConformidade, (linha: LinhaConformidadeLegal) => string | null> = {
  regional: (linha) => linha.regional,
  gerente: (linha) => linha.gerente,
  cr: (linha) => linha.cr ? `${linha.cr} · ${nomeCentro(linha.cr, linha.crNome)}`.trim() : linha.crNome,
  supervisor: (linha) => linha.supervisor,
  funcao: (linha) => linha.funcao,
  mes: (linha) => linha.mes,
}

function valorDimensao(linha: LinhaConformidadeLegal, dimensao: DimensaoConformidade) {
  return DIMENSOES[dimensao](linha)?.trim() || "Não informado"
}

function nomeCentro(codigo: string, nome: string | null) {
  const descricao = nome?.trim() ?? ""
  const semCodigo = descricao.replace(new RegExp(`^${codigo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:[-–·:]\\s*)?`), "")
  return semCodigo || descricao || "Não informado"
}

function valorOcorrencias(linha: LinhaConformidadeLegal, tipo?: string | null) {
  if (tipo && TYPES_OCORRENCIA.some((item) => item.key === tipo)) {
    return Math.max(0, Number(linha[tipo as ChaveTipoConformidade]) || 0)
  }
  return TYPES_OCORRENCIA.reduce((total, item) => total + Math.max(0, Number(linha[item.key]) || 0), 0)
}

function colunasPivot(linhas: LinhaConformidadeLegal[], coluna: ColunaDinamica, tipo?: string | null): ColunaPivot[] {
  if (coluna === "nenhuma") return [{ chave: "total", rotulo: "Total" }]
  if (coluna === "tipo") {
    const tipos = tipo ? TYPES_OCORRENCIA.filter((item) => item.key === tipo) : TYPES_OCORRENCIA
    return tipos.map((item) => ({ chave: item.key, rotulo: item.label }))
  }
  return [...new Set(linhas.map((linha) => linha.mes))].sort().map((mes) => ({ chave: mes, rotulo: mes }))
}

/** Pivot puro: pessoas são conjuntos de pessoaId por célula, nunca somas de linhas. */
export function montarPivotConformidade(
  linhas: LinhaConformidadeLegal[],
  config: ConfiguracaoDinamica,
): ResultadoPivot {
  const colunas = colunasPivot(linhas, config.coluna, config.tipo)
  const agrupamentos = new Map<string, { rotulos: string[]; linhas: LinhaConformidadeLegal[] }>()
  for (const linha of linhas) {
    const rotulos = [valorDimensao(linha, config.linha)]
    if (config.segundaLinha && config.segundaLinha !== "nenhuma" && config.segundaLinha !== config.linha) {
      rotulos.push(valorDimensao(linha, config.segundaLinha))
    }
    const chave = JSON.stringify(rotulos)
    const grupo = agrupamentos.get(chave) ?? { rotulos, linhas: [] }
    grupo.linhas.push(linha)
    agrupamentos.set(chave, grupo)
  }

  const linhasPivot = [...agrupamentos.entries()].map(([chave, grupo]): LinhaPivot => {
    const valores = colunas.map((coluna) => {
      const correspondentes = grupo.linhas.filter((linha) => {
        if (config.coluna === "nenhuma") return true
        if (config.coluna === "mes") return linha.mes === coluna.chave
        if (config.coluna === "tipo") return coluna.chave === "total" || (Number(linha[coluna.chave as ChaveTipoConformidade]) || 0) > 0
        return true
      })
      if (config.metrica === "pessoas") {
        const ids = new Set(correspondentes.flatMap((linha) => linha.pessoaId ? [linha.pessoaId] : []))
        return ids.size
      }
      if (config.coluna === "tipo" && !config.tipo) {
        return correspondentes.reduce((total, linha) => total + Math.max(0, Number(linha[coluna.chave as ChaveTipoConformidade]) || 0), 0)
      }
      return correspondentes.reduce((total, linha) => total + valorOcorrencias(linha, config.tipo), 0)
    })
    const idsGrupo = new Set(grupo.linhas.flatMap((linha) => linha.pessoaId ? [linha.pessoaId] : []))
    const total = config.metrica === "pessoas" ? idsGrupo.size : grupo.linhas.reduce((soma, linha) => soma + valorOcorrencias(linha, config.tipo), 0)
    return { chave, rotulos: grupo.rotulos, valores, total }
  }).sort((a, b) => a.rotulos.join(" · ").localeCompare(b.rotulos.join(" · "), "pt-BR", { numeric: true }))

  const total = config.metrica === "pessoas"
    ? new Set(linhas.flatMap((linha) => linha.pessoaId ? [linha.pessoaId] : [])).size
    : linhas.reduce((soma, linha) => soma + valorOcorrencias(linha, config.tipo), 0)
  const totaisColuna = colunas.map((coluna) => {
    const correspondentes = linhas.filter((linha) => config.coluna === "mes" ? linha.mes === coluna.chave
      : config.coluna === "tipo" ? coluna.chave === "total" || (Number(linha[coluna.chave as ChaveTipoConformidade]) || 0) > 0
      : true)
    if (config.metrica === "pessoas") return new Set(correspondentes.flatMap((linha) => linha.pessoaId ? [linha.pessoaId] : [])).size
    if (config.coluna === "tipo" && !config.tipo) return correspondentes.reduce((soma, linha) => soma + (Number(linha[coluna.chave as ChaveTipoConformidade]) || 0), 0)
    return correspondentes.reduce((soma, linha) => soma + valorOcorrencias(linha, config.tipo), 0)
  })
  return { colunas, linhas: linhasPivot, totaisColuna, total }
}

/** CSV RFC 4180 com neutralização de fórmulas e quebra de linha nas células. */
export function gerarCsvSeguro(linhas: (string | number | null | undefined)[][]): string {
  return linhas.map((linha) => linha.map((valor) => {
    let texto = valor == null ? "" : String(valor)
    if (/^[\s]*[=+\-@]/.test(texto) || /[\r\n]/.test(texto)) texto = `'${texto}`
    return `"${texto.replace(/"/g, '""')}"`
  }).join(",")).join("\r\n")
}
