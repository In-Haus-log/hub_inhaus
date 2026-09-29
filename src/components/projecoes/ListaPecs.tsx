import Link from "next/link"

import { moeda, nomeDoPec, percentual } from "@/components/flash/moeda"
import { SeloStatus } from "@/components/flash/SeloStatus"
import type { Periodo } from "@/lib/flash/semanas"
import { mcDe, type DimVisao, type Grupo, type LinhaPec, type Totais } from "@/lib/projecoes/agrupar"
import { tituloNome } from "@/lib/nomes"
import { cn } from "@/lib/utils"

const num = "px-4 py-3 text-right tabular-nums"
const corMc = (v: number | null) => (v == null ? "text-muted-foreground" : v < 0 ? "text-red-700" : "text-navy")

function Celulas({ rol, mc, margem }: { rol: number | null; mc: number | null; margem: number | null }) {
  return (
    <>
      <td className={cn(num, "text-navy")}>{rol == null ? "—" : moeda(rol)}</td>
      <td className={cn(num, corMc(mc))}>{mc == null ? "—" : moeda(mc)}</td>
      <td className={cn(num, corMc(mc))}>{percentual(margem)}</td>
    </>
  )
}

function LinhaDoPec({ p, periodo }: { p: LinhaPec; periodo: Periodo }) {
  const mc = mcDe(p)
  const margem = p.rol != null && p.rol !== 0 && mc != null ? mc / p.rol : null
  return (
    <tr className="relative border-t border-navy/5 transition hover:bg-teal-tint/50 focus-within:bg-teal-tint/50">
      <th scope="row" className="px-4 py-3 text-left font-normal">
        <Link
          href={`/dashboards/financeiro/projecoes/${p.pecCod}?mes=${periodo.mes}&semana=${periodo.semana}`}
          className="block font-medium text-navy after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-teal"
        >
          {tituloNome(nomeDoPec(p.pecNome))}
        </Link>
        <span className="text-xs text-muted-foreground">
          PEC {p.pecCod} · CR {p.crCod}
          {p.gerente ? ` · ${tituloNome(p.gerente)}` : ""}
        </span>
      </th>
      <td className="px-4 py-3">
        <SeloStatus status={p.status} />
      </td>
      <Celulas rol={p.rol} mc={mc} margem={margem} />
    </tr>
  )
}

function CabecalhoDoGrupo({ g }: { g: Grupo }) {
  const t: Totais = g.totais
  return (
    <tr className="bg-navy-mist/70">
      <th scope="rowgroup" colSpan={2} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.14em] text-navy">
        {g.rotulo} <span className="font-normal normal-case tracking-normal text-muted-foreground">({t.lancados}/{t.total} lançados)</span>
      </th>
      <Celulas rol={t.lancados ? t.rol : null} mc={t.lancados ? t.mc : null} margem={t.margem} />
    </tr>
  )
}

/** Lista de PECs (uma linha por PEC) ou de grupos com os PECs dentro. Clique na linha → parametrização. */
export function ListaPecs({ grupos, dim, periodo }: { grupos: Grupo[]; dim: DimVisao; periodo: Periodo }) {
  return (
    <div className="glass overflow-x-auto rounded-3xl">
      <table className="w-full text-sm">
        <caption className="sr-only">Projeção por contrato: ROL, MC e % Margem</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-3 font-medium">Contrato</th>
            <th scope="col" className="px-4 py-3 font-medium">Situação</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">ROL</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">MC</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">% Margem</th>
          </tr>
        </thead>
        {grupos.map((g) => (
          <tbody key={g.chave}>
            {dim !== "pec" && <CabecalhoDoGrupo g={g} />}
            {g.pecs.map((p) => (
              <LinhaDoPec key={p.pecCod} p={p} periodo={periodo} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}
