# Instruções do projeto — hub_inhaus

Hub de indicadores da In-Haus. Centraliza os indicadores de **Segurança, RH, Qualidade,
Treinamentos e Financeiro** num único ambiente.

Spec de design aprovado: `docs/superpowers/specs/2026-07-27-hub-indicadores-inhaus-design.md`

---

## Direção de design (não negociável)

O hub adota o **mesmo layout e tratamento visual do `hub_amyris`**, recolorido para a
identidade da In-Haus. Decisão do cliente (2026-07-27), depois de ver a primeira versão.

Princípios que não podem ser violados:

1. **Recolorir, não redesenhar.** A estrutura é a do Amyris: hero WebGL, shell com
   sidebar fixa (`w-72`) sobre `bg-inhaus-radial` + topbar com blur, cards de vidro
   (`.glass`), `TiltCard`, gradiente de marca, cantos `rounded-3xl`.
2. **Paleta In-Haus.** `#002443` navy (estrutura, substitui o roxo do Amyris),
   `#027193` teal (acento/ação, da logo), `#F2F3F8` mist (superfície). Gradiente de
   marca `bg-inhaus-grad` (navy→teal). Nada de roxo/lilás em lugar nenhum.
3. **Tipografia igual à do Amyris:** Space Grotesk (display) + Inter (texto).
4. **Marca In-Haus.** A logo In-Haus é a marca principal (`InhausLogo`); use `onDark`
   sobre fundos navy. Não existe mais logo de cliente separada.
5. **Motion do Amyris:** `.reveal` (fade-up escalonado com `.delay-1..5`), `TiltCard`,
   hover com elevação. `prefers-reduced-motion` sempre respeitado (já tratado no
   `globals.css`).
6. **Acessibilidade não é opcional.** Contraste AA, navegação por teclado com foco
   visível, HTML semântico de verdade.

Cores, raios e sombras vêm **sempre** dos tokens do Tailwind (`bg-navy`, `text-teal`,
`bg-inhaus-grad`, `.glass`, `.eyebrow`, `shadow-glow`, etc.), definidos em
`tailwind.config.ts` e `src/app/globals.css`. Valor hexadecimal solto em componente é
erro de revisão — a única exceção é dentro do shader do `HeroCanvas`.

Referência viva: quando em dúvida sobre um componente, olhe o equivalente em
`C:\Users\fernando.c.souza\Projetos\hub_amyris` e replique a estrutura, trocando as
cores/tokens roxos pelos de navy/teal.

---

## Stack

Server Components por padrão. `"use client"` restrito a: hero canvas, shell (drawer
mobile / sessão), `TiltCard`, gráficos e formulário de login.

---

## Fonte de verdade dos domínios

`src/lib/domains.ts` registra os cinco domínios e suas telas numa única estrutura, que
alimenta **ao mesmo tempo** a sidebar, a command palette, a Home e o controle de
permissões. Adicionar ou alterar um indicador significa editar esse arquivo — nunca
duplicar a lista em outro lugar.

---

## Botão "info" dos dashboards — regras de negócio (OBRIGATÓRIO)

**TODO dashboard tem, ao lado do título, um botão "info"** (componente padrão
`src/components/dashboard/InfoIndicador.tsx`) que abre um popover explicando ao usuário,
**em regras de negócio**, o que o painel mostra e **como cada número é calculado**. Não é
opcional: nenhum indicador entra sem esse botão preenchido.

**Regra de manutenção:** SEMPRE que houver qualquer alteração em um indicador — nova
métrica, mudança na lógica de cálculo, filtros, fórmula, período considerado, exclusões
ou o filtro padrão — o texto do **info** daquele dashboard DEVE ser atualizado na MESMA
tarefa. O info nunca pode ficar defasado em relação ao cálculo real.

**Como escrever o info:**
- **Só regras de negócio.** Explique a lógica de cálculo em termos de operação e gestão:
  o que entra na conta, o que é contado uma vez, o que é excluído, qual recorte/período.
- **Bem visual e bem explicado:** frases curtas, bullets, destaque (negrito) no que
  importa, e **um exemplo numérico** sempre que ajudar a entender a conta.
- **Zero termo técnico ou referência de backend.** NUNCA citar tabela, view, coluna, nome
  de campo, SQL, RPA, banco de dados, API ou nome de arquivo. O público é a operação e a
  gestão. Fale de pessoas, quadro, faltas, treinamentos, ocorrências, metas — não de como
  o dado é armazenado ou processado.
- **Mantenha o texto em sincronia com a regra no código** (ex.: o comentário de regra de
  negócio no topo do módulo de dados do indicador).

---

## O que já foi construído (estado atual)

### Rotas e navegação
- `/` → redireciona para `/dashboards`.
- `/login` → tela de login (split cinematográfico). `/home` → landing/hero pública (fora do fluxo).
- `/dashboards` → shell protegido (sidebar fixa + topbar). Visão geral com 5 cards de KPI,
  um por domínio.
