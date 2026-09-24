---
name: modulo-desvios
description: "Módulo Clientes/Desvios (Atlas Copco) e modelo de visibilidade de portal de cliente: governança em dois eixos, portal enxuto do CLIENTE, sidebar interna, desvios e listas configuráveis, tela de Usuários. Use ao mexer em /dashboards/clientes, desvios ou no portal do cliente."
---

# Módulo Clientes / Desvios (Atlas Copco) + modelo de visibilidade
Primeiro módulo de **cliente** do hub. Handoff completo:
`docs/superpowers/2026-08-25-modulo-clientes-desvios-handoff.md` (LER ao continuar esta frente).
- **Governança em dois eixos:** Eixo 1 = QUAIS telas (`AuthUser.visibleScreens[]` + `isAdmin`);
  Eixo 2 = QUAIS dados. Para os **desvios**, o escopo é **derivado das telas concedidas**
  (`src/lib/desvios/escopo-usuario.ts`) — quem tem as telas de um cliente vê os dados dele.
- **Cliente (classificacao=CLIENTE):** **portal enxuto** — sidebar mostra só as telas dele
  (com a logo do cliente), sem In-Haus/Clientes/domínios/Admin; `/dashboards` redireciona à 1ª
  tela. **Trava central** no `layout.tsx` (via header `x-pathname` do `middleware.ts`) bloqueia
  o CLIENTE de abrir qualquer rota fora das telas dele, mesmo por URL. Só dá para testar em
  **produção** (dev = admin).
- **Sidebar interna:** raiz = Visão Geral · **In-Haus** (áreas internas + EPI) · **Clientes**
  (drill-down cliente→telas) · Administração. Domínios em `domains.ts`: 5 internos + `epi`
  (só no seletor/palette; sidebar do EPI é por papel) + `clientes` (com `clientes[]`).
- **Desvios:** tabela `desvio` (SQL `009`), status `EM_TRATATIVA|PENDENTE|CONCLUIDA`, isolamento
  por contratante com 2 travas (`escopo-contratante.ts`). Telas em
  `/dashboards/clientes/atlas/desvios/{painel,,novo}`. Listas configuráveis por cliente
  (`desvio_opcao`, SQL `010`, `opcoes-cliente.ts`, diálogo admin `ConfiguradorListas`).
- **Tela de Usuários:** seletor de telas **agrupado** (`SeletorTelas`: áreas internas + por
  cliente) + toggle **"É cliente?"**. O seletor de **CR** foi **reativado** (`SeletorCrs`, para o
  indicador RE x OR — vale para todos os indicadores por CR). Os seletores de Clientes/Contratante
  continuam sem UI (o back-end de escopo por eles continua existindo).
- Pendências no handoff (§10): isolamento por URL p/ internos não-admin; readicionar seletor de
  CR quando preciso; decidir se EPI migra p/ telas visíveis; validar 2º cliente.
