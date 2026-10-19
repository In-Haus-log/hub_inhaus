export default function LoadingConformidadeLegal() {
  return (
    <div role="status" aria-label="Carregando conformidade legal" className="space-y-6">
      <span className="sr-only">Carregando conformidade legal</span>
      <div className="h-24 rounded-3xl bg-muted motion-safe:animate-pulse" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-36 rounded-3xl bg-muted motion-safe:animate-pulse" />)}
      </div>
      <div className="h-80 rounded-3xl bg-muted motion-safe:animate-pulse" />
    </div>
  )
}
