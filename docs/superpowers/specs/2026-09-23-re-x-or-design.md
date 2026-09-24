# RE x OR — Realizado × Orçado

**Data:** 2026-09-23 · **Status:** implementado (branch `feat/projecoes`)
**Onde:** Financeiro › **RE x OR** (dentro do `hub_inhaus`)

---

## 1. Objetivo

Trazer para o hub o relatório **RE x RO** do sistema da GPS (Realizado × Orçado contábil) e
permitir analisá-lo numa **tabela dinâmica** — o mesmo resultado do BI **1.2.05 – Dinâmica Mês RE**,
com a liberdade de quebrar a análise por gerente, CR, PEC, cliente, conta etc., e de comparar
realizado com orçado.

## 2. Nomenclatura de negócio

| Termo | Significado | Cálculo |
|---|---|---|
| **ROL** | Resultado Operacional Líquido — a receita líquida | Receita Bruta (311) + Deduções de Receita (312) = todo o grupo **3 – RECEITA** |
| **MC** | Margem de Contribuição — o "lucro de fato" | Soma de **todos** os lançamentos (receitas + custos e despesas) = linha TOTAL do BI |
| **% Margem** | Rentabilidade | MC ÷ ROL |

Conferido em jul/2026 (carteira Lucas): ROL 13.308.570 · MC 1.763.243 · Margem 13,2%.

## 3. Decisões

| # | Decisão |
|---|---|
| D1 | Indicador **dentro do hub_inhaus**, domínio **Financeiro**, nome **"RE x OR"**. |
| D2 | Carga por **RPA** gravando no banco; enquanto o RPA não existe, histórico por **script Python** com a mesma regra (o script é a referência do RPA). |
| D3 | Fonte única: o relatório **RE x RO**. |
| D4 | Recorte: **carteira do gerente geral Lucas Rodrigues da Silva**, de **jul/2025** em diante. Ampliar = o RPA exportar sem o filtro; nada no hub muda. |
| D5 | Acesso: **gestão vê tudo; gerentes veem só os seus CRs** (isolamento por CR existente). |
| D6 | Uma tabela de lançamentos no grão do export + agregação na consulta. Consultas isoladas em `src/lib/projecoes/`, para permitir um agregado materializado no futuro sem mexer na tela. |
| D7 | Recarga **por mês de competência**: os meses presentes no arquivo são substituídos integralmente. |
| D8 | **Uma tela única** com tabela dinâmica (dimensões empilháveis nas linhas, meses nas colunas). |
| D9 | Valor padrão **Realizado**; seletor para Orçado, Diferença (R$) e Diferença (%). |
| D10 | Tabelas `ft_real_orcado`, `dm_conta` e `ft_carga_real_orcado`, cada uma com `COMMENT ON TABLE`. |
| D11 | A coluna `CONQ PERDA` é guardada como veio, mas não é usada. |

## 4. Fluxo dos dados

```
Sistema GPS ──exporta RE x RO──► RPA / script ──grava (1 transação)──► ft_real_orcado ─┐
                                       └──registra a execução──► ft_carga_real_orcado    │
                                                  dm_conta (dicionário do DRE) ──────────┤
                                                                                         ▼
                        Hub: filtra CRs do usuário → soma por dimensões/mês → tabela dinâmica
```

1. O sistema da GPS gera o RE x RO (1 linha = 1 lançamento: valor numa conta, num CR, num mês).
2. O RPA (ou o script) grava os lançamentos na `ft_real_orcado`, substituindo os meses do
   arquivo, e registra a execução na `ft_carga_real_orcado`.
3. O hub junta com a `dm_conta` para dar nome e ordem às linhas do DRE.
4. O hub aplica o escopo de CRs do usuário, soma e mostra.

## 5. Modelo de dados

SQL aditivo e idempotente em `prisma/sql/014_projecoes.sql` (**nunca** `prisma db push`),
aplicado com `python scripts/aplicar_sql.py`; models no `schema.prisma` + `prisma generate`.

### 5.1 `ft_real_orcado` (fato)

Lançamentos contábeis de Realizado e Orçado por CR e conta, no mesmo grão do RE x RO.

| Coluna | Tipo | Origem no export | Obs. |
|---|---|---|---|
| `competencia` | date | `MES` (`2026/07` → `2026-07-01`) | sempre dia 1 |
| `valor_realizado` / `valor_orcado` | numeric(18,2) | `RE` / `OR` | nunca os dois na mesma linha |
| `origem` | text | `ORIGEM` | `SC` (contábil) \| `ORCAMENTO` |
| `conta`, `desc_conta`, `grupo1`, `grupo2` | text | idem | conta com 8 dígitos |
| `cr`, `centro_custo`, `pec` | text | idem | brutos (`CODIGO - Nome`) |
| `cliente`, `seg_cliente`, `tipo_cliente`, `regional`, `negocio`, `solucao`, `grupo_ind` | text | idem | |
| `gerente`, `supervisor`, `gerente_geral`, `dir_reg`, `dir_exe` | text | idem | |
| `empresa`, `emp_ctb`, `nome_emp_ctb`, `reg_emp_ctb`, `reg_cr`, `historico`, `lote`, `conq_perda` | text | idem | |
| `carga_id` | bigint FK | — | rastreia a execução |
| **Geradas pelo banco:** `cr_cod`, `pec_cod`, `pec_situacao`, `conta_mae` | text | derivadas | o RPA não grava |

`pec_situacao` ∈ `ATIVO` \| `ENCERRADO` \| `APRENDIZ/INDIRETO`. Índices em `competencia`,
`(cr_cod, competencia)`, `(conta_mae, competencia)` e `pec_cod`.

### 5.2 `dm_conta` (dimensão)

