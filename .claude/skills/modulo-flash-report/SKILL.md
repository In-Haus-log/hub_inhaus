---
name: modulo-flash-report
description: "Flash Report (Financeiro): projeção semanal de receita por PEC — parametrização de itens cobrados, lançamento semanal por teclado, envio/reabertura, consolidado e Excel no layout do corporativo (src/lib/flash, /dashboards/financeiro/flash-report, /api/flash, tabelas dm_flash_*/ft_flash_*). Use ao mexer em qualquer parte do Flash Report."
---

# Flash Report — projeção semanal de receita por PEC

Spec: `docs/superpowers/specs/2026-09-27-flash-report-design.md` ·
Plano: `docs/superpowers/plans/2026-09-27-flash-report.md`

## Ideia
O gestor parametriza **uma vez** os itens cobrados de cada PEC e, **toda semana**, ajusta só o que
mudou. Cada semana (1 a 5 do mês) projeta o **mês inteiro**. O financeiro acompanha os envios,
reabre quando preciso e exporta o Excel para o corporativo. **Fase 1 = só receita** (custos/MC depois).

## Telas (registradas em `src/lib/domains.ts`)
- `flash-report` → `/dashboards/financeiro/flash-report` — Meus PECs (cartões) + adicionar PEC.
- `/dashboards/financeiro/flash-report/[pec]?mes=&semana=&aba=lancamento|parametrizacao` — KPIs,
  seletor de semana, `GradeLancamento` (Enter desce, autosave 800 ms, envio com resumo de→para) e
  `Parametrizacao` (5 tipos, conta do DRE via Combobox, área opcional).
- `flash-report-consolidado` → `/dashboards/financeiro/flash-report/consolidado?mes=` — painel de
  envios da semana, tabela gerente → PEC × semanas + realizado, reabrir (motivo), Exportar Excel.
- Info (`src/components/flash/FlashInfo.tsx`) em todas as telas — sincronizar com `calculos.ts`.

## Código
- `src/lib/flash/semanas.ts` — regra da semana (⌈dia÷7⌉, fuso SP). **Única** fonte da regra.
- `calculos.ts` — valor do item, bruta, líquida, alíquota, semana nova, alterações (puro, testado).
- `validacao.ts` — zod + `validarQuantidades` (pessoas = inteiro).
- `sql.ts` — `filtroCr` (Trava 1 nas tabelas do Flash, coluna já é o código de 5 chars).
- `dados.ts` — tudo que toca o banco; Trava 1 em toda query, Trava 2 (`assertLinhasNoEscopo`) em toda saída com CR. `ErroFlash(status)`.
- `excel.ts` — .xlsx (exceljs) no layout da guia "Flash Report"; **só semanas ENVIADAS**; MC/% vazios.
- `acesso.ts` — `guardaFlash({consolidado})`; reabrir e Excel exigem a tela de consolidado.

## Tabelas (`prisma/sql/015_flash_report.sql`, nunca `db push`)
`dm_flash_pec` (PEC habilitado, `cr_cod`), `dm_flash_item` (tipo PESSOAS|UNITARIO|HORA_EXTRA|DESCONTO|FIXO,
valor, qtd padrão, `conta` = conta-mãe do `dm_conta`, agrupador), `ft_flash_semana` (mes+semana, status
RASCUNHO|ENVIADO|REABERTO, totais, alíquota aplicada), `ft_flash_semana_item` (quantidade + valor
unitário **congelado**), `ft_flash_evento` (ENVIO/REABERTURA, quem, motivo).

## Regras de negócio
- Item = valor unitário × quantidade; DESCONTO negativo. Bruta = Σ itens. Líquida = bruta × (1 − alíquota).
- Alíquota (provisória) = −impostos (31201) ÷ receita bruta (31101) do PEC nos últimos 3 meses do RE x OR; sem histórico → `ALIQUOTA_PADRAO` (14,25%).
- Semana nova = cópia da última **ENVIADA**; itens novos com qtd padrão; desativados saem.
- Tarifa alterada / item novo ou desativado afetam só semanas em RASCUNHO. REABERTO mantém composição e valores congelados.
- Semana enviada é imutável (409) até o financeiro reabrir; status relido com `for update` na transação (corrida envio × autosave) e reabertura condicional no SQL.
- `periodoSchema` rejeita semana que não existe no mês. PEC nunca troca de CR ao ser re-habilitado; semanas de outro CR não aparecem.
- Realizado de comparação = ROL (`grupo1 like '3%'`) do RE x OR.

## Pendências do usuário (lembrar)
1. Regra definitiva de contagem das semanas do mês.
2. Prazo de envio (dia/hora).
3. Percentuais fixos de impostos por PEC (substitui a média de 3 meses).
Fase 2: custos (folha, benefícios, glosas) e MC/% — virão de relatórios do portal.
