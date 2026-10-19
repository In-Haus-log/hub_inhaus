# Base de conformidade legal

O esquema está definido em `prisma/sql/018_conformidade_legal.sql` para uso futuro pelo importador e pelo Power BI. A tabela de fatos é `public.ft_conformidade_legal`; `public.ft_conformidade_legal_carga` registra os arquivos e o estado de cada importação. O SQL é aditivo e idempotente. A aplicação no PostgreSQL deve ser manual, seguindo a regra do repositório de nunca usar `prisma db push` ou `prisma migrate` nesse banco.

## Granularidade e campos

Cada linha representa um colaborador dentro de uma competência, com sua hierarquia histórica preenchida e os indicadores do drill. A competência é armazenada como `date` no primeiro dia do mês. O CR é texto de até cinco caracteres em `cr_cod`, separado da descrição em `cr_nome`; zero à esquerda e códigos alfanuméricos são preservados. Os nomes de gerente regional, gerente, supervisor, função e colaborador são fotografias da extração, sem substituição posterior por cadastros atuais.

Os indicadores de ocorrências, processos e encerramentos são inteiros não negativos e aceitam `NULL` para preservar campo ausente. O ticket é `numeric(18,4)`, pode manter sinal negativo e não tem agregação automática. `linha_origem` guarda a linha da planilha e, junto com `carga_id`, é única. A constraint `ft_conformidade_legal_sem_total` recusa a palavra `Total` em qualquer dimensão textual. A ingestão também deve descartar totais e subtotais do drill.

As colunas do arquivo consolidado mapeiam para:

| Planilha | Banco |
|---|---|
| MÊS/ANO | `competencia` |
| GERENTE REGIONAL | `gerente_regional` |
| GERENTE | `gerente` |
| CR (código e descrição) | `cr_cod`, `cr_nome` |
| SUPERVISOR | `supervisor` |
| FUNÇÃO | `funcao` |
| COLABORADOR (nome) | `colaborador_nome` |
| CPF identificador | `cpf_hash` |
| INTERJORNADA | `interjornada` |
| LIMITE HR DIA | `limite_hr_dia` |
| LIMITE HR DIA EXCEÇÃO | `limite_hr_dia_excecao` |
| FOLGA SEMANAL | `folga_semanal` |
| 12X36 LIMITE FT MÊS | `x12x36_limite_ft_mes` |
| FÉRIAS COM PONTO | `ferias_com_ponto` |
| TOTAL OCORRÊNCIAS | `total_ocorrencias` |
| TOTAL PROCESSOS | `total_processos` |
| PROCESSOS ENCERRADOS | `processos_encerrados` |
| TICKET MÉDIO ENCERRADO | `ticket_medio_encerrado` |
| LINHA NA ORIGEM | `linha_origem` |

## CPF

CPF nunca deve ser salvo em claro, em staging persistente, em log ou em metadados da carga. O importador calcula HMAC-SHA-256 com o segredo institucional (`EPI_CPF_SECRET`) e grava apenas o hexadecimal em `cpf_hash`. Não usar SHA-256 simples para CPF, pois o espaço de busca é pequeno. Se a origem não trouxer CPF identificável, `cpf_hash` fica `NULL`; o nome continua sendo armazenado conforme a planilha.

## Cargas e escopo

Cada carga registra SHA-256 do arquivo, filtros da extração em JSON, SHA-256 dos filtros normalizados (`escopo_hash`), instante de extração quando conhecido, instante de importação, status e quantidade de registros detalhados. `extraido_em` pode ser `NULL`. O escopo distingue relatórios obtidos com filtros diferentes; o importador é responsável por canonicalizar os filtros antes de gerar seu hash.

O importador insere a carga como `PROCESSANDO`, grava apenas as linhas detalhadas e, depois da conferência, marca `COMPLETA`. Tudo acontece em uma transação; em falha, ocorre rollback integral e nenhuma carga parcial fica publicada. O status `FALHA` está reservado para um futuro acompanhamento persistente da RPA. A unicidade de `arquivo_sha256` e `escopo_hash` impede importar duas vezes o mesmo arquivo no mesmo escopo.

`public.vw_conformidade_legal` expõe as linhas da última carga `COMPLETA` por competência e `escopo_hash`, ordenada por `importado_em` e, em empate, pelo id. Assim, uma carga parcial ou falha não apaga a versão anterior. A view inclui `escopo_hash` e filtros para que o relatório do Power BI selecione um único escopo quando existirem extrações com filtros distintos. Cargas completas sem linhas não têm competência inferível a partir dos fatos e, portanto, não geram partição vigente; o importador deve considerar esse cenário na validação do arquivo.

