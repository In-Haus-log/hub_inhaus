import { InfoIndicador } from "@/components/dashboard/InfoIndicador"

/** Regras da parametrização do PEC em linguagem de negócio. Sincronizar com src/lib/flash/calculos.ts. */
export function ParametrizacaoInfo() {
  return (
    <InfoIndicador titulo="Como parametrizar o contrato">
      <div className="space-y-3 text-sm">
        <p>Aqui você cadastra <strong>uma vez só</strong> o que compõe o contrato. Toda semana, na projeção, você só ajusta as quantidades.</p>
        <ul className="list-disc space-y-1 pl-4">
          <li><strong>Receita:</strong> o que é cobrado do cliente (funções, hora extra cobrada, locações, descontos). Forma a <strong>receita bruta</strong>.</li>
          <li><strong>Custo:</strong> o que o contrato gasta (hora extra, taxas, variáveis). Sai da <strong>margem de contribuição (MC)</strong>.</li>
          <li><strong>Cada item</strong> = valor unitário × quantidade. Ex.: hora extra R$ 40,00 × 120 horas = <strong>R$ 4.800,00</strong> de custo.</li>
          <li><strong>CR do item:</strong> a qual centro de resultado o custo pertence. Por padrão é o CR do contrato; você pode escolher outro.</li>
          <li><strong>Margem:</strong> receita líquida − custos = MC. Ex.: R$ 100.000 líquidos − R$ 4.800 = <strong>R$ 95.200</strong>.</li>
          <li>Mudou um valor? Vale <strong>da semana atual em diante</strong>; semanas já enviadas não mudam.</li>
          <li>Desativar um item o tira das próximas semanas, sem apagar o histórico.</li>
        </ul>
        <p className="text-xs text-muted-foreground">Impostos e benefícios entram numa próxima etapa.</p>
      </div>
    </InfoIndicador>
  )
}
