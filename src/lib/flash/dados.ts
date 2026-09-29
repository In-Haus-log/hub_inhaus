import type { PoolClient } from "pg"
import type { z } from "zod"

import { inhausPool } from "@/lib/db-inhaus"
import { assertLinhasNoEscopo, predicadoSraCr, type EscopoDados } from "@/lib/seguranca/escopo-dados"

import {
  aliquotaDoHistorico,
  montarSemanaNova,
  receitaLiquida,
  valorLinha,
  type Item,
  type LinhaSemana,
  type TipoItem,
} from "./calculos"
import { mesParaData, periodoAnterior, type Periodo } from "./semanas"
import { crNoEscopo, filtroCr } from "./sql"
import { validarQuantidades, type itemSchema, type rascunhoSchema } from "./validacao"

/**
 * Leitura/escrita do Flash Report no db_inhaus. Server-only.
 * TRAVA 1: toda consulta filtra por CR (filtroCr nas tabelas do Flash; predicadoSraCr no RE x OR).
 * TRAVA 2: toda saída com CR passa por assertLinhasNoEscopo.
 * Regras de cálculo em calculos.ts (e no texto do FlashInfo).
 */

export class ErroFlash extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}

export type StatusSemana = "RASCUNHO" | "ENVIADO" | "REABERTO"
export type PecFlash = { pecCod: string; pecNome: string; crCod: string; gerente: string | null }
export type ResumoPec = PecFlash & {
  status: "PENDENTE" | StatusSemana
  receitaBruta: number
  receitaLiquida: number
  variacao: number | null
}
export type SemanaCompleta = {
  id: number
  pec: PecFlash
  periodo: Periodo
  status: StatusSemana
  comentario: string | null
  aliquota: number
  receitaBruta: number
  receitaLiquida: number
  itens: Item[]
  linhas: LinhaSemana[]
  anterior: LinhaSemana[] | null
  liquidaAnterior: number | null
  realizadoUltimoMes: { mes: string; rol: number } | null
  enviadoPor: string | null
  enviadoEm: string | null
}
export type LinhaConsolidado = {
  pec: PecFlash
  semanas: Record<number, { status: string; receitaBruta: number; receitaLiquida: number } | undefined>
  realizadoRol: number | null
  negocio: string | null
  gerenteRegional: string | null
  situacao: string | null
}

type Executor = Pick<PoolClient, "query">

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const linhaParaItem = (r: any): Item => ({
  id: Number(r.id),
  descricao: r.descricao,
  tipo: r.tipo,
  natureza: r.natureza,
  crCod: r.cr_cod,
  valorUnitario: Number(r.valor_unitario),
  qtdPadrao: Number(r.qtd_padrao),
  agrupador: r.agrupador,
  ordem: Number(r.ordem),
  ativo: r.ativo,
})

// ---- PECs --------------------------------------------------------------------------

export async function garantirPecNoEscopo(escopo: EscopoDados, pecCod: string): Promise<PecFlash> {
  const f = filtroCr(escopo, "p.cr_cod", 2)
  const { rows } = await inhausPool.query(
    `select pec_cod, pec_nome, cr_cod, gerente from public.dm_flash_pec p where p.pec_cod = $1 and p.ativo${f.sql}`,
    [pecCod, ...f.params],
  )
  assertLinhasNoEscopo(rows, (r) => r.cr_cod, escopo)
  if (!rows[0]) throw new ErroFlash("PEC não encontrado.", 404)
  const r = rows[0]
  return { pecCod: r.pec_cod, pecNome: r.pec_nome, crCod: r.cr_cod, gerente: r.gerente }
}

