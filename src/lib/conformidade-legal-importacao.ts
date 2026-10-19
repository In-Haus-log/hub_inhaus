import "server-only"
import ExcelJS from "exceljs"
import JSZip from "jszip"
import crypto from "node:crypto"
import path from "node:path"
import { inhausPool } from "@/lib/db-inhaus"

const CABECALHOS = [
  "MES/ANO", "GERENTE REGIONAL", "GERENTE", "CR", "SUPERVISOR", "FUNCAO",
  "COLABORADOR", "INTERJORNADA", "LIMITE HR DIA", "LIMITE HR DIA EXCECAO",
  "FOLGA SEMANAL", "12X36 LIMITE FT MES", "FERIAS COM PONTO",
  "TOTAL OCORRENCIAS", "TOTAL PROCESSOS", "PROCESSOS ENCERRADOS",
  "TICKET MEDIO ENCERRADO",
]
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
const MAX_ARQUIVO = 4 * 1024 * 1024
const MAX_LINHAS = 100_000

type Celula = string | number | null
export type LinhaImportacaoConformidade = [
  string, string, string, string, string, string, string, string, string,
  number | null, number | null, number | null, number | null, number | null,
  number | null, number | null, number | null, number | null, number | null, number | null, number,
]
export type DadosImportacaoConformidade = {
  rows: LinhaImportacaoConformidade[]
  totaisRemovidos: number
  filtros: string
  somas: number[]
  competencias: string[]
}
export class ErroArquivoImportacao extends Error { readonly nome = "ErroArquivoImportacao" }

const ESCOPO_HASH_PERIODO_COMPLETO = "conformidade_legal_periodo_completo_v1"
const COLUNAS_CONTEUDO = [
  "competencia", "gerente_regional", "gerente", "cr_cod", "cr_nome", "supervisor", "funcao", "cpf_hash", "colaborador_nome",
  "interjornada", "limite_hr_dia", "limite_hr_dia_excecao", "folga_semanal", "x12x36_limite_ft_mes", "ferias_com_ponto",
  "total_ocorrencias", "total_processos", "processos_encerrados", "ticket_medio_encerrado",
] as const

function normalizarNumero(valor: unknown, nuloComoZero: boolean): string | null {
  if (valor === null || valor === undefined || valor === "") return nuloComoZero ? "0" : null
  const numero = typeof valor === "number" ? valor : Number(String(valor).trim())
  return Number.isFinite(numero) ? String(Object.is(numero, -0) ? 0 : numero) : String(valor)
}

/** Espelha numeric(18,4) do PostgreSQL, inclusive arredondamento decimal de empates. */
function normalizarTicket(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "<null>"
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return String(valor)
  const [mantissa, expoente = "0"] = String(Math.abs(numero)).toLowerCase().split("e")
  const [inteiro, fracao = ""] = mantissa.split(".")
  const digitos = BigInt(inteiro + fracao)
  const deslocamento = 4 - fracao.length + Number(expoente)
  const potencia = BigInt("1" + "0".repeat(Math.abs(deslocamento)))
  const arredondado = deslocamento >= 0 ? digitos * potencia : (digitos + potencia / BigInt(2)) / potencia
  return String(numero < 0 ? -arredondado : arredondado)
}

function normalizarLinhaConteudo(row: unknown[]): string[] {
  return row.slice(0, 9).map((valor) => String(valor ?? "").trim()).concat(
    row.slice(9, 18).map((valor) => normalizarNumero(valor, true)!),
    [normalizarTicket(row[18])],
  )
}

export function canonicalizarConteudoCompetencia(rows: unknown[][]): string {
  return JSON.stringify(rows.map(normalizarLinhaConteudo).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
}

function normalizar(valor: unknown): string {
  return String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase()
}

function valorCelula(valor: ExcelJS.CellValue): Celula {
  if (valor === null || valor === undefined || valor === "") return null
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null
  if (typeof valor === "string") return valor.trim() || null
  if (valor instanceof Date) return valor.toISOString()
  if (typeof valor === "object" && "richText" in valor) return valor.richText.map((parte) => parte.text).join("").trim() || null
  if (typeof valor === "object" && "text" in valor && typeof valor.text === "string") return valor.text.trim() || null
  if (typeof valor === "object" && "result" in valor) return valorCelula(valor.result as ExcelJS.CellValue)
  return String(valor)
}

function rejeitarFormulas(sheet: ExcelJS.Worksheet) {
  sheet.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
    if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.SharedString && typeof cell.value === "object" && cell.value && "formula" in cell.value) {
      throw new Error(`Fórmulas não são permitidas (linha ${row.number}).`)
    }
  }))
}

