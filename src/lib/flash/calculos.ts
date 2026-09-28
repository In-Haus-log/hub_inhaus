/**
 * REGRAS DE NEGÓCIO do Flash Report (fase 1: só receita). Manter em sincronia com
 * src/components/flash/FlashInfo.tsx.
 *  - Valor do item = valor unitário × quantidade. Desconto entra NEGATIVO.
 *  - Receita bruta projetada = soma dos itens do PEC na semana (projeção do MÊS inteiro).
 *  - Receita líquida = bruta × (1 − alíquota). Alíquota PROVISÓRIA = impostos realizados ÷
 *    receita bruta realizada do PEC nos últimos 3 meses; sem histórico → ALIQUOTA_PADRAO.
 *  - Semana nova = cópia das quantidades da última semana ENVIADA, com a tarifa vigente;
 *    item desativado sai; item novo entra com a quantidade padrão.
 */
export type TipoItem = "PESSOAS" | "UNITARIO" | "HORA_EXTRA" | "DESCONTO" | "FIXO"

export type Item = {
  id: number; descricao: string; tipo: TipoItem; valorUnitario: number; qtdPadrao: number
  conta: string; agrupador: string | null; ordem: number; ativo: boolean
}
export type LinhaSemana = { itemId: number; valorUnitario: number; quantidade: number }
export type Alteracao = { itemId: number; de: number; para: number }

/** % padrão de impostos para PEC sem histórico (pendência: % fixos a definir pelo financeiro). */
export const ALIQUOTA_PADRAO = 0.1425

export const TIPOS: Record<TipoItem, { rotulo: string; decimais: boolean; contaSugerida: string }> = {
  PESSOAS: { rotulo: "Pessoas por função", decimais: false, contaSugerida: "31101" },
  UNITARIO: { rotulo: "Unitário × quantidade", decimais: true, contaSugerida: "31101" },
  HORA_EXTRA: { rotulo: "Hora extra", decimais: true, contaSugerida: "31101" },
  DESCONTO: { rotulo: "Desconto", decimais: true, contaSugerida: "31101" },
  FIXO: { rotulo: "Valor fixo", decimais: true, contaSugerida: "31101" },
}

const centavos = (v: number) => Math.round(v * 100) / 100

export function valorLinha(tipo: TipoItem, valorUnitario: number, quantidade: number): number {
  const v = centavos(valorUnitario * quantidade)
  return tipo === "DESCONTO" ? -v : v
}

export function receitaBruta(itens: Item[], linhas: LinhaSemana[]): number {
  const tipo = new Map(itens.map((i) => [i.id, i.tipo]))
  return centavos(linhas.reduce((s, l) => s + valorLinha(tipo.get(l.itemId) ?? "UNITARIO", l.valorUnitario, l.quantidade), 0))
}

export const receitaLiquida = (bruta: number, aliquota: number) => centavos(bruta * (1 - aliquota))

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
