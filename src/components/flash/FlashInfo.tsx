import { InfoIndicador } from "@/components/dashboard/InfoIndicador"

/** Regras do Flash Report em linguagem de negócio. Sincronizar com src/lib/flash/calculos.ts e semanas.ts. */
export function FlashInfo() {
  return (
    <InfoIndicador titulo="Como funciona o Flash Report">
      <div className="space-y-3 text-sm">
        <p>Toda semana você informa quanto o contrato vai <strong>faturar no mês inteiro</strong>. Por enquanto, só a receita.</p>
        <ul className="list-disc space-y-1 pl-4">
          <li><strong>Semana do mês:</strong> dias 1–7 = Semana 1, 8–14 = Semana 2… 29–31 = Semana 5.</li>
          <li><strong>Cada item</strong> = valor unitário × quantidade. Ex.: Separador R$ 6.978,41 × 15 pessoas = <strong>R$ 104.676,15</strong>.</li>
          <li><strong>Descontos</strong> (faltas, glosas) entram <strong>negativos</strong>.</li>
          <li><strong>Receita bruta</strong> = soma de todos os itens.</li>
          <li><strong>Receita líquida</strong> = bruta menos impostos, pelo % médio que o contrato pagou nos <strong>últimos 3 meses</strong>. Ex.: R$ 1.000.000 com 11,5% → <strong>R$ 885.000</strong>. Contrato novo usa 14,25%.</li>
          <li>A semana <strong>começa igual à última enviada</strong>: mude só o que mudou (◆ marca a alteração).</li>
          <li>Depois de <strong>enviada</strong>, a semana trava. Só o financeiro reabre, informando o motivo.</li>
          <li>Mudou a tarifa? Vale <strong>da semana atual em diante</strong>; semanas enviadas não mudam.</li>
        </ul>
      </div>
    </InfoIndicador>
  )
}