function letraColuna(indice: number) {
  let n = indice
  let letra = ""
  while (n > 0) { const resto = (n - 1) % 26; letra = String.fromCharCode(65 + resto) + letra; n = Math.floor((n - 1) / 26) }
  return letra
}
function indiceColuna(letra: string) {
  return [...letra].reduce((n, caractere) => n * 26 + caractere.charCodeAt(0) - 64, 0)
}

async function normalizarXlsxSemReferencias(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer)
  const limiteXmlDescompactado = 30 * 1024 * 1024
  const bytesXml = Object.values(zip.files).reduce((total, arquivo) => {
    const tamanho = (arquivo as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
    return total + tamanho
  }, 0)
  if (bytesXml > limiteXmlDescompactado) throw new Error("O conteúdo XLSX excede o limite de processamento.")
  const atualizacoes: Promise<void>[] = []
  zip.forEach((nome, arquivo) => {
    if (!nome.endsWith(".xml") && !nome.endsWith(".rels")) return
    atualizacoes.push(arquivo.async("string").then((origem) => {
      let xml = origem.replace(/^\uFEFF/, "").replace(/(<\/?)(?:x):/g, "$1").replace(/xmlns:x=/g, "xmlns=")
      if (/^xl\/worksheets\/sheet\d+\.xml$/.test(nome)) {
        let sequenciaLinha = 0
        xml = xml.replace(/<row\b([^>]*?)(\/?)>/g, (_tag, atributos: string, fechamento: string) => {
          const matchLinha = atributos.match(/\br="(\d+)"/)
          const numeroLinha = matchLinha ? Number(matchLinha[1]) : ++sequenciaLinha
          if (matchLinha) sequenciaLinha = numeroLinha
          const novasAtributos = matchLinha ? atributos : `${atributos} r="${numeroLinha}"`
          return `<row${novasAtributos}${fechamento}>`
        })
        xml = xml.replace(/<row\b((?:(?!\/>)[^>])*)>([\s\S]*?)<\/row>/g, (_bloco, atributos: string, conteudo: string) => {
          const numeroLinha = Number(atributos.match(/\br="(\d+)"/)?.[1])
          let coluna = 0
          const novasCelulas = conteudo.replace(/<c\b([^>]*)>/g, (_tag, celulaAttrs: string) => {
            const referencia = celulaAttrs.match(/\br="([A-Z]+)\d+"/)
            coluna = referencia ? indiceColuna(referencia[1]) : coluna + 1
            if (/\br="[A-Z]+\d+"/.test(celulaAttrs)) return `<c${celulaAttrs}>`
            const vazia = /\/\s*$/.test(celulaAttrs)
            const atributosCelula = vazia ? celulaAttrs.replace(/\/\s*$/, "") : celulaAttrs
            return `<c${atributosCelula} r="${letraColuna(coluna)}${numeroLinha}"${vazia ? "/" : ""}>`
          })
          return `<row${atributos}>${novasCelulas}</row>`
        })
      }
      zip.file(nome, xml)
    }))
  })
  await Promise.all(atualizacoes)
  return zip.generateAsync({ type: "nodebuffer" })
}

