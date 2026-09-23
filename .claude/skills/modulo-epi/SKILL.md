---
name: modulo-epi
description: "Arquitetura e regras do módulo de EPI (src/lib/epi, /dashboards/epi, /api/epi, rota pública /p/[token]): SessaoTurno, checklist versionado, líderes por CR, assistente de configuração, QR, validação/presença. Use ao trabalhar em qualquer parte do EPI."
---

# Módulo de EPI — Controle de utilização de EPI (Fases 0–2 prontas)
Primeiro módulo **transacional** do hub (escreve dados de negócio). Camada em `src/lib/epi/`
(regras no topo de `index.ts`); models `epi_*` no `schema.prisma`, criados por `prisma/sql/001_epi.sql`.
- **Agregado central = SessaoTurno** (cliente + CR + turno + data): N respostas + 1 validação.
  1 sessão por turno/dia (`@@unique`), 1 resposta por pessoa/sessão, 1 validação por sessão.
- **Identidade = HMAC do CPF** (`cpf.ts`, `EPI_CPF_SECRET`). NUNCA CPF em claro nem na URL.
  Matrícula é só informativa (colide entre CRs). A `matricula` da SRA **não identifica pessoa**.
- **Quadro de liderados é DERIVADO AO VIVO** do quadro ativo do CR (`colaboradores.ts`, lê
  `ft_colaboradores_sra` com `dt_demissao IS NULL` — não a `vw_sra_geral`). Admissão aparece,
  desligamento some. `atribuicao.ts` só guarda **em qual turno** a pessoa está; ativo sem turno
  vigente = "não alocado" (sinalizado). Vínculos usam vigência (`fimEm`), nunca delete.
- **Checklist é BIBLIOTECA GLOBAL versionada** (`config.ts`): `ChecklistTemplate` não pertence a
  cliente/CR — é criado uma vez (seção **Checklists**, `/dashboards/epi/checklists`) e **vinculado**
  a qualquer CR (`ClienteCr.checklistTemplateId`), reaproveitável entre clientes. Na tela dá para
  **criar, renomear (PATCH), editar itens** (pré-carrega a versão atual e publica uma nova) e
  **excluir** (soft-delete `ativo=false`; **bloqueado com 409 se vinculado** a algum setor). Editar
  publicado cria versão nova; a antiga fica no histórico. `versaoPublicadaDoCr(cr)` resolve pelo
  vínculo do CR. `POST /api/epi/crs/checklist` vincula; `PATCH/DELETE /api/epi/templates/[id]`.
- **Papéis** (`papeis.ts`/`escopo.ts`): ADMIN (isAdmin global) configura tudo; PARAMETRIZADOR
  aloca. **Líder é por SETOR (CR): `LiderCr`** (cliente+cr+usuário, vigência) — 1 líder responde por
  vários CRs e um CR pode ter vários líderes; ser líder de um CR habilita validar **todos os turnos**
  dele. `getTurnoIdsDoLider` deriva de `LiderCr` (+ `ResponsavelTurno` legado). `podeVerValidacoes(escopo)`
  = admin ou tem turno como líder. Gestão em **`/dashboards/epi/lideres`** (escolhe usuário + multi-CR).
  `escopoDoUsuario()` centraliza QUEM vê os dados de QUEM. Guardas em `guardas.ts` **honram o acesso
  livre** de dev (senão os route handlers dariam 401 em dev).
- **UI para usuário comum (não-dev):** a configuração é um **ASSISTENTE guiado**
  (`/dashboards/epi/configurar`, `AssistenteConfiguracao.tsx`): cliente → setor (CR) → turno +
  líder → checklist → pessoas, um passo por vez, com instrução em cada etapa. **Em lote:** o passo
  de turnos cria VÁRIOS de uma vez; o de checklist VINCULA um da biblioteca (ou cria novo); o de
  pessoas aloca cobrindo os vários turnos (chips de turno por pessoa + "todos para"). O líder é
  **escolhido de uma lista de usuários do hub** (`listarUsuariosHub`), nunca UUID digitado. A
  sidebar do EPI tem **Configurar**, **Checklists**, **Líderes** e **Validações**. As telas granulares antigas
  (clientes/turnos/checklists/alocacoes/membros) continuam existindo, mas fora da navegação.
- **QR Code** (`QrLinkPublico.tsx`, lib `qrcode.react`): ao concluir um setor no assistente (e no
  card de turno) mostra o **QR do link público** `/p/<token>` com copiar / abrir / **imprimir**
  (janela de impressão dedicada). **Dropdowns** (`Combobox`/`MultiCombobox`) renderizam o menu num
  **portal** (`position: fixed`, z-index alto) — não são mais cortados por `overflow` nem ficam
  atrás de cards `.glass` (que criam stacking context via blur).
- Escrita por route handlers `/api/epi/*` (validação **zod** em `schemas.ts`, guardas + padrão de
  erro `{ error }`); `GET /api/epi/colaboradores?cr=` serve o quadro ativo ao assistente.
  Componentes client em `src/components/epi/`.
- **Execução (Fase 2, pronta):** cada turno tem um **token público estável** (`token_publico`),
  usado no QR/link. `sessao.ts` resolve/cria a sessão do dia de forma **idempotente** na 1ª leitura
  (data de negócio America/Sao_Paulo em `datas.ts`; congela a versão publicada do checklist).
  - **Rota pública** `/p/[token]` (fora de `/dashboards`, liberada no `middleware.ts`): liderado
    escolhe o nome do turno + digita CPF (conferido por HMAC) e marca cada item conforme/não conforme.
    POST em `/p/[token]/responder`. A resposta congela snapshot (nome/cargo/CR).
  - **Validação do líder**: `/dashboards/epi/validacoes` (lista do dia no escopo) + `/[id]` (revisão
    visual). A tela lista **TODOS os liderados alocados** (quadro ativo ∩ atribuição) unidos a quem
    preencheu, com status (Conforme / Não conforme / Não preencheu) e um toggle **Presente/Ausente**.
    O líder marca a **presença** de cada um — resolve escalas de revezamento (ex.: **12x36**): só se
    cobra preenchimento de quem estava presente. `validarSessao` grava `PresencaSessao` (por pessoa) +
    `ValidacaoSessao` com `hashConteudo` (base da assinatura futura) e fecha a sessão. Exige ao menos
    **um presente que preencheu**. **Assinatura NÃO capturada por ora.**
  - **Turno tem `diasSemana`** (dias em que espera preenchimento). O assistente tem atalhos "Seg a Sex",
    "Seg a Sáb" e "Todos os dias" — 12x36 usa **Todos os dias** (a presença é resolvida na validação).
- **Falta (Fase 3+):** **indicador** de aderência (validadas ÷ esperadas) e não conformidade por
  tipo de EPI (entra em `domains.ts` no domínio Segurança, com botão info); captura de **assinatura**.