Plano de contas gerencial do DRE: uma linha por conta-mãe (5 dígitos) com `nome`, `grupo2`,
`ordem` e `ativo`. Carga inicial: as 30 linhas do BI 1.2.05 (31101 … 44101), na ordem do BI.

### 5.3 `ft_carga_real_orcado` (log de cargas)

Uma linha por execução: `iniciado_em`, `concluido_em`, `origem` (`RPA` \| `SCRIPT`),
`competencias`, `linhas`, `total_realizado`, `total_orcado`, `status` (`OK` \| `ERRO`), `mensagem`.

### 5.4 Contrato de carga (RPA e script)

Numa **única transação**:
0. Trava exclusiva de carga (advisory lock), impedindo cargas simultâneas — sem ela, duas
   cargas sobrepostas podem duplicar um mês.
1. Registra a execução em `ft_carga_real_orcado`.
2. Apaga de `ft_real_orcado` os meses de competência presentes no arquivo.
3. Insere todos os lançamentos do arquivo com `carga_id`.
4. Fecha a execução com totais, `concluido_em` e `status = 'OK'`.

Falha em qualquer passo ⇒ rollback (a tela nunca vê meio mês) e a falha é registrada numa
transação separada com `status = 'ERRO'`, sem mascarar o erro original. Rodar duas vezes o
mesmo arquivo dá o mesmo resultado.

Script: `python scripts/carga_real_orcado.py <arquivo.xlsx> [--apply] [--origem SCRIPT|RPA]`
(sem `--apply` apenas simula).

## 6. Tela RE x OR

**Rota:** `/dashboards/financeiro/projecoes` · **Chave de permissão:** `projecoes-analise`
(nomes internos mantidos; o nome exibido é "RE x OR"), registrada em `src/lib/domains.ts`.

### 6.1 Controles

| Controle | Opções |
|---|---|
| **Linhas** (empilháveis, até 5 níveis) | Gerente · Supervisor · PEC · CR · Cliente · Regional · Negócio · Situação do PEC · Grupo de contas · Conta · Subconta |
| **Colunas** | Meses do período (mais recente primeiro) + **Total do período** |
| **Valores** | **Realizado** (padrão) · Orçado · Diferença (R$) · Diferença (%) |
| **Filtros** | Período (de/até) + qualquer dimensão |

Estado na URL (compartilhável). Abre com Linhas = Conta e os últimos 12 meses com dado —
reproduz o BI 1.2.05. "Salvar como meu padrão" guarda a montagem no navegador.

### 6.2 Regras de cálculo

- **Célula** = soma dos lançamentos da linha × mês, no valor escolhido. Receita positiva, custo negativo.
- **Linhas de resumo** (ROL, MC, % Margem) ao fim de cada linha aberta de dimensão
  organizacional e no total geral; não aparecem sob conta/grupo/subconta.
- **Diferença (R$)** = Realizado − Orçado. **Diferença (%)** = (Realizado − Orçado) ÷ |Orçado|.
  Positivo é sempre favorável (verde), negativo desfavorável (vermelho).
- **% Margem por valor exibido:** Realizado/Orçado = MC ÷ ROL; Diferença (R$) = variação da
  margem em pontos percentuais; Diferença (%) = "—" (não se calcula variação percentual de um percentual).
- ROL = 0 ou Orçado = 0 ⇒ "—". **Mês sem lançamento** ⇒ célula vazia (não zero).

### 6.3 Interação

- ⊞/⊟ abre e fecha cada linha (busca sob demanda); botões "Abrir 1º nível" e "Recolher tudo".
- **Clique num número** ⇒ janela com os lançamentos que o formam (paginada) e
  **Exportar para Excel** (CSV; campos de texto protegidos contra fórmulas).
- Rodapé "Dados atualizados em dd/mm às hh:mm" (última carga OK); aviso de falha de carga só para a gestão.
- Botão **info** com as regras em linguagem de negócio e o exemplo de julho/2026.

## 7. Segurança e isolamento

- `resolverEscopoDados()` resolve o escopo. **Trava 1** (filtro de CR) em toda consulta;
  **Trava 2** (`assertLinhasNoEscopo`) sempre que o CR vem na saída — nível CR, lançamentos,
  CSV e opções do filtro de CR. Escopo vazio ⇒ nada (fail-closed).
- Todas as rotas `/api/projecoes/*` exigem a tela concedida e aplicam o escopo.
- Vínculo gerente → CRs pela tela **Usuários** (seletor de CRs reativado). A lista inclui os
  CRs do cadastro e os que só existem no RE x RO. Os CRs vinculados valem para todos os
  indicadores recortados por CR.

## 8. Dados incompletos

| Situação | Comportamento |
|---|---|
| Conta-mãe sem cadastro na `dm_conta` | Linha "CONTA NÃO MAPEADA"; nunca some do total. |
| Valor vazio numa dimensão | Linha "(sem valor)". |
| Nenhum dado no escopo do usuário | Estado vazio explicando que ainda não há lançamentos carregados. |
| Última carga com erro | Aviso para a gestão; exibe os dados da última carga concluída. |

## 9. Verificação

- Tela padrão = BI 1.2.05 conta a conta: TOTAL jun/2026 **1.407.294**, jul/2026 **1.763.243**;
  ROL jul/2026 **13.308.570**.
- Testes: `src/lib/projecoes/*.test.ts` (vitest) e `scripts/test_carga_real_orcado.py` (pytest).
- `npx tsc --noEmit` e `npm run build` limpos.

## 10. Pendências

- Exports do RE x RO de **jul/2025 a mai/2026** para completar o histórico.
- Construção do RPA seguindo `scripts/carga_real_orcado.py`.
