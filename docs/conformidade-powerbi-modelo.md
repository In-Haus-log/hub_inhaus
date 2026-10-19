# Modelo semântico de conformidade legal

O builder `scripts/build_conformidade_semantic.mjs` exporta `criarModelo({servidor, banco, escopoHash, snapshotRows = []})` e retorna o objeto `model.bim` em TMSL para um projeto PBIP versão 1. Por padrão, o relatório abre offline com o snapshot de `snapshotRows` embutido. Não há credenciais no modelo. O parâmetro M lógico `UsarBanco` começa como `false`; para atualização online, altere-o para `true` em Power Query e configure as credenciais PostgreSQL no próprio Power BI. O modo online consulta `public.vw_conformidade_legal`, filtrando um único `escopo_hash` pelo parâmetro M `EscopoHash`. O hash precisa ser o SHA-256 hexadecimal de 64 caracteres do escopo desejado.

Os registros do snapshot usam nomes de colunas SQL, datas ISO em `competencia` e somente `cpf_hash` HMAC hexadecimal; o builder mantém apenas a lista permitida de campos SQL, valida o hash e serializa JSON em Base64 para o Power Query. `filtros_carga` é convertido para texto. As duas opções passam pela mesma conversão de tipos e alimentam a mesma tabela e medidas.

O modelo nomeia as colunas em português e mantém `sourceColumn` igual à coluna SQL da view. A tabela `Conformidade legal` guarda a hierarquia histórica da própria extração. `cpf_hash`, IDs da carga, linha de origem, escopo, filtros e metadados técnicos ficam ocultos; CPF em claro não faz parte da fonte. A dimensão `Competência` é mensal, deriva as datas distintas do fato e ordena `Mês/ano` pela chave numérica `Ordem`.

As medidas incluem as seis categorias e total de ocorrências, além de colaboradores com ocorrência por `DISTINCTCOUNT` de hashes não vazios de 64 caracteres, considerando apenas linhas com ocorrência maior que zero. A tabela fonte já exclui as linhas de total/subtotal do drill.

## Limites de análise

- A extração cobre o recorte de colaboradores apresentado no dashboard. Sem a população completa de colaboradores como denominador, não se deve publicar taxa ou percentual de conformidade.
- Os campos de hierarquia são históricos e vêm da extração. Não devem ser substituídos por uma hierarquia atual quando a análise envolver meses passados.
- Processos, processos encerrados e ticket médio ficam ocultos e sem soma automática. A origem repete esses valores em vários registros; falta uma regra de granularidade/agregação confirmada.
- A medida de colaboradores usa o hash do CPF quando válido. Registros sem hash não entram nessa contagem.
- O parâmetro fixa um escopo por arquivo de projeto. Para outra seleção de filtros da origem, gerar o modelo com o `escopoHash` correspondente.

O formato TMSL `model.bim` e os componentes esperados do PBIP seguem a documentação oficial de [modelos semânticos em projetos Power BI](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset) e da [definição de modelo semântico](https://learn.microsoft.com/en-us/rest/api/fabric/articles/item-management/definitions/semantic-model-definition). A conexão com PostgreSQL segue o [conector oficial do Power Query](https://learn.microsoft.com/en-us/power-query/connectors/postgresql). A validação feita pelo builder é estrutural/JSON; não equivale a abrir, atualizar ou validar o modelo no Power BI Desktop.
