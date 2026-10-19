export default function Loading() {
  return (
    <div
      className="space-y-7"
      aria-busy="true"
      aria-label="Carregando absenteísmo"
    >
      <div className="h-28 animate-pulse rounded-3xl bg-navy/5" />
      <div className="h-10 w-full animate-pulse rounded-2xl bg-navy/5" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-3xl bg-navy/5" />
        ))}
      </div>
      <div className="h-[360px] animate-pulse rounded-3xl bg-navy/5" />
    </div>
  );
}
