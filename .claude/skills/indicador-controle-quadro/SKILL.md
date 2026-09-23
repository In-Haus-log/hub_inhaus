---
name: indicador-controle-quadro
description: "Detalhes do indicador Controle de Quadro (/dashboards/rh/controle-quadro, src/lib/quadro.ts): filtros, cards, barras por CR/cargo, linha do tempo. Use ao mexer nesse indicador ou em FiltrosQuadro/BarrasQuadro/LinhaQuadro."
---

# Indicador REAL: Controle de Quadro (`/dashboards/rh/controle-quadro`)
Único indicador ligado a dados reais. Lê a view `vw_sra_geral` (banco `db_inhaus`,
`DATABASE_URL_INHAUS`). Módulo de dados: `src/lib/quadro.ts` (regras de negócio no topo).
- **Gerente regional fixo** = Lucas Rodrigues da Silva (não é filtro).
- **Filtros de múltipla escolha**: Gerente, Centro de Resultado (CR) e Mês
  (`MultiCombobox` pesquisável), e Cargos (`SeletorCargos`, exclusão). Estado na URL
  (params repetidos `ger`, `cr`, `mes`, `excluir`). Selecionar TODAS as opções de um
  dropdown = nenhum filtro (todos). Botão "Limpar filtros". Painel de filtros **suspenso**
  (`FiltrosQuadro`), acionado por um botão; badge conta filtros isolados ativos.
- **Cards** (lado a lado): total de colaboradores (matrícula distinta), desligamentos no
  mês (por data de demissão), e situações (em atividade / férias / afastados).
- **Total por CR** e **Total por cargo**: barras horizontais (`BarrasQuadro`), no último
  dia disponível, top 15 com scroll. O nome do CR aparece inteiro, em uma linha.
- **Quadro ativo por dia**: `LinhaQuadro` — total em cada data de referência (fotografia
  real; não inventa dias sem coleta). **Quadro médio por mês**: média das fotografias do mês.
- Botão **info** (`InfoIndicador`) com todas as regras em linguagem de negócio.
