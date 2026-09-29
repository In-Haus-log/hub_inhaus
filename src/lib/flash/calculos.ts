/**
 * REGRAS DE NEGÓCIO do Flash Report / Projeções. Manter em sincronia com
 * src/components/flash/FlashInfo.tsx e src/components/projecoes/ProjecoesVisaoInfo.tsx.
 *  - Valor do item = valor unitário × quantidade. Desconto (só em receita) entra NEGATIVO.
 *  - Receita bruta projetada = soma dos itens de RECEITA do PEC na semana (projeção do MÊS inteiro).
 *  - ROL (receita líquida) = bruta × (1 − alíquota). Alíquota PROVISÓRIA = impostos realizados ÷
 *    receita bruta realizada do PEC nos últimos 3 meses; sem histórico → ALIQUOTA_PADRAO.
 *  - Custos = soma dos itens de CUSTO da semana (taxa, hora extra, variável). Impostos e
 *    benefícios ainda NÃO entram (ficam para depois).
 *  - MC = ROL − Custos. % Margem = MC ÷ ROL (vazia quando o ROL é zero).
 *  - Semana nova = cópia das quantidades da última semana ENVIADA, com a tarifa vigente;
 *    item desativado sai; item novo entra com a quantidade padrão.
 */
export type Natureza = "RECEITA" | "CUSTO"
export type TipoItem = "PESSOAS" | "UNITARIO" | "HORA_EXTRA" | "DESCONTO" | "FIXO" | "TAXA" | "VARIAVEL"

export type Item = {
  id: number; descricao: string; tipo: TipoItem; natureza: Natureza; crCod: string
  valorUnitario: number; qtdPadrao: number; agrupador: string | null; ordem: number; ativo: boolean
}
export type LinhaSemana = { itemId: number; valorUnitario: number; quantidade: number }
export type Alteracao = { itemId: number; de: number; para: number }

/** % padrão de impostos para PEC sem histórico (pendência: % fixos a definir pelo financeiro). */
export const ALIQUOTA_PADRAO = 0.1425

export const TIPOS: Record<TipoItem, { rotulo: string; decimais: boolean }> = {
  PESSOAS: { rotulo: "Pessoas por função", decimais: false },
  UNITARIO: { rotulo: "Unitário × quantidade", decimais: true },
  HORA_EXTRA: { rotulo: "Hora extra", decimais: true },
  DESCONTO: { rotulo: "Desconto", decimais: true },
  FIXO: { rotulo: "Valor fixo", decimais: true },
  TAXA: { rotulo: "Taxa", decimais: true },
  VARIAVEL: { rotulo: "Variável", decimais: true },
}

/** Tipos que fazem sentido para cada natureza (a ordem é a das pílulas na parametrização). */
export const TIPOS_POR_NATUREZA: Record<Natureza, TipoItem[]> = {
  RECEITA: ["PESSOAS", "UNITARIO", "HORA_EXTRA", "DESCONTO", "FIXO"],
  CUSTO: ["HORA_EXTRA", "TAXA", "VARIAVEL", "UNITARIO", "FIXO"],
}

const centavos = (v: number) => Math.round(v * 100) / 100

export function valorLinha(tipo: TipoItem, valorUnitario: number, quantidade: number): number {
  const v = centavos(valorUnitario * quantidade)
  return tipo === "DESCONTO" ? -v : v
}

export const receitaLiquida = (bruta: number, aliquota: number) => centavos(bruta * (1 - aliquota))

export function receitaBruta(itens: Item[], linhas: LinhaSemana[]): number {
  return resumoSemana(itens, linhas, 0).bruta
}

export const margemPct = (mc: number, rol: number): number | null => (rol === 0 ? null : mc / rol)

/** Números da semana: bruta, ROL, custos, MC e % Margem. Linha de item desconhecido é ignorada. */
export function resumoSemana(itens: Item[], linhas: LinhaSemana[], aliquota: number) {
  const porId = new Map(itens.map((i) => [i.id, i]))
  let bruta = 0
  let custos = 0
  for (const l of linhas) {
    const i = porId.get(l.itemId)
    if (!i) continue
    const v = valorLinha(i.tipo, l.valorUnitario, l.quantidade)
    if (i.natureza === "CUSTO") custos += v
    else bruta += v
  }
  bruta = centavos(bruta)
  custos = centavos(custos)
  const rol = receitaLiquida(bruta, aliquota)
  const mc = centavos(rol - custos)
  return { bruta, rol, custos, mc, margem: margemPct(mc, rol) }
}

export function aliquotaDoHistorico(receitaBrutaReal: number, impostosReal: number): number {
  if (receitaBrutaReal <= 0) return ALIQUOTA_PADRAO
  return Math.max(0, -impostosReal / receitaBrutaReal)
}

export function montarSemanaNova(itens: Item[], ultimaEnviada: LinhaSemana[] | null): LinhaSemana[] {
  const anterior = new Map((ultimaEnviada ?? []).map((l) => [l.itemId, l.quantidade]))
  return itens
    .filter((i) => i.ativo)
    .sort((a, b) => a.ordem - b.ordem || a.id - b.id)
    .map((i) => ({ itemId: i.id, valorUnitario: i.valorUnitario, quantidade: anterior.get(i.id) ?? i.qtdPadrao }))
}

export function alteracoes(atual: LinhaSemana[], anterior: LinhaSemana[] | null): Alteracao[] {
  if (!anterior) return []
  const ant = new Map(anterior.map((l) => [l.itemId, l.quantidade]))
  return atual
    .map((l) => ({ itemId: l.itemId, de: ant.get(l.itemId) ?? 0, para: l.quantidade }))
    .filter((a) => a.de !== a.para)
}
