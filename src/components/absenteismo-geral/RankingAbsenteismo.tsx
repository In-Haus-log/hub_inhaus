import type { DadosAbsenteismo } from "@/lib/absenteismo-geral";
type Linha = DadosAbsenteismo["porCr"][number];
const pct = (v: number) =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export function RankingAbsenteismo({
  titulo,
  descricao,
  dados,
}: {
  titulo: string;
  descricao: string;
  dados: Linha[];
}) {
  return (
    <section className="glass min-w-0 rounded-3xl p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {titulo}
        </h2>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>
      {dados.length ? (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-navy/10 text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Nome</th>
                <th className="pb-2 text-right font-medium">Absenteísmo</th>
                <th className="pb-2 text-right font-medium">Faltas</th>
                <th className="pb-2 text-right font-medium">Escalados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {dados.map((item) => (
                <tr key={item.rotulo}>
                  <th
                    scope="row"
                    className="max-w-[18rem] whitespace-normal py-3 pr-3 font-medium text-foreground"
                  >
                    {item.rotulo}
                  </th>
                  <td className="py-3 text-right font-semibold tabular-nums text-teal">
                    {pct(item.absenteismo)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-muted-foreground">
                    {item.faltas.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-3 text-right tabular-nums text-muted-foreground">
                    {item.escalados.toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-8 text-sm text-muted-foreground">
          Sem dados para este recorte.
        </p>
      )}
    </section>
  );
}
