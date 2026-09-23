---
name: modulo-treinamentos
description: "Módulo de Treinamentos (registro por QR + CPF, rota pública /t/[token]) e painel Controle de Capacitação (src/lib/capacitacao.ts): telas, regras de CPF, filtros, cards, importador de histórico. Use ao trabalhar em treinamentos ou capacitação."
---

# Módulo de Treinamentos + Controle de Capacitação (RH)
Registro de presença em treinamentos por **QR + CPF** e um **painel gerencial** de capacitação.
Duas telas, ambas no domínio **RH**, agrupadas na sidebar sob a subdivisão **"Capacitação"**
(feature nova `divisao` em `domains.ts`/`DashboardSidebar`): *Controle de Capacitação* acima de
*Treinamentos*.
- **Telas / chaves de permissão** (`src/lib/domains.ts`): `treinamentos-registro` →
  `/dashboards/rh/treinamentos` (ferramenta); `treinamentos-visao-geral` →
  `/dashboards/treinamentos` (painel gerencial). A tela do painel foi **movida** do antigo domínio
  "treinamentos" para dentro de RH; aquele domínio agora só tem telas `emBreve` (não aparece na
  sidebar). Guardas: páginas usam `assertTelaVisivel`; API usa `guardaInterno()`
  (`src/lib/treinamentos/guarda.ts`, honra o acesso livre de dev).
- **Registro** (`src/lib/treinamentos/index.ts`; tabelas `treinamento`, `treinamento_responsavel`,
  `treinamento_presenca`; SQL `prisma/sql/011_treinamentos.sql` + `012_treinamento_cpf.sql`):
  cria treinamento (nome, data, duração, responsável de lista própria), gera **token público
  estável** para o QR, lista presença, **editar** (dialog) e **encerrar** (dialog de confirmação —
  depois não gera mais QR nem aceita presença). Responsáveis num cadastro próprio
  (`treinamento_responsavel`), escolhidos por `Combobox`.
- **Rota pública** `/t/[token]` (liberada no `middleware.ts`; POST em `/api/t/[token]/confirmar`):
  o participante digita **só os 11 dígitos** do CPF e confirma. Identidade = **HMAC do CPF**
  (`EPI_CPF_SECRET`); idempotente por `(treinamento, cpf_hash)`. Resolve o colaborador no quadro
  ativo da SRA (`colaborador.ts`) — congela nome/CR/cargo/matrícula no snapshot.
- **CPF em claro (`cpf_texto`) é gravado APENAS de quem NÃO foi localizado na SRA** (para o RH
  identificar quem é); localizados ficam só com o hash. A coluna CPF da tabela de presença só
  mostra o CPF dos não-localizados. A coluna **Unidade (CR)** é exibida em CAIXA ALTA.
- **Controle de Capacitação** (`src/lib/capacitacao.ts`): visão gerencial. Filtros
  **mês / cliente / CR / responsável** (cliente e CR derivados de `dm_cr` pelo `crCod` da presença).
  Cards: **colaboradores treinados** (distintos por `cpf_hash`) e **horas treinadas** (soma das
  presenças × duração), média h/colaborador e treinamentos realizados. **Linha do tempo** por mês
  **ignora o filtro de mês** (mostra sempre a tendência completa). Barras por CR, cargo e
  treinamento (rótulos quebram em 2 linhas); tabela paginada/classificável (`TabelaTreinamentos`,
  reaproveitada com `editavel=false`). Botão **Tela cheia** (Fullscreen API) para TV. Botão info.
  - **Filtro de mês**: abre no **mês atual** por padrão; sentinela `mes=todos` na URL = todos os
    meses (usado por "Limpar filtros" e ao desmarcar). CR sempre em CAIXA ALTA (filtro e barras).
- **Dados**: seed de dev `scripts/seed_treinamentos.mjs`. Importador de histórico de planilha
  (Planilha2 de um xlsx) em `scripts/import_presenca.mjs` — resolução **dupla CPF→nome** no quadro
  SRA (nome só casa se for match único), responsável "Importação (histórico)", 1h, encerrado;
  **idempotente** (reexecutar substitui a importação anterior).
