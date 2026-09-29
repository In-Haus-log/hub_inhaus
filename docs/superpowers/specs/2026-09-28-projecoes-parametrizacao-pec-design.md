# Projeções — refazer a tela como visão de PECs (ROL, MC, % Margem) + parametrização do PEC

Data: 2026-09-28 · Branch de partida: `feat/flash-report`

## Objetivo

Refazer `/dashboards/financeiro/projecoes`. A tela atual (tabela dinâmica de RE x OR) foi
considerada complexa e carregada. A nova tela é simples e profissional: **lista de PECs com
ROL, MC e % Margem**, no estilo da lista do Flash Report, e uma tela própria para
**parametrizar o PEC** (receitas e custos).

## Decisões do cliente (2026-09-28)

- Por enquanto Projeções trata **só da parametrização dos contratos (PEC)**. Relatórios
  mensais (realizado/orçado) serão importados no futuro, por uma via própria para projeção.
- A parametrização mora **só em Projeções**. A aba "Parametrização" do Flash Report passa a
  levar para a mesma tela (uma fonte de verdade).
- A tabela atual de RE x OR **sai do menu**; o código e a carga ficam, escondidos.
- A tela principal mostra **apenas ROL, MC e % Margem**, uma linha por PEC (igual ao Flash
  Report). Sem conta, sem realizado, sem orçado.
- Custo é **lançado por semana** com valor unitário × quantidade, como a receita.
- **Sem vínculo com conta**: nem no cabeçalho do PEC nem nos itens.
- **Impostos e benefícios ficam para depois.** Não mexer na alíquota que o Flash já calcula.

## Fora do escopo

Realizado e orçado; tabela dinâmica de RE x OR; agrupar por conta; impostos e benefícios;
importação mensal nova; gerente no cabeçalho da parametrização.

## Dados

Mudança **aditiva**, em SQL manual idempotente `prisma/sql/016_projecoes_parametrizacao.sql`
(nunca `prisma db push`/`migrate`). Tabelas existentes mantêm o nome.

`dm_flash_item` (cadastro de itens do PEC):
- nova coluna `natureza` (`RECEITA` | `CUSTO`), padrão `RECEITA` (itens atuais continuam receita).
- `tipo` passa a aceitar também `TAXA` e `VARIAVEL` (custos); `HORA_EXTRA` vale para receita
  (cobrada) e custo — quem distingue é a `natureza`.
- `cr_cod` do item passa a ser **editável** (hoje é só copiado do PEC); o padrão vem do PEC.
- coluna `conta` deixa de ser usada e de ser exigida na validação/tela (fica no banco).

`ft_flash_semana_item`: congelar também `natureza` na semana enviada, junto do valor
unitário já congelado, para o histórico não mudar se o cadastro mudar.

Sem novas tabelas. `ft_flash_semana`, `ft_flash_evento`, `dm_flash_pec` inalteradas.

## Cálculo (por PEC, mês e semana)

- **ROL** = receita líquida da semana (`ft_flash_semana.receita_liquida`, já calculada no Flash).
- **Custos** = soma de `total` dos itens da semana com `natureza = CUSTO`.
- **MC** = ROL − Custos.
- **% Margem** = MC ÷ ROL (vazio quando ROL = 0).
- Total do recorte = soma dos PECs; % do total = MC total ÷ ROL total.
- Funções puras e testadas em `src/lib/flash/calculos.ts`.
- Semana sem lançamento aparece como "sem lançamento" (não como zero).

## Telas

**Principal — `/dashboards/financeiro/projecoes`** (chave `projecoes-analise` mantém a rota; o
nome/ícone em `domains.ts` passam a refletir "Projeções")
- Topo: título + `InfoIndicador` (regras de negócio, sem termo técnico), seletor de mês e
  semana, "Agrupar por" com PEC · CR · Gerente · Cliente.
- Três cards (ROL, MC, % Margem) do recorte atual — `glass`, `rounded-3xl`, destaque
  `bg-inhaus-grad`, `reveal`.
- Lista de PECs em cards/linhas no padrão do Flash Report, três valores por linha. Busca única
  + filtro discreto (gerente, CR). Clique no PEC → parametrização.
- Server Component por padrão; estado (mês, semana, agrupar, busca) na URL.

**Parametrização — `/dashboards/financeiro/projecoes/[pec]`**
- Cabeçalho: PEC e CR padrão (sem gerente, sem conta).
- Seções **Receitas** e **Custos**; item = tipo, valor unitário, quantidade padrão, CR do item.
- Custos: hora extra, taxa, variável.
- Reaproveita e amplia `src/components/flash/Parametrizacao.tsx` (mover, não reescrever);
  APIs de `src/app/api/flash/pecs/[pec]/itens` aceitam `natureza` e CR do item.
- A aba "Parametrização" de `flash-report/[pec]` redireciona para esta tela.

**Grade semanal do Flash:** ganha as linhas de custo (lançar quantidade) e mostra ROL, MC
e % da semana.

**RE x OR:** removida do menu (`domains.ts`); rota e código permanecem. A rota antiga deixa de
ser a tela principal (a página nova a substitui em `/dashboards/financeiro/projecoes`; a análise
antiga fica movida para uma rota escondida `/dashboards/financeiro/projecoes/re-x-or`).

## Acesso e isolamento

- Toda consulta por CR passa pela Trava 1 (`filtroCr` no Flash / `predicadoSraCr`) e a saída
  pela Trava 2 (`assertLinhasNoEscopo`).
- Custo com CR de item fora do escopo do usuário não entra na soma dele. O CR do item só pode
  ser escolhido dentre os CRs do escopo do usuário (validar no servidor).
- Fail-closed: sem CR vinculado ⇒ lista vazia.
- Telas protegidas pelas chaves já existentes; a parametrização exige a mesma permissão do
  Flash Report.

## Regras do projeto a cumprir

- Recolorir, não redesenhar (Amyris → navy/teal), tokens do Tailwind, sem hex solto;
  acessibilidade AA, foco visível, HTML semântico, `prefers-reduced-motion`.
- `InfoIndicador` preenchido e sincronizado com o cálculo (topo de `calculos.ts`).
- Textos em português do Brasil. `src/lib/domains.ts` é a única lista de telas.
- Skills `modulo-projecoes` e `modulo-flash-report` atualizadas na mesma tarefa.

## Testes e verificação

- Testes unitários das funções de ROL, Custos, MC e %; de validação (`natureza`, CR do item no
  escopo); de consulta (Trava 1 presente).
- `npx tsc --noEmit`, `npm run build`, e conferência dos números direto no banco.
- Revisão visual da tela principal e da parametrização com o acesso livre de dev.

## Execução

Planejamento e revisão pelo Opus; blocos independentes (SQL, regras + testes, tela principal,
parametrização, grade do Flash) executados por agentes Sonnet 5.5, em paralelo quando não
compartilham arquivos.
