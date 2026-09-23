# Projeções — Etapa 1: base histórica Realizado × Orçado

**Data:** 2026-09-23 · **Status:** aprovado em brainstorming, aguardando revisão da spec
**Módulo:** Financeiro › Projeções (dentro do `hub_inhaus`)

---

## 1. Contexto e objetivo

A In-Haus/GPS terceiriza mão de obra. O resultado de cada operação depende de receitas,
impostos, pessoal, transporte, glosas, ações trabalhistas etc. Hoje:

- O sistema da GPS exporta o relatório **RE x RO** (Realizado × Orçado contábil).
- O BI **1.2.05 – Dinâmica Mês RE** mostra esse relatório como DRE mês a mês.
- O **Flash Report** semanal (planilha) leva à diretoria, por PEC, o **Projetado × Realizado**
  de **ROL**, **MC** e **% Margem**. Os gerentes mandam só os números projetados; um analista
  consolida.

O projeto **Projeções** tem duas etapas:

1. **Etapa 1 (esta spec):** estruturar o **passado** — base histórica do RE x RO no hub e uma
   tela de análise dinâmica (estilo matriz de BI).
2. **Etapa 2 (fora desta spec):** estimar o **futuro** — parametrização dos contratos (taxas,
   produtividade, formas de cobrança) e quantidades mensais, gerando a projeção e o Flash.
   Depende de um exemplo de cálculo de contrato que o usuário vai enviar.

## 2. Nomenclatura de negócio

| Termo | Significado | Cálculo |
|---|---|---|
| **ROL** | Resultado Operacional Líquido — a receita líquida | Receita Bruta (311) + Deduções de Receita (312) = todo o grupo **3 – RECEITA** |
| **MC** | Margem de Contribuição — o "lucro de fato" | Soma de **todos** os lançamentos (receitas + custos e despesas) = linha TOTAL do BI |
| **% Margem** | Rentabilidade | MC ÷ ROL |

Conferido em jul/2026 (carteira Lucas): ROL 13.308.570 · MC 1.763.243 · Margem 13,2%.

## 3. Decisões tomadas

| # | Decisão |
|---|---|
| D1 | Módulo **dentro do hub_inhaus**, domínio **Financeiro**. |
| D2 | Carga por **RPA** gravando no banco (ainda não existe; esta spec define a tabela). Histórico inicial por **script** com a mesma regra. |
| D3 | Fonte única na etapa 1: **RE x RO**. Outras fontes (glosas, jurídico, SRA) ficam para depois. |
| D4 | Recorte: **carteira do gerente geral Lucas Rodrigues da Silva**, de **jul/2025** em diante. Ampliar = o RPA exportar sem o filtro; nada no hub muda. |
| D5 | Acesso: **gestão vê tudo; gerentes veem só os seus CRs** (isolamento por CR existente). |
| D6 | **Arquitetura A:** uma tabela de lançamentos no grão do export + agregação na consulta. Consultas isoladas em `src/lib/projecoes/` para permitir, no futuro, um agregado materializado sem mexer na tela. |
| D7 | Recarga **por mês de competência**: os meses presentes no arquivo são substituídos integralmente. |
| D8 | **Uma tela única** com tabela dinâmica (dimensões empilháveis nas linhas, meses nas colunas). |
| D9 | Valor padrão **Realizado**; seletor para Orçado, Diferença (R$) e Diferença (%). |
| D10 | Tabelas: `ft_real_orcado`, `dm_conta` e `ft_carga_real_orcado` (log de cargas), cada uma com `COMMENT ON TABLE`. |
| D11 | A coluna `CONQ PERDA` é guardada como veio, mas **ignorada** na etapa 1. |

## 4. Fluxo dos dados

```
Sistema GPS ──exporta RE x RO──► RPA ──grava (1 transação)──► ft_real_orcado ─┐
                                   └──registra a execução──► ft_carga_real_orcado
                                                                              │
                                          dm_conta (dicionário do DRE) ───────┤
                                                                              ▼
                        Hub: filtra CRs do usuário → soma por dimensões/mês → tabela dinâmica
```

1. O sistema da GPS gera o RE x RO (1 linha = 1 lançamento: valor numa conta, num CR, num mês).
2. O RPA grava os lançamentos na `ft_real_orcado`, substituindo os meses do arquivo, e registra
   a execução na `ft_carga_real_orcado`.
3. O hub junta com a `dm_conta` para dar nome e ordem às linhas do DRE.
4. O hub aplica o escopo de CRs do usuário, soma e mostra.

## 5. Modelo de dados

SQL aditivo e idempotente em `prisma/sql/014_projecoes.sql` (**nunca** `prisma db push`),
seguido dos models no `schema.prisma` e `prisma generate`.

### 5.1 `ft_real_orcado` (fato)

> COMMENT: *Lançamentos contábeis de Realizado e Orçado por CR e conta, no mesmo grão do
> relatório RE x RO do sistema da GPS. Alimentada por RPA com recarga por mês de competência
> (os meses presentes no arquivo são substituídos integralmente). Base histórica do módulo
> Projeções.*

