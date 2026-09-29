---
name: modulo-projecoes
description: "Projeções (Financeiro): visão de PECs com ROL/MC/% Margem e parametrização do PEC; e o indicador RE x OR (Financeiro): Realizado × Orçado do relatório RE x RO (ft_real_orcado, dm_conta, ft_carga_real_orcado), carregador/RPA, tabela dinâmica em /dashboards/financeiro/projecoes, ROL/MC/% Margem. Use ao mexer em src/lib/projecoes ou na carga do RE x RO."
---

# Projeções (visão de PECs) e indicador RE x OR

## Estado atual (atenção)
- A tela `projecoes-analise` (`/dashboards/financeiro/projecoes`) agora é a **visão de PECs: ROL, MC e
  % Margem** por PEC, por mês/semana, com "Agrupar por" PEC/CR/Gerente/Cliente e busca. Lê do **Flash
  Report** (semanas lançadas) por `src/lib/projecoes/visao.ts` + `agrupar.ts`; componentes
  `SeletorPeriodo`, `ListaPecs`, `ProjecoesVisaoInfo` em `src/components/projecoes/`. Isolamento por CR
  nas duas travas.
- A **tabela dinâmica do RE x OR** foi para `/dashboards/financeiro/projecoes/re-x-or` (**fora do menu**,
  ainda funcional). As rotas `/api/projecoes/*` e os componentes antigos seguem os mesmos.
- A **parametrização do PEC** fica em `/dashboards/financeiro/projecoes/[pec]`
  (`ParametrizacaoPec.tsx` + `ParametrizacaoInfo.tsx`): receitas e custos do PEC, CR por item. A aba
  `?aba=parametrizacao` do Flash redireciona para lá. SQL: `prisma/sql/016_projecoes_parametrizacao.sql`.
  Detalhes do item/cálculo em `modulo-flash-report`.
- O restante deste arquivo é o histórico do **RE x OR** (Realizado × Orçado).

# Indicador RE x OR — Realizado × Orçado

Spec: `docs/superpowers/specs/2026-09-23-re-x-or-design.md` ·
Plano: `docs/superpowers/plans/2026-09-23-projecoes-base-historica.md`.

- **Fonte:** relatório **RE x RO** do sistema da GPS (1 linha = 1 lançamento: conta × CR × mês;
  `RE` = realizado, `OR` = orçado, nunca os dois na mesma linha). Recorte atual: carteira do
  gerente geral Lucas Rodrigues da Silva, desde jul/2025.
- **Tabelas** (`prisma/sql/014_projecoes.sql`): `ft_real_orcado` (grão do export; colunas
  GERADAS `cr_cod`, `pec_cod`, `pec_situacao`, `conta_mae` — nunca gravar), `dm_conta` (30 linhas
  do BI 1.2.05: nome/ordem/grupo), `ft_carga_real_orcado` (log de cargas).
- **Carga:** `scripts/carga_real_orcado.py` (referência para o RPA, Python + psycopg2): numa
  transação trava exclusiva de carga (advisory lock, impede cargas simultâneas duplicarem
  um mês), apaga os meses do arquivo e reinsere; falha ⇒ rollback + registro `ERRO`.
  Simulação por padrão; `--apply` grava. Idempotente.
- **Regras:** ROL = grupo `3 - RECEITA` (receita bruta + deduções); MC = soma de tudo (TOTAL do BI);
  % Margem = MC ÷ ROL. Diferença % = (R − O) ÷ |O|; positivo = favorável. Mês sem dado = vazio.
  % Margem por medida — Realizado/Orçado = MC ÷ ROL; Diferença (R$) = variação em p.p.; Diferença (%) = "—" (intencional).
  Texto do info em `ProjecoesInfo.tsx` ⇄ topo de `src/lib/projecoes/calculos.ts` (manter em sincronia).
- **Código:** SQL puro e testado em `consulta.ts` (Trava 1 via `predicadoSraCr(escopo, "f.cr", n)`
  em TODA consulta); `dados.ts` executa e aplica a Trava 2 no nível CR e nos lançamentos. Estado da
  análise na URL (`n`, `med`, `de`, `ate`, `f_<dim>`; `c` = caminho da linha) em `parametros.ts`.
- **Tela "RE x OR"** (hoje em `/dashboards/financeiro/projecoes/re-x-or`, fora do menu): tabela dinâmica (níveis
  empilháveis, meses decrescentes + total), expansão sob demanda (`/api/projecoes/nivel`), detalhe
  e CSV (`/api/projecoes/lancamentos`), filtros (`/api/projecoes/opcoes`). Padrão salvo no navegador.
- **Acesso:** gestão (admin interno) vê tudo; gerente vê os CRs vinculados na tela Usuários
  (`SeletorCrs` → `auth_user_cr`). Sem CR vinculado ⇒ tela vazia (fail-closed).
- **Conferência:** TOTAL jun/2026 = 1.407.294, jul/2026 = 1.763.243; ROL jul/2026 = 13.308.570.
