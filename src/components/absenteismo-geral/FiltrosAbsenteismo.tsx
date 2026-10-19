"use client";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { MultiCombobox } from "@/components/ui/MultiCombobox";
import type { ComboOption } from "@/components/ui/Combobox";
import type { OpcoesAbsenteismo } from "@/lib/absenteismo-geral";
type Props = {
  opcoes: OpcoesAbsenteismo;
  atual: { mes: string; gerentes: string[]; crs: string[]; cargos: string[] };
};
function mesBR(mes: string): string {
  const [ano, numero] = mes.split("-").map(Number);
  if (!ano || !numero) return mes;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long", timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(ano, numero - 1, 1)));
}
export function FiltrosAbsenteismo({ opcoes, atual }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [navegando, startTransition] = useTransition();
  const navegar = (alteracoes: Partial<Props["atual"]>) => {
    const f = { ...atual, ...alteracoes };
    const p = new URLSearchParams();
    if (f.mes) p.set("mes", f.mes);
    for (const v of f.gerentes) p.append("ger", v);
    for (const v of f.crs) p.append("cr", v);
    for (const v of f.cargos) p.append("cargo", v);
    startTransition(() => router.push(`${pathname}?${p.toString()}`));
  };
  const mesMaisRecente = opcoes.meses[0] ?? "";
  const total = atual.gerentes.length + atual.crs.length + atual.cargos.length;
  const mesFiltrado = Boolean(atual.mes && atual.mes !== mesMaisRecente);
  const temFiltros = total > 0 || mesFiltrado;
  const opts = (xs: string[]): ComboOption[] =>
    xs.map((value) => ({ value, label: value }));
  const normalizar = (v: string[], all: string[]) =>
    v.length >= all.length ? [] : v;
  return (
    <fieldset
      disabled={navegando}
      aria-busy={navegando}
      className="flex flex-wrap items-center gap-2"
      aria-label="Filtros do absenteísmo"
    >
      <span className="inline-flex h-10 items-center gap-2 rounded-full border border-navy/15 bg-white/80 px-4 text-sm font-medium text-navy shadow-card">
        <SlidersHorizontal className="h-4 w-4 text-teal" /> Filtros{" "}
        {temFiltros && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-teal px-1.5 text-xs font-semibold text-white">
            {total}
          </span>
        )}
      </span>
      <label className="sr-only" htmlFor="mes-absenteismo">
        Mês
      </label>
      <select
        id="mes-absenteismo"
        value={atual.mes}
        onChange={(e) => navegar({ mes: e.target.value })}
        className="h-10 rounded-xl border border-input bg-white/80 px-3 text-sm text-foreground focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/20"
      >
        {opcoes.meses.map((m) => (
          <option key={m} value={m}>
            {mesBR(m)}
          </option>
        ))}
      </select>
      <div className="min-w-[11rem]">
        <MultiCombobox
          ariaLabel="Filtrar por gerente"
          values={atual.gerentes}
          onChange={(v) =>
            navegar({ gerentes: normalizar(v, opcoes.gerentes) })
          }
          options={opts(opcoes.gerentes)}
          placeholder="Todos os gerentes"
        />
      </div>
      <div className="min-w-[11rem]">
        <MultiCombobox
          ariaLabel="Filtrar por centro de resultado"
          values={atual.crs}
          onChange={(v) => navegar({ crs: normalizar(v, opcoes.crs) })}
          options={opts(opcoes.crs)}
          placeholder="Todos os CRs"
        />
      </div>
      <div className="min-w-[11rem]">
        <MultiCombobox
          ariaLabel="Filtrar por cargo"
          values={atual.cargos}
          onChange={(v) => navegar({ cargos: normalizar(v, opcoes.cargos) })}
          options={opts(opcoes.cargos)}
          placeholder="Todos os cargos"
        />
      </div>
      {total > 0 && (
        <button
          type="button"
          onClick={() =>
            startTransition(() =>
              router.push(
                `${pathname}?mes=${encodeURIComponent(opcoes.meses[0] ?? "")}`,
              ),
            )
          }
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-teal"
        >
          <X className="h-4 w-4" /> Limpar filtros
        </button>
      )}
    </fieldset>
  );
}