async function analisarPlanilhaInterno(buffer: Buffer, segredo: string): Promise<DadosImportacaoConformidade> {
  if (!segredo) throw new Error("Configuração de segurança indisponível para importar o arquivo.")
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_ARQUIVO) throw new Error("O arquivo está vazio ou excede o limite de 4 MB.")
  const workbook = new ExcelJS.Workbook()
  try {
    const normalizado = await normalizarXlsxSemReferencias(buffer)
    await workbook.xlsx.load(normalizado as unknown as Parameters<typeof workbook.xlsx.load>[0])
  } catch { throw new Error("Não foi possível ler o XLSX. Confira se o arquivo não está corrompido.") }
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error("A planilha não contém uma aba de dados.")
  if (sheet.rowCount > MAX_LINHAS) throw new Error("O arquivo excede o limite de linhas aceito para importação.")
  rejeitarFormulas(sheet)

  // ExcelJS devolve o valor mestre também ao ler cada célula de um intervalo mesclado.

  let linhaCabecalho = 0
  sheet.eachRow({ includeEmpty: false }, (row) => {
    if (!linhaCabecalho && CABECALHOS.every((h, i) => normalizar(valorCelula(row.getCell(i + 1).value)) === h)) linhaCabecalho = row.number
  })
  if (!linhaCabecalho) throw new Error("Cabeçalho incompatível: o arquivo precisa conter os 17 campos do modelo de conformidade legal.")

  const linhas: Celula[][] = []
  for (let i = linhaCabecalho; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i)
    const valores = Array.from({ length: 17 }, (_, j) => valorCelula(row.getCell(j + 1).value))
    linhas.push(valores)
  }
  const rows: LinhaImportacaoConformidade[] = []
  const vistos = new Set<string>()
  let totaisRemovidos = 0
  let filtros: string | null = null
  const controles: (number | null)[][] = []

  for (let offset = 1; offset < linhas.length; offset++) {
    const r = linhas[offset]
    const numeroLinha = linhaCabecalho + offset
    if (r.every((v) => v === null)) continue
    const textoFiltro = r.find((v) => typeof v === "string" && normalizar(v).startsWith("FILTROS APLICADOS:"))
    if (textoFiltro) { filtros = String(textoFiltro); continue }
    if (r.slice(0, 7).some((v) => normalizar(v) === "TOTAL")) {
      totaisRemovidos++
      if (normalizar(r[0]) === "TOTAL") controles.push(r.slice(7, 14).map((v) => v === null ? null : Number(v)))
      continue
    }
    if (r.slice(0, 7).some((v) => typeof v !== "string" || !v.trim())) throw new Error(`Há hierarquia incompleta na linha ${numeroLinha}.`)
    const matchMes = normalizar(r[0]).match(/^([A-Z]{3})\s+(\d{4})$/)
    const mes = matchMes ? MESES.indexOf(matchMes[1]) : -1
    if (!matchMes || mes < 0) throw new Error(`Competência inválida na linha ${numeroLinha}.`)
    const competencia = `${matchMes[2]}-${String(mes + 1).padStart(2, "0")}-01`
    const cr = String(r[3]).match(/^([A-Za-z0-9]{1,5})\s*-\s*(.+)$/)
    const pessoa = String(r[6]).match(/^(\d{11})\s*-\s*(.+)$/)
    if (!cr || !pessoa) throw new Error(`CR ou identificador de colaborador inválido na linha ${numeroLinha}.`)
    const cpfHash = crypto.createHmac("sha256", segredo).update(pessoa[1]).digest("hex")
    const dimensoes = [competencia, String(r[1]), String(r[2]), cr[1].padStart(5, "0"), String(r[3]), String(r[4]), String(r[5]), cpfHash, pessoa[2]]
    const chave = JSON.stringify(dimensoes)
    if (vistos.has(chave)) throw new Error(`Registro duplicado na linha ${numeroLinha}.`)
    vistos.add(chave)
    const metricas = r.slice(7, 17).map((v, index) => {
      if (v === null) return null
      if (typeof v !== "number" || !Number.isFinite(v) || (index < 9 && (!Number.isInteger(v) || v < 0))) throw new Error(`Indicador inválido na linha ${numeroLinha}.`)
      return v
    })
    if (metricas.slice(0, 6).reduce<number>((sum, v) => sum + (v ?? 0), 0) !== metricas[6]) throw new Error(`Ocorrências inconsistentes na linha ${numeroLinha}.`)
    rows.push([...dimensoes, ...metricas, numeroLinha] as LinhaImportacaoConformidade)
    if (rows.length > MAX_LINHAS) throw new Error("O arquivo excede o limite de linhas aceito para importação.")
  }
  if (!rows.length || !filtros) throw new Error("O arquivo não contém detalhes ou filtros da extração.")
  const somas = Array.from({ length: 7 }, (_, c) => rows.reduce((sum, row) => sum + ((row[9 + c] as number | null) ?? 0), 0))
  if (controles.length !== 1 || controles[0].some((v, c) => (v ?? 0) !== somas[c])) throw new Error("Os detalhes não conferem com o total geral de ocorrências do arquivo.")
  return { rows, totaisRemovidos, filtros, somas, competencias: [...new Set(rows.map((r) => r[0]))].sort() }
}

export async function analisarPlanilhaConformidade(buffer: Buffer, segredo: string): Promise<DadosImportacaoConformidade> {
  try { return await analisarPlanilhaInterno(buffer, segredo) }
  catch (error) {
    if (error instanceof ErroArquivoImportacao) throw error
    throw new ErroArquivoImportacao(error instanceof Error ? error.message : "Não foi possível validar o arquivo.")
  }
}