| Coluna | Tipo | Origem no export | Obs. |
|---|---|---|---|
| `id` | bigserial PK | — | |
| `competencia` | date | `MES` (`2026/07` → `2026-07-01`) | sempre dia 1 |
| `valor_realizado` | numeric(18,2) | `RE` | 0 nas linhas de orçamento |
| `valor_orcado` | numeric(18,2) | `OR` | 0 nas linhas contábeis |
| `origem` | text | `ORIGEM` | `SC` (contábil) \| `ORCAMENTO` |
| `conta` | text | `CONTA` | 8 dígitos |
| `desc_conta` | text | `DESC CONTA` | |
| `grupo1` | text | `GRUPO1` | ex.: `3 - RECEITA` |
| `grupo2` | text | `GRUPO2` | ex.: `411 - CUSTOS COM PESSOAL` |
| `cr` | text | `CR` | bruto `CODIGO - Nome` |
| `centro_custo` | text | `CENTRO CUSTO` | |
| `pec` | text | `PEC` | bruto `NNNNNN (UF) - Nome / SITUACAO` |
| `cliente`, `seg_cliente`, `tipo_cliente` | text | idem | |
| `regional`, `negocio`, `solucao`, `grupo_ind` | text | idem | |
| `gerente`, `supervisor`, `gerente_geral`, `dir_reg`, `dir_exe` | text | idem | |
| `empresa` | text | `EMP M A` | |
| `emp_ctb`, `nome_emp_ctb`, `reg_emp_ctb`, `reg_cr` | text | idem | |
| `historico`, `lote` | text | idem | |
| `conq_perda` | text | `CONQ PERDA` | guardado, não usado (D11) |
| `carga_id` | bigint FK → `ft_carga_real_orcado` | — | rastreia a execução |
| **Derivadas** (`GENERATED ALWAYS AS … STORED`, o RPA não grava): | | | |
| `cr_cod` | text | código de 5 chars do `cr` | mesma regra de `codigoCr` |
| `pec_cod` | text | 6 primeiros chars do `pec` | |
| `pec_situacao` | text | trecho após o último `/ ` do `pec` | `ATIVO` \| `DESMOB` |
| `conta_mae` | text | `left(conta, 5)` | liga na `dm_conta` |

Índices: `(competencia)`, `(cr_cod, competencia)`, `(conta_mae, competencia)`, `(pec_cod)`.

### 5.2 `dm_conta` (dimensão)

> COMMENT: *Plano de contas gerencial do DRE do módulo Projeções: uma linha por conta-mãe
> (5 dígitos), com nome, grupo e ordem de exibição. Traduz as contas detalhadas dos
> lançamentos nas linhas do DRE.*

| Coluna | Tipo | Obs. |
|---|---|---|
| `conta_mae` | text PK | 5 dígitos, ex.: `41101` |
| `nome` | text | ex.: `PESSOAL` |
| `grupo2` | text | ex.: `411 - CUSTOS COM PESSOAL` |
| `ordem` | int | ordem de exibição no DRE |
| `ativo` | boolean | default true |

Carga inicial: as 31 linhas do BI 1.2.05 (31101 … 44101), com nome e ordem do BI.

### 5.3 `ft_carga_real_orcado` (log de cargas)

> COMMENT: *Registro de cada execução de carga do RE x RO (RPA ou script): quando rodou,
> quais meses substituiu, quantas linhas e os totais gravados. Usado para mostrar a data de
> atualização na tela e auditar cargas.*

| Coluna | Tipo |
|---|---|
| `id` | bigserial PK |
| `iniciado_em`, `concluido_em` | timestamptz |
| `origem` | text (`RPA` \| `SCRIPT`) |
| `competencias` | date[] |
| `linhas` | int |
| `total_realizado`, `total_orcado` | numeric(18,2) |
| `status` | text (`OK` \| `ERRO`) |
| `mensagem` | text |

### 5.4 Contrato de carga (RPA e script)

Numa **única transação**:
1. Insere a linha em `ft_carga_real_orcado` (status provisório).
2. `DELETE FROM ft_real_orcado WHERE competencia = ANY(<meses do arquivo>)`.
3. Insere todos os lançamentos do arquivo com `carga_id`.
4. Atualiza a carga com totais, `concluido_em` e `status = 'OK'`.

Falha em qualquer passo ⇒ rollback (a tela nunca vê meio mês). A falha é registrada numa
transação separada com `status = 'ERRO'`. Rodar duas vezes o mesmo arquivo dá o mesmo
resultado (idempotente).

Script de histórico: `scripts/import_real_orcado.mjs <arquivo.xlsx>` — mesma regra, `origem = 'SCRIPT'`.

## 6. Tela: Análise Realizado × Orçado