## Power BI e agregação

O dataset deve usar a view vigente e filtrar para um único `escopo_hash` compatível com o relatório. A competência pode se relacionar a uma dimensão calendário; CR e hierarquia podem ser usados nos filtros do próprio fato ou em dimensões preparadas no modelo. A hierarquia da linha é histórica.

Ocorrências podem ser somadas sobre as linhas detalhadas se o indicador do arquivo for aditivo nesse nível. `total_processos`, `processos_encerrados` e `ticket_medio_encerrado` são preservados exatamente por linha, mas o arquivo observado repete esses números entre colaboradores e competências; portanto, não criar medidas de soma para eles sem uma regra de negócio que estabeleça sua granularidade. A view não deduplica, calcula médias nem agrega esses valores.

## Verificação conceitual do SQL

O script usa construções PostgreSQL já adotadas no repositório. A view seleciona a carga por competência e escopo e faz o vínculo também pela competência, evitando repetir os meses de uma carga. A aplicação é transacional pelo importador. Aplicado ao `db_inhaus` em 07/10/2026 pela variável `DATABASE_URL`; carga 1 concluída. Conferência direta da view: agosto 340 registros/1.140 ocorrências; setembro 352/1.052; outubro 90/126. Total: 782 registros, 511 colaboradores, 2.318 ocorrências e zero linhas de total. A reimportação do mesmo arquivo foi testada e ignorada sem duplicação. A conexão apresentou timeouts intermitentes; o prazo de conexão do importador é 45 segundos.

## Importador preparado

`scripts/importar_conformidade_legal.mjs` lê a exportação original por meio de `scripts/ler_drill_conformidade.py` (Python com openpyxl). A leitura preenche somente as células mescladas, rejeita cabeçalhos incompatíveis e dimensões ausentes, remove totais e rodapé, valida duplicatas e confere os sete indicadores de ocorrências com o total geral. O CPF bruto existe somente em memória durante a leitura e não é persistido pelo importador.

```powershell
# Ajustar ao Python com openpyxl disponível no ambiente.
$env:CONFORMIDADE_PYTHON = 'C:/caminho/python.exe'
# Selecionar explicitamente a conexão principal (opcional).
$env:CONFORMIDADE_DB_ENV = 'DATABASE_URL'
# Simulação: não conecta nem altera o banco.
node scripts/importar_conformidade_legal.mjs 'C:/caminho/export.xlsx'
# Aplicação: SQL aditivo e carga em uma transação.
node scripts/importar_conformidade_legal.mjs 'C:/caminho/export.xlsx' --apply
```

Resultado validado da exportação inicial: 782 detalhes, 484 totais excluídos, 511 colaboradores distintos e 2.318 ocorrências; competências de agosto a outubro de 2026. Sintaxe JavaScript e consistência dos dados locais verificadas. Reimportar o mesmo arquivo concluído não cria uma segunda carga.

## Dashboard no Hub In-Haus

A implantação atual usa `/dashboards/conformidade-legal`, acessível na sidebar em **In-Haus → Conformidade legal → Visão geral**. A abordagem Power BI abaixo foi substituída pela tela nativa; os artefatos antigos permanecem apenas como histórico.

A tela consulta `vw_conformidade_legal` no servidor, com permissão de tela `conformidade-legal` e as duas travas de escopo de CR. CPF e seus hashes não são enviados ao navegador: a contagem de pessoas utiliza identificadores ordinais efêmeros, válidos apenas naquela resposta. Pessoas sem identidade disponível ficam fora da contagem distinta.

Os seis cards somam ocorrências de cada tipo e calculam sua participação no total filtrado. Selecionar um card recorta os gráficos e o detalhe, mantendo os cards e o resumo no recorte dos filtros. Filtros de mês, CR, regional, gerente, supervisor e função iniciam recolhidos. A atualização mostra a última importação ou extração conhecida, em horário de Brasília, sem o nome do fuso no rótulo. O visual do dashboard usa o modelo inicial, sem objetos 3D.

O botão **Ver detalhamento** abre `/dashboards/conformidade-legal/detalhamento` preservando os filtros e o tipo selecionado. A tela tem busca, um seletor **Agrupar por** e uma tabela hierárquica expansível. O drill segue os próximos níveis de gestão até pessoa e competência. Pessoas distintas são contadas por identidade dentro de cada grupo; registros representam linhas detalhadas e podem repetir pessoas em meses diferentes. A interface não usa o configurador de tabela dinâmica de várias dimensões.