export async function importarConformidadeLegal(buffer: Buffer, nomeArquivo: string, segredo: string) {
  const dados = await analisarPlanilhaConformidade(buffer, segredo)
  const arquivoHash = crypto.createHash("sha256").update(buffer).digest("hex")
  const escopoHash = ESCOPO_HASH_PERIODO_COMPLETO
  const client = await inhausPool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(hashtext('conformidade_legal_import'))")
    const existente = await client.query("SELECT id FROM public.ft_conformidade_legal_carga WHERE arquivo_sha256=$1 AND escopo_hash=$2 AND status='COMPLETA'", [arquivoHash, escopoHash])
    if (existente.rowCount) {
      await client.query("ROLLBACK")
      return { registros: 0, totaisRemovidos: dados.totaisRemovidos, ocorrencias: 0, competencias: [], competenciasIgnoradas: dados.competencias, duplicado: true }
    }
    const atuais = await client.query<Record<string, unknown>>(
      `SELECT ${COLUNAS_CONTEUDO.join(",")} FROM public.vw_conformidade_legal WHERE competencia::text = ANY($1::text[])`,
      [dados.competencias],
    )
    const atuaisPorCompetencia = new Map<string, unknown[][]>()
    for (const row of atuais.rows) {
      const competencia = String(row.competencia).slice(0, 10)
      const conteudo = COLUNAS_CONTEUDO.map((coluna) => row[coluna])
      atuaisPorCompetencia.set(competencia, [...(atuaisPorCompetencia.get(competencia) ?? []), conteudo])
    }
    const incomingPorCompetencia = new Map<string, LinhaImportacaoConformidade[]>()
    for (const row of dados.rows) incomingPorCompetencia.set(row[0], [...(incomingPorCompetencia.get(row[0]) ?? []), row])
    const competenciasIgnoradas: string[] = []
    const rowsGravar: LinhaImportacaoConformidade[] = []
    for (const competencia of dados.competencias) {
      const rows = incomingPorCompetencia.get(competencia) ?? []
      const atuaisDaCompetencia = atuaisPorCompetencia.get(competencia)
      if (atuaisDaCompetencia && canonicalizarConteudoCompetencia(rows) === canonicalizarConteudoCompetencia(atuaisDaCompetencia)) {
        competenciasIgnoradas.push(competencia)
      } else rowsGravar.push(...rows)
    }
    if (!rowsGravar.length) {
      await client.query("ROLLBACK")
      return { registros: 0, totaisRemovidos: dados.totaisRemovidos, ocorrencias: 0, competencias: [], competenciasIgnoradas, duplicado: true }
    }
    const competenciasGravadas = dados.competencias.filter((competencia) => !competenciasIgnoradas.includes(competencia))
    const ocorrenciasGravadas = rowsGravar.reduce((total, row) => total + (row[15] ?? 0), 0)
    const carga = await client.query<{ id: string }>(
      "INSERT INTO public.ft_conformidade_legal_carga (arquivo_nome,arquivo_sha256,escopo_hash,filtros,status,quantidade) VALUES ($1,$2,$3,$4,'PROCESSANDO',$5) RETURNING id",
      [path.basename(nomeArquivo).slice(0, 255), arquivoHash, escopoHash, JSON.stringify({ texto: dados.filtros }), rowsGravar.length],
    )
    const cargaId = carga.rows[0].id
    const colunas = "competencia,gerente_regional,gerente,cr_cod,cr_nome,supervisor,funcao,cpf_hash,colaborador_nome,interjornada,limite_hr_dia,limite_hr_dia_excecao,folga_semanal,x12x36_limite_ft_mes,ferias_com_ponto,total_ocorrencias,total_processos,processos_encerrados,ticket_medio_encerrado,linha_origem"
    for (let inicio = 0; inicio < rowsGravar.length; inicio += 100) {
      const lote = rowsGravar.slice(inicio, inicio + 100).map((row) => [cargaId, ...row])
      const placeholders = lote.map((row, linha) => `(${row.map((_, col) => `$${linha * 21 + col + 1}`).join(",")})`).join(",")
      await client.query(`INSERT INTO public.ft_conformidade_legal (carga_id,${colunas}) VALUES ${placeholders}`, lote.flat())
    }
    const conferencia = await client.query<{ registros: number; ocorrencias: number }>(
      "SELECT count(*)::int AS registros,coalesce(sum(total_ocorrencias),0)::int AS ocorrencias FROM public.ft_conformidade_legal WHERE carga_id=$1", [cargaId],
    )
    if (conferencia.rows[0].registros !== rowsGravar.length || conferencia.rows[0].ocorrencias !== ocorrenciasGravadas) throw new Error("A conferência dos registros gravados falhou.")
    await client.query("UPDATE public.ft_conformidade_legal_carga SET status='COMPLETA' WHERE id=$1", [cargaId])
    await client.query("COMMIT")
    return { registros: rowsGravar.length, totaisRemovidos: dados.totaisRemovidos, ocorrencias: ocorrenciasGravadas, competencias: competenciasGravadas, competenciasIgnoradas, duplicado: false }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally { client.release() }
}

export const LIMITE_ARQUIVO_CONFORMIDADE = MAX_ARQUIVO