/** PECs do RE x OR (no escopo) ainda não habilitados. Usa o registro mais recente de cada PEC. */
export async function pecsDisponiveis(escopo: EscopoDados): Promise<PecFlash[]> {
  const f = predicadoSraCr(escopo, "f.cr", 1)
  const { rows } = await inhausPool.query(
    `select distinct on (f.pec_cod) f.pec_cod, f.pec, f.cr_cod, f.gerente
       from public.ft_real_orcado f
      where f.pec_cod is not null and f.cr_cod is not null${f.sql}
        and not exists (select 1 from public.dm_flash_pec p where p.pec_cod = f.pec_cod and p.ativo)
      order by f.pec_cod, f.competencia desc`,
    f.params,
  )
  assertLinhasNoEscopo(rows, (r) => r.cr_cod, escopo)
  return rows.map((r) => ({ pecCod: r.pec_cod, pecNome: r.pec, crCod: r.cr_cod, gerente: r.gerente }))
}

export async function habilitarPec(escopo: EscopoDados, pecCod: string, usuario: string): Promise<void> {
  const pec = (await pecsDisponiveis(escopo)).find((p) => p.pecCod === pecCod)
  if (!pec) throw new ErroFlash("PEC não encontrado ou fora do seu escopo.", 404)
  await inhausPool.query(
    `insert into public.dm_flash_pec (pec_cod, pec_nome, cr_cod, gerente, criado_por) values ($1,$2,$3,$4,$5)
     on conflict (pec_cod) do update set ativo = true, pec_nome = excluded.pec_nome, gerente = excluded.gerente`,
    [pec.pecCod, pec.pecNome, pec.crCod, pec.gerente, usuario],
  )
}

export async function listarMeusPecs(escopo: EscopoDados, periodo: Periodo): Promise<ResumoPec[]> {
  const ant = periodoAnterior(periodo)
  const f = filtroCr(escopo, "p.cr_cod", 5)
  const fi = filtroCr(escopo, "si.cr_cod", 5)
  // Valores da semana só com as linhas de RECEITA de CR no escopo; ROL = bruta × (1 − alíquota da semana).
  const brutaEscopo = (sem: string) =>
    `coalesce((select sum(si.total) from public.ft_flash_semana_item si
                where si.semana_id = ${sem}.id and si.natureza = 'RECEITA'${fi.sql}), 0)`
  const { rows } = await inhausPool.query(
    `select p.pec_cod, p.pec_nome, p.cr_cod, p.gerente,
            s.status, ${brutaEscopo("s")}::float8 as bruta,
            round(${brutaEscopo("s")} * (1 - coalesce(s.aliquota, 0)), 2)::float8 as liquida,
            case when a.id is null then null
                 else round(${brutaEscopo("a")} * (1 - a.aliquota), 2)::float8 end as liquida_ant
       from public.dm_flash_pec p
       left join public.ft_flash_semana s on s.pec_cod = p.pec_cod and s.cr_cod = p.cr_cod and s.mes = $1::date and s.semana = $2
       left join public.ft_flash_semana a on a.pec_cod = p.pec_cod and a.cr_cod = p.cr_cod and a.mes = $3::date and a.semana = $4
      where p.ativo${f.sql}
      order by p.gerente nulls last, p.pec_cod`,
    [mesParaData(periodo.mes), periodo.semana, mesParaData(ant.mes), ant.semana, ...f.params],
  )
  assertLinhasNoEscopo(rows, (r) => r.cr_cod, escopo)
  return rows.map((r) => ({
    pecCod: r.pec_cod,
    pecNome: r.pec_nome,
    crCod: r.cr_cod,
    gerente: r.gerente,
    status: r.status ?? "PENDENTE",
    receitaBruta: r.bruta,
    receitaLiquida: r.liquida,
    variacao: r.status && r.liquida_ant != null ? r.liquida - r.liquida_ant : null,
  }))
}

// ---- Itens (parametrização) ----------------------------------------------------------

export async function listarItens(escopo: EscopoDados, pecCod: string): Promise<Item[]> {
  await garantirPecNoEscopo(escopo, pecCod)
  const f = filtroCr(escopo, "i.cr_cod", 2)
  const { rows } = await inhausPool.query(
    `select * from public.dm_flash_item i where i.pec_cod = $1${f.sql}
      order by (i.natureza = 'CUSTO'), i.ativo desc, i.ordem, i.id`,
    [pecCod, ...f.params],
  )
  assertLinhasNoEscopo(rows, (r) => r.cr_cod, escopo)
  return rows.map(linhaParaItem)
}

