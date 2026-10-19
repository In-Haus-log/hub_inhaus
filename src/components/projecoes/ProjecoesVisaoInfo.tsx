import { InfoIndicador } from "@/components/dashboard/InfoIndicador"

/** Regras da tela de Projeções em linguagem de negócio. Sincronizar com o topo de src/lib/flash/calculos.ts. */
export function ProjecoesVisaoInfo() {
  return (
    <InfoIndicador titulo="Como ler as projeções">
      <div className="space-y-3 text-sm">
        <p>Cada linha é um <strong>contrato (PEC)</strong> com a projeção da <strong>semana escolhida</strong>. Cada semana projeta o fechamento do <strong>mês inteiro</strong>.</p>
        <ul className="list-disc space-y-1 pl-4">
          <li><strong>ROL</strong> (receita líquida) = receita bruta projetada − impostos, pelo % médio que o contrato pagou nos últimos 3 meses.</li>
          <li><strong>MC</strong> (margem de contribuição) = ROL − custos do contrato (hora extra, taxas e variáveis lançados na semana).</li>
          <li><strong>% Margem</strong> = MC ÷ ROL.</li>
          <li>Contrato <strong>sem lançamento</strong> na semana aparece com traço (—) e <strong>não entra</strong> nos totais.</li>
          <li><strong>Agrupar por</strong> junta os contratos por CR, gerente ou cliente e soma os números de cada grupo.</li>
          <li>A carteira exibida é a do <strong>Gerente Regional Lucas Rodrigues da Silva</strong>, intersectada com os CRs autorizados do usuário.</li>
          <li>Os <strong>PECs vêm da tabela de CRs</strong>, mesmo sem parametrização ou lançamento. Cada PEC aparece uma vez.</li>
          <li>Clique num PEC para ver seus <strong>CRs vinculados</strong> e parametrizar os itens. Você só pode selecionar CRs desse PEC dentro da sua carteira.</li>
        </ul>
        <p className="rounded-xl bg-navy-mist p-3">
          <strong>Exemplo:</strong> ROL R$ 900.000 e custos R$ 120.000 → <strong>MC R$ 780.000</strong>. Margem = 780.000 ÷ 900.000 = <strong>86,7%</strong>.
        </p>
        <p className="text-xs text-muted-foreground">Os impostos já estão descontados no ROL. Impostos e benefícios como custo do contrato (que reduziriam o MC) entram numa próxima etapa. Cada pessoa vê apenas os CRs da própria carteira.</p>
      </div>
    </InfoIndicador>
  )
}