- `/dashboards/<dominio>` e `/dashboards/<dominio>/<indicador>` → telas dos 5 domínios.
  Todas existem; as que ainda não têm dados usam o painel `EmConstrucao`.
- `/dashboards/usuarios` → placeholder do admin (conceder acesso/permissões — a construir).
- As rotas dos domínios saem de `src/lib/domains.ts` (fonte de verdade). Cada tela tem
  `icone` (exibido na sidebar antes do nome) e `palavrasChave` (busca da command palette).

### Login
- `src/app/login/page.tsx` — split 50/50. Painel esquerdo com `FluxoCanvas`
  (`src/components/login/FluxoCanvas.tsx`): rede de hubs/rotas com pacotes fluindo, unindo
  logística e tecnologia (canvas 2D, determinístico). `LoginIntro`
  (`src/components/login/LoginIntro.tsx`): abertura cinematográfica da logo, 1× por sessão,
  que migra para a logo do login. Formulário com 2FA, redireciona para `/dashboards`.
- Em modo dev, aparece um botão "Acessar o hub" (ver acesso livre abaixo).

### Shell
- `src/components/dashboard/DashboardShell.tsx` (sidebar branca de vidro + topbar) e
  `DashboardSidebar.tsx` (montada a partir de `DOMINIOS`, um grupo por domínio, ícone por
  tela; item ativo com `bg-inhaus-grad`). Sessão resolvida no layout server
  (`src/app/dashboards/layout.tsx`) e passada por props.

### Autenticação e acesso
- Camada portada do `hub_amyris`: `src/lib/{global-auth,auth-session,db-inhaus,prisma}.ts`,
  `middleware.ts`, `prisma/schema.prisma` (modelo `AuthUser`). Cookies com prefixo `inhaus`.
- **Caminho da requisição para os Server Components:** o middleware publica o path num
  header cujo nome é a constante única `HEADER_PATHNAME` (`src/lib/http-headers.ts`),
  consumida pelo `layout.tsx` (trava do CLIENTE) e por `dashboard-acesso.ts` (destino do
  refresh). **Sempre use a constante nos dois lados** — nunca a string literal. Produtor e
  consumidor com nomes diferentes = valor sempre nulo → o refresh de sessão jogava o
  usuário na Visão Geral em vez da página pedida (bug real, corrigido; teste em
  `dashboard-acesso.test.ts`). Ao renovar a sessão, o destino é montado por `destinoRefresh`,
  que **preserva a rota pedida** (e barra open-redirect).
- **Acesso livre de desenvolvimento** (`src/lib/dev-auth.ts`): com `HUB_ACESSO_LIVRE=1` no
  `.env.local` **e** fora de produção, entra sem `global_auth` como "Visitante" (admin).
  Trava dupla; nunca vale em produção. É como revisar o hub sem credenciais.

### Isolamento de dados por CR / Cliente (multi-tenant)
Recorte de QUAIS dados cada usuário vê, por CR/cliente. Tudo é autorização **local** —
**nada é escrito no `global_auth`** (ligado pelo UUID `authUserId`).
- **Classificação** `INTERNO | CLIENTE` em `auth_users` (`classificacao`). É **ortogonal às
  permissões**: não restringe telas/papéis que o admin concede; serve para rotular externos
  e reforçar o isolamento. `CLIENTE` **nunca** recebe escopo `todos` (nem se marcado admin).
- **Escopo** = vínculos `auth_user_cliente` (grupo `dm_cr.nome_grp_cliente`, herda todos os
  CRs do grupo, inclusive futuros) e/ou `auth_user_cr` (CR avulso, código 5-char = `dm_cr.cr`).
  Sem vínculo e sem admin interno ⇒ **não vê dado** (fail-closed).
- **Gateway obrigatório** `src/lib/seguranca/escopo-dados.ts`: `resolverEscopoDados()` monta o
  `EscopoDados` (`todos` | lista de CRs); **Trava 1** `predicadoSraCr()` injeta o filtro de CR
  em TODA query de dado; **Trava 2** `assertLinhasNoEscopo()` confere a saída e **lança** se
  vazar CR fora do escopo. Todo indicador novo por CR DEVE passar pelas duas.
- **Chave de isolamento** = **código de 5 chars** do CR (`codigoCr`, casa com `dm_cr.cr`).
  Tabelas de dados de EPI têm coluna `cr_cod` (gravada nas escritas; backfill pronto).
- **RLS está DORMENTE** em `prisma/sql/008_isolamento_cr.sql`: a conexão do hub é `postgres`
  (superusuário **ignora RLS**), então a trava efetiva é a aplicação. As policies estão prontas
  para ativar se um dia o hub usar um role não-superusuário (decisão do cliente: não trocar as
  connection strings).
- Concessão na tela **Usuários** (classificação + clientes/CRs); endpoint
  `GET /api/admin/clientes-crs` alimenta os seletores.

