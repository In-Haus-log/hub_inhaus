---
name: portal-enjoei
description: "Portal do cliente Enjoei (turnover + absenteísmo travados no CR 68732): telas, paleta da marca, regras de cálculo, travas de escopo. Use ao mexer em /dashboards/clientes/enjoei ou src/lib/clientes/enjoei."
---

# Portal do cliente Enjoei — Turnover + Absenteísmo (CR 68732)
Segundo cliente do hub, no modelo de **portal de cliente** (como Atlas), espelhado dos painéis
de RH do `hub_amyris` e recolorido para a marca **Enjoei** (roxo `#61005D`). Spec/plano:
`docs/superpowers/specs/2026-08-27-portal-enjoei-turnover-absenteismo-design.md` e
`docs/superpowers/plans/2026-08-27-portal-enjoei-turnover-absenteismo.md`.
- **Duas telas** no domínio `clientes` de `domains.ts` (`ClienteHub` `enjoei`):
  `enjoei-turnover` → `/dashboards/clientes/enjoei/turnover` e `enjoei-absenteismo` →
  `/dashboards/clientes/enjoei/absenteismo`. Contratante `enjoei` em `cliente_contratante`
  (`prisma/sql/013_cliente_enjoei.sql`); marca em `clientes-branding.ts` (`/logo_enjoei.svg`).
- **Cor**: tokens Tailwind `enjoei`/`enjoei-mist`/`enjoei-grad` + paleta única
  `src/components/clientes/enjoei/paleta.ts` (Recharts recebe hex). Estados semânticos
  (falta=vermelho, férias=âmbar, folga=cinza) mantidos.
- **Turnover** (`src/lib/clientes/enjoei/turnover.ts`, lê `vw_sra_geral`) e **Absenteísmo**
  (`src/lib/clientes/enjoei/absenteismo.ts`, lê `ft_ponto_smartcontrol`) — ambos travados no
  **CR 68732** (`CR_ENJOEI`): filtro de CR em toda query (Trava 1) + `assertLinhasNoEscopo`
  defensivo (Trava 2, `escopo-dados.ts`, escopo `{ crs: ["68732"] }`).
- **Absenteísmo é SEM meta** (sem linha de meta/badge) e **inclui todos os cargos** (sem
  exclusão de categorias). Regra D-1 (o dia de hoje não entra). Aderência/absenteísmo por dia =
  presenças/faltas ÷ escalados.
- **Páginas server-side** (`dynamic`) com guard `assertTelaVisivel(...)`; componentes em
  `src/components/clientes/enjoei/`. Portal enxuto/trava por URL do CLIENTE só testável em
  **produção** (dev = admin).
