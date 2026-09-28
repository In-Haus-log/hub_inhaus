import { cn } from "@/lib/utils"

/** Selo do status da projeção semanal de um PEC. Cor + texto (nunca só cor). */
const ESTILO: Record<string, { rotulo: string; classe: string }> = {
  PENDENTE: { rotulo: "Pendente", classe: "border-amber-200 bg-amber-50 text-amber-800" },
  RASCUNHO: { rotulo: "Rascunho", classe: "border-navy/10 bg-navy-mist text-navy" },
  ENVIADO: { rotulo: "Enviado", classe: "border-teal/20 bg-teal-tint text-teal-deep" },
  REABERTO: { rotulo: "Reaberto", classe: "border-rose-200 bg-rose-50 text-rose-800" },
}

export function SeloStatus({ status, className }: { status: string; className?: string }) {
  const e = ESTILO[status] ?? ESTILO.PENDENTE
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        e.classe,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {e.rotulo}
    </span>
  )
}