Verificação de leitura: `node scripts/verificar_conformidade_hub.mjs`. Resultado inicial: 782 registros, 511 pessoas, 40 CRs e 2.318 ocorrências. Não há percentual de conformidade sobre o quadro total nem agregação financeira.

## Modelo anterior do Power BI (histórico)

Fonte: `public.vw_conformidade_legal`, selecionando um escopo. Renomear a consulta para `Conformidade legal`. Ocultar identificadores técnicos, hashes de arquivo e colunas de processos/ticket dos visuais iniciais. O hash do colaborador pode ser usado nas medidas, sem exibição.

Relacionar uma dimensão de competência mensal (uma linha por primeiro dia de mês) em 1:N com a competência do fato. Uma dimensão de CR tem uma linha por código; aproveitar `dm_cr` para cliente e descrição, mas a hierarquia histórica deve ser a da extração. Função e gestores podem inicialmente ser filtros da própria tabela; não relacionar pessoas apenas pelo nome. Os filtros de acesso do hub não são transferidos automaticamente ao Power BI: definir acesso ao dataset e RLS de CR antes de compartilhar com clientes.

Medidas iniciais:

```dax
Total de ocorrências = SUM('Conformidade legal'[total_ocorrencias])
Colaboradores com ocorrência =
    CALCULATE(
        DISTINCTCOUNT('Conformidade legal'[cpf_hash]),
        'Conformidade legal'[total_ocorrencias] > 0,
        'Conformidade legal'[cpf_hash] <> BLANK()
    )
Interjornada = SUM('Conformidade legal'[interjornada])
Limite de horas diárias = SUM('Conformidade legal'[limite_hr_dia])
Limite de horas diárias - exceção = SUM('Conformidade legal'[limite_hr_dia_excecao])
Folga semanal = SUM('Conformidade legal'[folga_semanal])
Limite 12x36 = SUM('Conformidade legal'[x12x36_limite_ft_mes])
Férias com ponto = SUM('Conformidade legal'[ferias_com_ponto])
```

As medidas estão documentadas para implementação no Power BI; não foram executadas em um arquivo PBIX. O drill contém somente o recorte exportado (ativos e uma regional); não permite calcular taxa de conformidade ou percentual sobre o quadro total sem uma fonte correspondente de todos os colaboradores. Processos e ticket aguardam confirmação da regra de competência e agregação.

Página inicial proposta: total de ocorrências, colaboradores com ocorrência, evolução mensal, distribuição por tipo e matriz regional → gerente → CR → supervisor → função → colaborador. Totais da matriz são calculados pelas medidas, não por linhas de total importadas.


## Regra de acesso do indicador (07/10/2026)

Conformidade legal possui acesso integral por tela: quem tem a permissão conformidade-legal pode consultar todos os CRs, sem vínculo obrigatório com CR ou cliente. A regra vale para o dashboard e o detalhamento. Filtros são opcionais e não definem autorização. Sessões ausentes ou vencidas não recebem dados. Esta exceção é exclusiva deste indicador; o isolamento dos demais módulos permanece em vigor.


## Importação pelo painel

Administradores podem usar Importar Excel na página de Conformidade legal. O arquivo .xlsx (até 4 MB) deve manter os 17 campos, a hierarquia completa, o total geral e os filtros da extração do modelo original. A validação exclui totais/subtotais, confere a soma das ocorrências e bloqueia arquivos inconsistentes. A carga é gravada em transação, mantendo o histórico; reenvios idênticos não duplicam registros. O CPF é convertido em HMAC no servidor e não é gravado em texto. A página atualiza após o sucesso. O endpoint exige administrador, mesma origem e EPI_CPF_SECRET configurado.


## Reimportação por conteúdo (08/10/2026)

A comparação considera os registros de cada competência, incluindo hierarquia, colaborador identificado por HMAC, CR e métricas. Nome do arquivo, filtros de origem e ordem das linhas não determinam duplicidade. Períodos idênticos à versão atual são ignorados. Apenas períodos novos ou alterados são gravados. A view exibe uma única carga COMPLETA por competência, sem acumular escopos; a nova carga substitui o snapshot anterior daquele período. O histórico permanece disponível nas tabelas. A atualização deve conter o período completo, inclusive todos os CRs e funções. Cargas de períodos ausentes no arquivo permanecem vigentes. A publicação é transacional e serializada pelo lock de importação.