export async function salvarItem(
  escopo: EscopoDados,
  pecCod: string,
  d: z.infer<typeof itemSchema>,
  id?: number,
): Promise<Item> {
  const pec = await garantirPecNoEscopo(escopo, pecCod)
  const crItem = d.crCod ?? pec.crCod
  if (!crNoEscopo(escopo, crItem)) throw new ErroFlash("Este CR está fora do seu escopo.", 403)
  const valores = [d.descricao, d.tipo, d.valorUnitario, d.qtdPadrao, d.agrupador, d.ordem, d.natureza, crItem]
  const c = await inhausPool.connect()
  try {
    await c.query("begin")
    const f = filtroCr(escopo, "cr_cod", 11)
    const { rows } = id
      ? await c.query(
          `update public.dm_flash_item set descricao=$1, tipo=$2, valor_unitario=$3, qtd_padrao=$4,
                  agrupador=$5, ordem=$6, natureza=$7, cr_cod=$8, atualizado_em=now()
            where id=$9 and pec_cod=$10${f.sql} returning *`,
          [...valores, id, pecCod, ...f.params],
        )
      : await c.query(
          `insert into public.dm_flash_item (descricao, tipo, valor_unitario, qtd_padrao, agrupador, ordem, natureza, cr_cod, pec_cod)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
          [...valores, pecCod],
        )
    if (!rows[0]) throw new ErroFlash("Item não encontrado.", 404)
    // Mudança vale da semana corrente em diante: só semanas em RASCUNHO acompanham (valor, natureza e CR).
    // Semana ENVIADA ou REABERTA mantém a foto da época.
    const afetadas = await c.query(
      `update public.ft_flash_semana_item si set valor_unitario = $1, natureza = $4::text, cr_cod = $5::text,
              total = round(($1 * si.quantidade * case when $3 = 'DESCONTO' then -1 else 1 end)::numeric, 2)
         from public.ft_flash_semana s
        where si.semana_id = s.id and si.item_id = $2 and s.status = 'RASCUNHO'
        returning s.id, s.aliquota`,
      [d.valorUnitario, rows[0].id, d.tipo, d.natureza, crItem],
    )
    for (const s of afetadas.rows) await gravarTotais(c, Number(s.id), Number(s.aliquota))
    await c.query("commit")
    return linhaParaItem(rows[0])
  } catch (e) {
    await c.query("rollback")
    throw e
  } finally {
    c.release()
  }
}

export async function definirAtivo(escopo: EscopoDados, pecCod: string, id: number, ativo: boolean): Promise<void> {
  await garantirPecNoEscopo(escopo, pecCod)
  // Trava 1: item de CR fora do escopo não é alterado (0 linhas => 404).
  const f = filtroCr(escopo, "cr_cod", 4)
  const r = await inhausPool.query(
    `update public.dm_flash_item set ativo=$1, atualizado_em=now() where id=$2 and pec_cod=$3${f.sql}`,
    [ativo, id, pecCod, ...f.params],
  )
  if (r.rowCount === 0) throw new ErroFlash("Item não encontrado.", 404)
}

/** CRs que o usuário pode escolher para um item (todos, ou só os do escopo). */
export async function crsDoEscopo(escopo: EscopoDados): Promise<{ cr: string; nome: string }[]> {
  const f = filtroCr(escopo, "c.cr", 1)
  const { rows } = await inhausPool.query(
    `select c.cr, coalesce(nullif(c.descri_cr, ''), nullif(c.nome_cliente, ''), c.cr) as nome
       from public.dm_cr c where true${f.sql} order by c.cr`,
    f.params,
  )
  assertLinhasNoEscopo(rows, (r) => r.cr, escopo)
  return rows.map((r) => ({ cr: r.cr, nome: r.nome }))
}

// ---- Semana ----------------------------------------------------------------------------

async function aliquotaDoPec(pecCod: string, crCod: string): Promise<number> {
  const { rows } = await inhausPool.query(
    `with meses as (select distinct competencia from public.ft_real_orcado where pec_cod = $1 and cr_cod = $2
                     order by competencia desc limit 3)
     select coalesce(sum(case when conta_mae = '31101' then valor_realizado end),0)::float8 as bruta,
            coalesce(sum(case when conta_mae = '31201' then valor_realizado end),0)::float8 as impostos
       from public.ft_real_orcado where pec_cod = $1 and cr_cod = $2 and competencia in (select competencia from meses)`,
    [pecCod, crCod],
  )
  return aliquotaDoHistorico(rows[0].bruta, rows[0].impostos)
}

/** Linhas da semana no escopo do usuário: linha de item de CR fora do escopo nunca sai daqui (Trava 1 e 2). */
async function linhasDaSemana(c: Executor, id: number, escopo: EscopoDados): Promise<LinhaSemana[]> {
  const f = filtroCr(escopo, "si.cr_cod", 2)
  const { rows } = await c.query(
    `select si.item_id, si.valor_unitario, si.quantidade, si.cr_cod
       from public.ft_flash_semana_item si join public.dm_flash_item i on i.id = si.item_id
      where si.semana_id = $1${f.sql} order by i.ordem, i.id`,
    [id, ...f.params],
  )
  assertLinhasNoEscopo(rows, (r) => r.cr_cod, escopo)
  return rows.map((r) => ({
    itemId: Number(r.item_id),
    valorUnitario: Number(r.valor_unitario),
    quantidade: Number(r.quantidade),
  }))
}

/** Última semana ENVIADA estritamente antes do período (para copiar e comparar). */
async function ultimaEnviadaAntes(
  escopo: EscopoDados,
  pec: PecFlash,
  p: Periodo,
): Promise<{ linhas: LinhaSemana[]; liquida: number } | null> {
  // ROL comparável = receita das linhas NO ESCOPO × (1 − alíquota daquela semana); nunca o valor do contrato inteiro.
  const f = filtroCr(escopo, "si.cr_cod", 5)
  const { rows } = await inhausPool.query(
    `select s.id, s.aliquota::float8 as aliquota,
            coalesce((select sum(si.total) from public.ft_flash_semana_item si
                       where si.semana_id = s.id and si.natureza = 'RECEITA'${f.sql}), 0)::float8 as bruta
       from public.ft_flash_semana s
      where s.pec_cod=$1 and s.cr_cod=$4 and s.status='ENVIADO'
        and (s.mes, s.semana) < ($2::date, $3::smallint) order by s.mes desc, s.semana desc limit 1`,
    [pec.pecCod, mesParaData(p.mes), p.semana, pec.crCod, ...f.params],
  )
  if (!rows[0]) return null
  return {
    linhas: await linhasDaSemana(inhausPool, Number(rows[0].id), escopo),
    liquida: receitaLiquida(rows[0].bruta, rows[0].aliquota),
  }
}

/** Receita bruta = soma dos totais já gravados das linhas de RECEITA; custos não entram no ROL. */
async function gravarTotais(c: Executor, id: number, aliquota: number): Promise<void> {
  const { rows } = await c.query(
    `select coalesce(sum(total), 0)::float8 as bruta from public.ft_flash_semana_item
      where semana_id = $1 and natureza = 'RECEITA'`,
    [id],
  )
  const bruta = Math.round(rows[0].bruta * 100) / 100
  await c.query(
    `update public.ft_flash_semana set receita_bruta=$1, aliquota=$2, receita_liquida=$3, atualizado_em=now() where id=$4`,
    [bruta, aliquota, receitaLiquida(bruta, aliquota), id],
  )
}

async function buscarCabecalho(pec: PecFlash, p: Periodo) {
  const { rows } = await inhausPool.query(
    `select * from public.ft_flash_semana where pec_cod=$1 and mes=$2::date and semana=$3`,
    [pec.pecCod, mesParaData(p.mes), p.semana],
  )
  // Semana gravada sob outro CR (PEC que mudou de CR) nunca é exibida neste escopo.
  if (rows[0] && rows[0].cr_cod !== pec.crCod) throw new ErroFlash("Semana pertence a outro CR.", 404)
  return rows[0] ?? null
}

async function realizadoUltimoMes(pec: PecFlash): Promise<{ mes: string; rol: number } | null> {
  const { rows } = await inhausPool.query(
    `select to_char(competencia,'YYYY-MM') as mes,
            sum(case when grupo1 like '3%' then valor_realizado else 0 end)::float8 as rol
       from public.ft_real_orcado
      where pec_cod = $1 and cr_cod = $2
        and competencia = (select max(competencia) from public.ft_real_orcado where pec_cod = $1 and cr_cod = $2)
      group by competencia`,
    [pec.pecCod, pec.crCod],
  )
  return rows[0] ? { mes: rows[0].mes, rol: rows[0].rol } : null
}

/** Abre a projeção da semana; cria o rascunho (cópia da última enviada) se ainda não existir. */
export async function abrirSemana(escopo: EscopoDados, pecCod: string, periodo: Periodo): Promise<SemanaCompleta> {
  const pec = await garantirPecNoEscopo(escopo, pecCod)
  const itens = await listarItens(escopo, pecCod)
  const anterior = await ultimaEnviadaAntes(escopo, pec, periodo)
  let s = await buscarCabecalho(pec, periodo)

  if (!s) {
    const aliquota = await aliquotaDoPec(pecCod, pec.crCod)
    const linhas = montarSemanaNova(itens, anterior?.linhas ?? null)
    const porId = new Map(itens.map((i) => [i.id, i]))
    const c = await inhausPool.connect()
    try {
      await c.query("begin")
      const ins = await c.query(
        `insert into public.ft_flash_semana (pec_cod, cr_cod, mes, semana, aliquota) values ($1,$2,$3::date,$4,$5)
         on conflict (pec_cod, mes, semana) do nothing returning id`,
        [pecCod, pec.crCod, mesParaData(periodo.mes), periodo.semana, aliquota],
      )
      if (ins.rows[0]) {
        const id = Number(ins.rows[0].id)
        for (const l of linhas) {
          const it = porId.get(l.itemId)!
          await c.query(
            `insert into public.ft_flash_semana_item (semana_id, item_id, cr_cod, natureza, valor_unitario, quantidade, total)
             values ($1,$2,$3,$4,$5,$6,$7)`,
            [id, l.itemId, it.crCod, it.natureza, l.valorUnitario, l.quantidade, valorLinha(it.tipo, l.valorUnitario, l.quantidade)],
          )
        }
        await gravarTotais(c, id, aliquota)
      }
      await c.query("commit")
    } catch (e) {
      await c.query("rollback")
      throw e
    } finally {
      c.release()
    }
    s = await buscarCabecalho(pec, periodo)
  } else if (s.status === "RASCUNHO") {
    // Rascunho acompanha a parametrização: item novo entra com a qtd. padrão; desativado sai.
    // Semana REABERTA mantém a composição e os valores da época do envio.
    const c = await inhausPool.connect()
    try {
      await c.query("begin")
      for (const i of itens.filter((i) => i.ativo)) {
        await c.query(
          `insert into public.ft_flash_semana_item (semana_id, item_id, cr_cod, natureza, valor_unitario, quantidade, total)
           values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing`,
          [s.id, i.id, i.crCod, i.natureza, i.valorUnitario, i.qtdPadrao, valorLinha(i.tipo, i.valorUnitario, i.qtdPadrao)],
        )
      }
      await c.query(
        `delete from public.ft_flash_semana_item si using public.dm_flash_item i
          where si.semana_id=$1 and si.item_id=i.id and not i.ativo`,
        [s.id],
      )
      await gravarTotais(c, Number(s.id), Number(s.aliquota))
      await c.query("commit")
    } catch (e) {
      await c.query("rollback")
      throw e
    } finally {
      c.release()
    }
    s = await buscarCabecalho(pec, periodo)
  }

  return {
    id: Number(s.id),
    pec,
    periodo,
    status: s.status,
    comentario: s.comentario,
    aliquota: Number(s.aliquota),
    receitaBruta: Number(s.receita_bruta),
    receitaLiquida: Number(s.receita_liquida),
    itens,
    linhas: await linhasDaSemana(inhausPool, Number(s.id), escopo),
    anterior: anterior?.linhas ?? null,
    liquidaAnterior: anterior?.liquida ?? null,
    realizadoUltimoMes: await realizadoUltimoMes(pec),
    enviadoPor: s.enviado_por,
    enviadoEm: s.enviado_em ? new Date(s.enviado_em).toISOString() : null,
  }
}

async function gravarQuantidades(
  c: Executor,
  semana: SemanaCompleta,
  entrada: z.infer<typeof rascunhoSchema>,
): Promise<void> {
  // Relê o status COM trava de linha dentro da transação: um envio concorrente não pode ser sobrescrito.
  const atual = await c.query(`select status from public.ft_flash_semana where id=$1 for update`, [semana.id])
  if (semana.status === "ENVIADO" || atual.rows[0]?.status === "ENVIADO") {
    throw new ErroFlash("Semana já enviada. Peça ao financeiro para reabrir.", 409)
  }
  const naSemana = new Set(semana.linhas.map((l) => l.itemId))
  const tipos = new Map<number, TipoItem>(semana.itens.filter((i) => naSemana.has(i.id)).map((i) => [i.id, i.tipo]))
  const erro = validarQuantidades(entrada.linhas, tipos)
  if (erro) throw new ErroFlash(erro, 400)
  for (const l of entrada.linhas) {
    await c.query(
      `update public.ft_flash_semana_item set quantidade=$1,
              total = round((valor_unitario * $1 * case when $4 = 'DESCONTO' then -1 else 1 end)::numeric, 2)
        where semana_id=$2 and item_id=$3`,
      [l.quantidade, semana.id, l.itemId, tipos.get(l.itemId)],
    )
  }
  await c.query(`update public.ft_flash_semana set comentario=$1 where id=$2`, [entrada.comentario, semana.id])
  await gravarTotais(c, semana.id, semana.aliquota)
}

async function emTransacao(fn: (c: PoolClient) => Promise<void>): Promise<void> {
  const c = await inhausPool.connect()
  try {
    await c.query("begin")
    await fn(c)
    await c.query("commit")
  } catch (e) {
    await c.query("rollback")
    throw e
  } finally {
    c.release()
  }
}

export async function salvarRascunho(
  escopo: EscopoDados,
  pecCod: string,
  periodo: Periodo,
  entrada: z.infer<typeof rascunhoSchema>,
): Promise<SemanaCompleta> {
  const semana = await abrirSemana(escopo, pecCod, periodo)
  await emTransacao((c) => gravarQuantidades(c, semana, entrada))
  return abrirSemana(escopo, pecCod, periodo)
}

export async function enviarSemana(
  escopo: EscopoDados,
  pecCod: string,
  periodo: Periodo,
  entrada: z.infer<typeof rascunhoSchema>,
  usuario: string,
): Promise<SemanaCompleta> {
  const semana = await abrirSemana(escopo, pecCod, periodo)
  await emTransacao(async (c) => {
    await gravarQuantidades(c, semana, entrada)
    await c.query(
      `update public.ft_flash_semana set status='ENVIADO', enviado_por=$1, enviado_em=now() where id=$2 and status <> 'ENVIADO'`,
      [usuario, semana.id],
    )
    await c.query(
      `insert into public.ft_flash_evento (semana_id, cr_cod, acao, usuario) values ($1,$2,'ENVIO',$3)`,
      [semana.id, semana.pec.crCod, usuario],
    )
  })
  return abrirSemana(escopo, pecCod, periodo)
}

export async function reabrirSemana(
  escopo: EscopoDados,
  pecCod: string,
  periodo: Periodo,
  motivo: string,
  usuario: string,
): Promise<void> {
  const pec = await garantirPecNoEscopo(escopo, pecCod)
  const s = await buscarCabecalho(pec, periodo)
  if (!s) throw new ErroFlash("Só é possível reabrir uma semana enviada.", 409)
  await emTransacao(async (c) => {
    // Condicional no SQL: dois pedidos simultâneos geram UMA reabertura.
    const r = await c.query(
      `update public.ft_flash_semana set status='REABERTO', atualizado_em=now() where id=$1 and status='ENVIADO' returning id`,
      [s.id],
    )
    if (!r.rows[0]) throw new ErroFlash("Só é possível reabrir uma semana enviada.", 409)
    await c.query(
      `insert into public.ft_flash_evento (semana_id, cr_cod, acao, usuario, motivo) values ($1,$2,'REABERTURA',$3,$4)`,
      [s.id, pec.crCod, usuario, motivo],
    )
  })
}

// ---- Consolidado -------------------------------------------------------------------------

export async function consolidado(escopo: EscopoDados, mes: string): Promise<LinhaConsolidado[]> {
  const fp = filtroCr(escopo, "p.cr_cod", 2)
  const { rows: pecs } = await inhausPool.query(
    `select p.pec_cod, p.pec_nome, p.cr_cod, p.gerente, s.semana, s.status,
            s.receita_bruta::float8 as bruta, s.receita_liquida::float8 as liquida
       from public.dm_flash_pec p
       left join public.ft_flash_semana s on s.pec_cod = p.pec_cod and s.cr_cod = p.cr_cod and s.mes = $1::date
      where p.ativo${fp.sql}
      order by p.gerente nulls last, p.pec_cod, s.semana`,
    [mesParaData(mes), ...fp.params],
  )
  assertLinhasNoEscopo(pecs, (r) => r.cr_cod, escopo)

  const fr = predicadoSraCr(escopo, "f.cr", 2)
  const { rows: reais } = await inhausPool.query(
    `select f.pec_cod, f.cr_cod,
            sum(case when f.competencia = $1::date and f.grupo1 like '3%' then f.valor_realizado else 0 end)::float8 as rol,
            bool_or(f.competencia = $1::date) as tem_mes,
            (array_agg(f.negocio order by f.competencia desc))[1] as negocio,
            (array_agg(f.gerente_geral order by f.competencia desc))[1] as gerente_regional,
            (array_agg(f.pec_situacao order by f.competencia desc))[1] as situacao
       from public.ft_real_orcado f
      where f.pec_cod in (select pec_cod from public.dm_flash_pec where ativo)${fr.sql}
      group by f.pec_cod, f.cr_cod`,
    [mesParaData(mes), ...fr.params],
  )
  assertLinhasNoEscopo(reais, (r) => r.cr_cod, escopo)
  const real = new Map(reais.map((r) => [`${r.pec_cod}|${r.cr_cod}`, r]))

  const porPec = new Map<string, LinhaConsolidado>()
  for (const r of pecs) {
    let l = porPec.get(r.pec_cod)
    if (!l) {
      const x = real.get(`${r.pec_cod}|${r.cr_cod}`)
      l = {
        pec: { pecCod: r.pec_cod, pecNome: r.pec_nome, crCod: r.cr_cod, gerente: r.gerente },
        semanas: {},
        realizadoRol: x?.tem_mes ? x.rol : null,
        negocio: x?.negocio ?? null,
        gerenteRegional: x?.gerente_regional ?? null,
        situacao: x?.situacao ?? null,
      }
      porPec.set(r.pec_cod, l)
    }
    if (r.semana != null) {
      l.semanas[r.semana] = { status: r.status, receitaBruta: r.bruta, receitaLiquida: r.liquida }
    }
  }
  return [...porPec.values()]
}