### Módulos — detalhes em skills do projeto (`.claude/skills/`)
Cada módulo tem uma skill com a arquitetura e as regras completas; ela carrega quando você
trabalha no módulo. **Leia a skill antes de mexer no módulo.**
- **Controle de Quadro** (`/dashboards/rh/controle-quadro`) → `indicador-controle-quadro`.
- **EPI** (`src/lib/epi`, `/p/[token]`) → `modulo-epi`.
- **Clientes / Desvios (Atlas) + portal do cliente** → `modulo-desvios`.
- **Treinamentos + Controle de Capacitação** (`/t/[token]`) → `modulo-treinamentos`.
- **Portal Enjoei** (CR 68732) → `portal-enjoei`.

Invariantes que valem sempre (não dependem da skill estar carregada):
- **CPF nunca em claro nem na URL** — identidade é **HMAC do CPF** (`EPI_CPF_SECRET`). Única
  exceção: nos treinamentos, `cpf_texto` só de quem NÃO foi localizado na SRA.
- Todo dado por CR/cliente passa pelas **duas travas** de isolamento (seção acima).

### Limitações de dados (importante)
- `dt_demissao` está **vazia em todas as tabelas** do `db_inhaus` hoje → o card de
  desligamentos mostra 0 até essas datas serem preenchidas. A regra (por data de demissão)
  já está pronta.
- A `vw_sra_geral` tem poucas fotografias (`data_referencia`) — a linha do tempo e o quadro
  médio crescem conforme novas coletas entram. Nomes (gerente, CR) vêm em CAIXA ALTA; a
  exibição capitaliza com `tituloNome` mantendo o valor bruto para filtrar.

### Banco de dados — REGRA CRÍTICA (NUNCA `prisma db push`)
O `DATABASE_URL` (Prisma) e o `DATABASE_URL_INHAUS` (SRA) apontam para o **mesmo Postgres
compartilhado** (`db_inhaus`). Esse banco guarda, no schema `public`, tanto as tabelas do hub
(`auth_users`, `epi_*`) quanto as tabelas da **RPA/SRA** (`ft_colaboradores_sra`,
`ft_colaboradores_sra_diario`, `ft_ponto_smartcontrol`, `cfg_cargos_excluidos`).
- **NUNCA rodar `prisma db push` nem `prisma migrate` neste banco.** O Prisma assume ser dono
  do schema inteiro e tenta **DROPAR** as tabelas da SRA (não estão no `schema.prisma`) —
  perda de dados real (dezenas de milhares de linhas). `db:push`/`db:migrate` estão banidos.
- O schema das tabelas do hub é aplicado por **SQL manual idempotente** (`prisma/sql/*.sql`,
  `CREATE TABLE IF NOT EXISTS` + FKs em `DO $$ ... duplicate_object`). Ex.: `prisma/sql/001_epi.sql`.
- Fluxo ao mudar um model: editar `schema.prisma` → escrever o SQL aditivo correspondente em
  `prisma/sql/` → aplicar no banco → `prisma generate` (só gera o Client, não toca no banco).
- O Prisma Client lê/escreve normalmente em tabelas criadas à mão, desde que batam com os models.

**Convenção de nomes de tabela (a partir de 2026-08-26):** toda tabela NOVA do hub deve usar
prefixo **`dm_`** (dimensão — cadastros, listas, entidades relativamente estáveis) ou **`ft_`**
(fato — eventos/transações, linhas que crescem com o tempo), alinhado ao padrão já usado pela
RPA/SRA no mesmo banco (`dm_cr`, `ft_colaboradores_sra`, `ft_ponto_smartcontrol`). As tabelas
já existentes (`auth_users`, `epi_*`, `desvio`, `treinamento*`) **ficam como estão** — não
renomear; a regra vale só daqui para frente.

### Notas de desenvolvimento
- Rodar: dev server via `.claude/launch.json` (nome `hub-inhaus-dev`, porta 3000). Nunca
  subir servidor por outros meios.
- Se o CSS/HMR "travar" (ex.: erro fantasma `border-border`, estilos stale), **pare o dev
  server, apague `.next` e suba de novo** — o build de produção (`npm run build`) é a fonte
  de verdade; ele valida com SWC igual ao dev.
- Verificação de cada entrega: `npx tsc --noEmit`, `npm run build` e, quando há dado,
  conferência dos números direto no banco antes de considerar pronto.
- `.env.local` (fora do git) guarda `HUB_ACESSO_LIVRE=1`, `DATABASE_URL_INHAUS`, `DATABASE_URL`
  e `EPI_CPF_SECRET` (segredo do HMAC do CPF no módulo de EPI).

### Documentos
- Plano de implementação: `docs/superpowers/plans/2026-07-27-fundacao-visual-hub-inhaus.md`.

---

## Idioma

Toda a interface, os comentários de código e a documentação em **português do Brasil**.
