# Flash Report — projeção semanal de receita por PEC (design)

Data: 2026-09-27 · Domínio: Financeiro · Status: aguardando revisão do usuário

## 1. Problema e objetivo

Hoje cada gerente projeta semanalmente o resultado dos seus contratos numa planilha e a
envia a um representante do financeiro, que consolida tudo à mão e encaminha ao
corporativo (planilha `FLASH REPORT LOGÍSTICA_SET26-SEM2`, guia "Flash Report"). O
processo é lento e repetitivo.

**Objetivo:** o gestor parametriza cada PEC uma vez e, a cada semana, ajusta só o que
mudou; o financeiro acompanha quem enviou e exporta o consolidado pronto, no layout atual.

**Sucesso:** semana sem mudança = 1 clique + Enviar; consolidado sem trabalho manual;
Excel idêntico ao atual para o corporativo.

## 2. Escopo

**Fase 1 (este spec):** somente **receita** (bruta e líquida).

**Fora de escopo:** custos (folha, benefícios, glosas — virão de relatórios do portal da
empresa), margem, aprovação em duas etapas, prazo de envio, uso em celular.

**Pendências a decidir pelo usuário (não bloqueiam a fase 1):**
1. Regra definitiva de contagem das semanas do mês.
2. Prazo de envio da projeção (dia/hora).
3. Percentuais fixos de impostos por PEC (até lá: média real dos últimos 3 meses).

## 3. Conceitos e regras de negócio

- **PEC**: unidade da parametrização e da projeção (ex.: 092454 · Basf/Suvinil · CR 43409).
  O gestor é o dono da parametrização dos seus PECs.
- **Semana**: semana do mês (Semana 1 a 5). **Cada semana projeta o fechamento do mês
  inteiro.**
- **Item cobrado**: linha da parametrização, de um tipo:
  | Tipo | Cálculo | Exemplo |
  |---|---|---|
  | Pessoas por função | tarifa × pessoas | Separador 1º T: R$ 6.978,41 × 15 |
  | Unitário × quantidade | valor × qtd | Caminhão (Arcelormittal): R$ X × 32 |
  | Hora extra | valor da hora × horas | HE 50%: R$ 48,00 × 400 h |
  | Desconto | −(valor × qtd) | faltas, glosa contratual |
  | Valor fixo | valor × 1 | mensalidade, investimento |
  Cada item tem: descrição, tipo, valor unitário, quantidade padrão, **conta do plano do
  DRE** (obrigatória; todas as contas disponíveis, as de receita `31101xxx` sugeridas
  primeiro) e agrupador opcional (área: A220, Loja Suvinil, D55…).
- **Regras de cálculo**
  1. Valor do item = valor unitário × quantidade (desconto entra negativo).
  2. Receita bruta projetada = Σ itens do PEC na semana.
  3. Receita líquida projetada = bruta × (1 − % impostos do PEC). % provisório = impostos
     realizados ÷ receita bruta realizada do PEC nos últimos 3 meses fechados (dados do
     RE x OR); sem histórico → % padrão definido pelo financeiro.
  4. Semana nova nasce copiada da última semana **enviada** do PEC (quantidades), com as
     tarifas vigentes.
  5. Alteração de tarifa vale da semana corrente em diante; semanas enviadas guardam o
     valor unitário do momento (não mudam retroativamente).
  6. Realizado para comparação vem do RE x OR (conta `31101` / receita líquida).
- **Fluxo**: Rascunho (salvamento automático) → **Enviado** (trava) → o financeiro pode
  **Reabrir** (registra quem, quando e motivo) → gestor reenvia.
- **Acesso**: gestor vê/edita só PECs dos seus CRs (Trava 1 + Trava 2 de
  `escopo-dados.ts`); financeiro/diretoria com escopo amplo veem o consolidado e reabrem.

## 4. Telas

Rotas sob `/dashboards/financeiro/flash-report` (registradas em `src/lib/domains.ts`).
Toda tela com botão **ⓘ** (`InfoIndicador`) explicando as regras acima em linguagem de
negócio, com exemplo numérico.

1. **Meus PECs** — cartões por PEC na semana corrente: status, receita projetada, variação
   vs. semana anterior; 1 clique abre o lançamento.
2. **Lançamento semanal do PEC** (tela principal)
   - Topo: mês, seletor de semana, status; faixa de 4 KPIs (bruta, líquida, variação vs.
     semana anterior, realizado do último mês fechado).
   - Abas **Lançamento** | **Parametrização**.
   - Tabela agrupada por tipo/área com subtotal; colunas: item, tarifa, semana anterior,
     **esta semana (única editável)**, total. Marca ◆ nas linhas alteradas.
   - Teclado: foco inicial no 1º campo; Enter desce, Tab avança. Botão "Repetir semana
     anterior". Grupos sem alteração recolhidos quando o PEC tem muitas linhas.
   - Rodapé fixo: total, nº de alterações, comentário opcional, **Enviar semana** (mostra
     resumo "15 → 13" antes de confirmar).
   - Parametrização: incluir/editar/desativar itens (item desativado some das semanas
     seguintes, preserva o histórico).
3. **Consolidado** (financeiro/diretoria)
   - Painel de envio: "12 de 15 PECs enviados" + lista de pendentes.
   - Tabela gerente → PEC: projeção de cada semana do mês, realizado, receita
     bruta/líquida; ação Reabrir.
   - **Exportar Excel** no layout da guia "Flash Report" atual.

Visual: padrão do hub (vidro, `rounded-3xl`, navy/teal, Space Grotesk + Inter, `.reveal`);
números tabulares alinhados à direita; verde/vermelho só na variação. AA e foco visível.

## 5. Dados (tabelas novas, SQL manual idempotente em `prisma/sql/`, nunca `db push`)

- `dm_flash_pec` — PEC habilitado no Flash Report: `pec_cod`, `cr_cod`, nome, gestor
  (`authUserId`), ativo.
- `dm_flash_item` — itens da parametrização: pec, descrição, tipo, valor unitário,
  quantidade padrão, `conta_mae`/conta (FK lógica para `dm_conta`), agrupador, ordem,
  ativo, vigência inicial.
- `ft_flash_semana` — cabeçalho da projeção: pec, `cr_cod`, mês, semana (1–5), status,
  comentário, enviado_por/em, totais bruto/líquido, % impostos aplicado.
- `ft_flash_semana_item` — linha da projeção: semana, item, valor unitário (cópia),
  quantidade, total.
- `ft_flash_evento` — trilha: envio, reabertura (quem, quando, motivo).

Todas com `cr_cod` para passar pelas duas travas de isolamento.

## 6. Importação de apoio

- Importar parametrização a partir do Excel do BM de um contrato (ex.: BM Basf maio/2026:
  aba "BM", colunas descrição / unidade / tarifa / qtd., blocos por área) — gestor revisa
  antes de gravar.
- Importar histórico das semanas da planilha Flash Report (opcional, após a fase 1).

## 7. Testes e verificação

- Unitários do cálculo (tipos, desconto negativo, cópia da semana, vigência de tarifa,
  % impostos com e sem histórico).
- Isolamento: gestor não lê/grava PEC fora do escopo; Trava 2 lança em vazamento.
- Fluxo: rascunho → enviado (bloqueia edição) → reaberto → reenviado.
- Excel exportado conferido contra a planilha SET26-SEM2.
- `npx tsc --noEmit`, `npm run build`, conferência dos totais no banco.
