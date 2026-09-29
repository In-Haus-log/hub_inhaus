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
          <li><strong>CR do item:</strong> a qual centro de resultado o item (receita ou custo) pertence. Por padrão é o CR do contrato; você pode escolher outro.</li>
          <li><strong>Margem:</strong> receita líquida − custos = MC. Ex.: R$ 100.000 líquidos − R$ 4.800 = <strong>R$ 95.200</strong>.</li>
          <li><strong>Itens ativos:</strong> quantos itens do contrato entram nas próximas semanas. Desativados não contam.</li>
          <li><strong>Receita padrão do mês:</strong> soma de valor × quantidade padrão de todas as receitas ativas (descontos subtraem). Ex.: 20 pessoas × R$ 5.000 − R$ 1.000 de desconto = <strong>R$ 99.000</strong>. É o ponto de partida de uma semana nova, não a projeção da semana.</li>
          <li><strong>Custo padrão do mês:</strong> o mesmo cálculo, só com os custos ativos.</li>
          <li><strong>Área:</strong> rótulo livre (ex.: A220, uma loja) só para agrupar os itens na grade semanal. Não muda nenhum cálculo.</li>
          <li>Mudou um valor? Vale <strong>da semana atual em diante</strong>; semanas já enviadas não mudam.</li>
          <li>Desativar um item o tira das próximas semanas, sem apagar o histórico.</li>
        </ul>
        <p className="text-xs text-muted-foreground">Impostos e benefícios como custo do contrato entram numa próxima etapa; os impostos sobre a receita já são descontados no ROL.</p>
      </div>
    </InfoIndicador>
  )
}
