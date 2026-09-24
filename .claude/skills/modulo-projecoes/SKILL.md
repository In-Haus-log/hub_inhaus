---
name: modulo-projecoes
description: "Módulo Projeções (Financeiro): base histórica Realizado × Orçado (ft_real_orcado, dm_conta, ft_carga_real_orcado), carregador/RPA do RE x RO, tabela dinâmica em /dashboards/financeiro/projecoes, ROL/MC/% Margem. Use ao mexer em src/lib/projecoes, na carga do RE x RO ou na etapa 2 (projeção de contratos)."
---

# Módulo Projeções — etapa 1 (base histórica)

Spec: `docs/superpowers/specs/2026-09-23-projecoes-base-historica-design.md` ·
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
- **Tela** `projecoes-analise` → `/dashboards/financeiro/projecoes`: tabela dinâmica (níveis
  empilháveis, meses decrescentes + total), expansão sob demanda (`/api/projecoes/nivel`), detalhe
  e CSV (`/api/projecoes/lancamentos`), filtros (`/api/projecoes/opcoes`). Padrão salvo no navegador.
- **Acesso:** gestão (admin interno) vê tudo; gerente vê os CRs vinculados na tela Usuários
  (`SeletorCrs` → `auth_user_cr`). Sem CR vinculado ⇒ tela vazia (fail-closed).
- **Conferência:** TOTAL jun/2026 = 1.407.294, jul/2026 = 1.763.243; ROL jul/2026 = 13.308.570.
- **Etapa 2 (pendente):** parametrização de contratos (taxas, produtividade, formas de cobrança por
  PEC/CR) e Flash Report semanal (ROL/MC/% projetado × realizado por PEC). Aguarda exemplo de
  cálculo de contrato do usuário.