**Rota:** `/dashboards/financeiro/projecoes` · **Chave de permissão:** `projecoes-analise`
(registrada em `src/lib/domains.ts`, domínio Financeiro). Guard `assertTelaVisivel`.

### 6.1 Controles

| Controle | Opções |
|---|---|
| **Linhas** (empilháveis, ordem livre) | Gerente · Supervisor · PEC · CR · Cliente · Regional · Negócio · Situação do PEC · Grupo de contas · Conta (linha do DRE) · Subconta |
| **Colunas** | Meses do período + **Total do período** |
| **Valores** | **Realizado** (padrão) · Orçado · Diferença R$ · Diferença % |
| **Filtros** | Período (de/até) + qualquer dimensão das linhas |

Estado na URL (compartilhável). **Padrão de abertura:** Linhas = Conta, últimos 12 meses
com dado — reproduz o BI 1.2.05. Botão **"Salvar como meu padrão"** (por usuário).

### 6.2 Regras de cálculo

- **Valor de uma célula** = soma dos lançamentos que caem naquela combinação de linha × mês,
  no valor escolhido. Receita positiva, custo negativo (como no BI).
- **Linhas de resumo** ao fim de cada nível aberto e no total geral: **ROL**, **MC**,
  **% Margem** (seção 2).
- **Diferença R$** = Realizado − Orçado. **Diferença %** = (Realizado − Orçado) ÷ |Orçado|.
  Com o sinal contábil (receita +, custo −), diferença **positiva é sempre favorável**: verde
  = melhor que o orçado, vermelho = pior.
- **% Margem** com ROL = 0, ou **Diferença %** com Orçado = 0 ⇒ exibe "—" (nunca divide por zero).
- **Mês sem lançamento** ⇒ célula vazia (não zero), como no BI.

### 6.3 Interação

- ⊞/⊟ abre/fecha cada linha; "abrir/fechar nível" por dimensão.
- Cada nível é buscado **sob demanda** ao expandir (agregação no servidor com os filtros dos
  níveis-pai), para não trazer tudo de uma vez.
- **Clique num número** ⇒ janela com os lançamentos que o compõem (competência, conta,
  histórico, lote, CR, valor), paginada, com **exportar para Excel**.
- Rodapé: **"Dados atualizados em dd/mm às hh:mm"** (última carga `OK`).
- Botão **info** (`InfoIndicador`) ao lado do título, com as regras da 6.2 em linguagem de
  negócio e o exemplo de julho/2026.

## 7. Segurança e isolamento

- `resolverEscopoDados()` resolve o escopo; **Trava 1** `predicadoSraCr(escopo, "cr", n)` em
  **toda** query (agregação e detalhe); **Trava 2** `assertLinhasNoEscopo` sobre o resultado.
  Nas agregações, a Trava 2 exige que o `cr` venha junto quando a dimensão for CR; nos demais
  agrupamentos a Trava 1 é a garantia (as linhas agregadas não carregam CR).
- **Dependência:** o vínculo gerente → CRs usa `auth_user_cr` / `auth_user_cliente`, cujos
  seletores foram removidos da tela **Usuários** (pendência do handoff de Desvios §10).
  Esta etapa **reativa o seletor de CR** na tela Usuários para usuários internos.
- Lançamento com `cr_cod` nulo: só aparece para escopo `todos`.

## 8. Tratamento de erros e dados incompletos

| Situação | Comportamento |
|---|---|
| Conta-mãe sem cadastro na `dm_conta` | Valor entra numa linha **"Conta não mapeada (NNNNN)"**; nunca some do total. |
| CR sem código válido | Visível só para a gestão, rotulado "Sem CR". |
| Nenhuma carga ainda | Tela mostra estado vazio explicando que os dados ainda não foram carregados. |
| Última carga com `ERRO` | Aviso discreto para admin com a mensagem; dados exibidos são os da última carga `OK`. |

## 9. Verificação

- **Conferência com o BI:** a tela padrão reproduz o 1.2.05 **conta a conta**; TOTAL
  jun/2026 = **1.407.294** e jul/2026 = **1.763.243**; ROL jul/2026 = **13.308.570**.
- **Conferência no banco:** ROL e MC por PEC direto em SQL = tela.
- **Testes automatizados** (`src/lib/projecoes/*.test.ts`): agregação multi-nível, sinais,
  ROL/MC/% (inclusive ROL = 0), Diferença R$/% e cor, conta não mapeada, montagem do SQL com
  a Trava 1, e Trava 2 lançando com CR fora do escopo.
- `npx tsc --noEmit` e `npm run build` limpos.

## 10. Fora de escopo (etapa 1)

Projeção e parametrização de contratos · Flash Report semanal · Sumário Executivo ·
outras fontes (glosas, jurídico, SRA) · uso da `CONQ PERDA` · outros gerentes gerais ·
agregado materializado.

## 11. Pendências de insumo

- Exports do RE x RO de **jul/2025 a mai/2026** para a carga histórica.
- (Etapa 2) Exemplo de cálculo de contrato.
