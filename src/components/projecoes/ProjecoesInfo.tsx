import { InfoIndicador } from "@/components/dashboard/InfoIndicador"

/**
 * Regras do Projeções em linguagem de negócio. Manter em sincronia com o topo de
 * src/lib/projecoes/calculos.ts — qualquer mudança de cálculo atualiza este texto.
 */
export function ProjecoesInfo() {
  return (
    <InfoIndicador titulo="Como ler a análise">
      <div className="space-y-3 text-sm">
        <p>
          Cada número é a <strong>soma dos lançamentos</strong> daquela linha no mês. Receitas
          aparecem <strong>positivas</strong> e custos <strong>negativos</strong>, como no relatório de resultado.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong>Linhas:</strong> escolha como quebrar a análise (gerente, CR, conta…) e empilhe
            níveis — ex.: gerente › CR › conta.
          </li>
          <li>
            <strong>ROL</strong> (receita líquida) = receita bruta − impostos sobre faturamento.
          </li>
          <li>
            <strong>MC</strong> (lucro de fato) = tudo somado: receitas menos todos os custos e despesas.
          </li>
          <li>
            <strong>% Margem</strong> = MC ÷ ROL.
          </li>
          <li>
            <strong>Diferença</strong> = Realizado − Orçado. <span className="text-emerald-700">Verde</span>{" "}
            = melhor que o orçado; <span className="text-red-600">vermelho</span> = pior — vale para
            receita e para custo.
          </li>
          <li>
            Na <strong>Diferença (R$)</strong>, a % Margem mostra a variação em pontos percentuais
            (p.p.); na <strong>Diferença (%)</strong> ela fica em branco (—).
          </li>
          <li>Mês sem lançamento fica <strong>em branco</strong> (não é zero).</li>
          <li>Clique em qualquer número para ver os lançamentos que o formam.</li>
        </ul>
        <p className="rounded-xl bg-navy-mist p-3">
          <strong>Exemplo (jul/2026):</strong> receita 14.955.162 − impostos 1.646.592 ={" "}
          <strong>ROL 13.308.570</strong>. Resultado final <strong>MC 1.763.243</strong>. Margem ={" "}
          1.763.243 ÷ 13.308.570 = <strong>13,2%</strong>.
        </p>
        <p className="text-xs text-muted-foreground">
          Gerentes veem apenas os CRs da própria carteira; a gestão vê todos.
        </p>
      </div>
    </InfoIndicador>
  )
}
