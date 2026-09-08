# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

Cross-platform Expo/React Native app (iOS + Android; Expo also emits a static web build, currently secondary/unused as a designed surface). One shared component library and theme (`src/theme`) today — no deliberate per-OS visual fork yet — but the app must still honor each OS's native guarantees (safe-area insets, Reduce Motion, back gesture) on its own hardware.

## Users

Two operational registries with opposite visual-density needs, plus a third not yet built:

- **Administrador** (síndico/administradora): dense management use — cadastro, filtros, calendário, relatórios, edição em massa. Tolerates more on-screen elements; typically desk/office context.
- **Zeladoria** (equipe interna de manutenção/limpeza): field use, on a phone, often outdoors — needs minimal taps, high contrast, zero superfluous elements. Prioritizes execution speed over information density.
- **Morador** (not implemented yet): the planned third registry, expected to be closer to a simple-consultation profile than an operational one.

Roles are distinct logins/registries in the app (`Perfil = 'Administrador' | 'Zeladoria' | 'Morador'`), not a single account with permission toggles.

## Product Purpose

Aegis Condomínios is condominium management software: it lets a síndico/administradora run the operational side of a building (maintenance planning and execution, internal bylaws, contracts) and gives the maintenance team (Zeladoria) a guided, low-friction way to execute and report on service orders from the field. Success today is the pilot condomínio (Esquina das Silvas) running its real operations on the app well enough to justify investing in multi-tenant scale.

## Positioning

Aegis is a real product with multi-condomínio SaaS ambition (subscription, national scale), currently deliberately single-tenant. The current phase is a live pilot at one real building — Esquina das Silvas, where the founders are themselves síndicos — used to prove the product before investing in multi-tenant architecture (real auth, tenant isolation, billing). This sequencing is a strategic choice, not a technical limitation: do not design a condomínio selector, billing/plan screens, or multi-brand support yet. The finish quality bar stays as if this were already a commercial product, because this pilot is the proof-of-concept that decides the investment in scale.

The real differentiator is not feature breadth (any competitor can copy screens). It's operational depth in the Zeladoria (maintenance) module: full-screen step-by-step guided execution, pause/resume with real elapsed time deducted, síndico-side double quality check (Bom/Médio/Ruim), and an automatic recurrence engine organized by route. Sector competitors (uCondo, TownSq, Residente Online) cover financeiro/portaria/reservas but not this level of operational rigor in maintenance. Combined with direct, continuous access to a real condomínio as a live test bed — a moat that's hard to copy fast because it requires genuine operational rigor, not just replicated screens.

## Operating Context

- Zeladoria field work happens on a phone, frequently outdoors in direct sunlight and with unstable connectivity — screens must stay legible and forgiving under those conditions.
- Administrador work is denser, desk-oriented management: cadastro, filtros, calendário, relatórios.
- Two production AI assistants exist today (Normativos and Contratos modules), same architecture, both consultation-only.

## Capabilities and Constraints

- **Language**: Portuguese (Brazil) only — no i18n need. Dates as DD/MM/AAAA, currency as R$ with `.` thousands / `,` decimals, throughout.
- **AI assistants are consultation-only, never autonomous actors.** Both shipped assistants (Normativos, Contratos) always cite the exact source clause/article and never execute actions. The "pode errar, confira a fonte" disclaimer is a **fixed UI element** (static caption below the chat input), never model-generated text per response — a deliberate technical decision to avoid wording drift and repeated token cost on every reply.
- **AI architecture that future design/product work must not reopen without cause**: context stuffing (not RAG/embeddings) for the current small/medium corpus size; the LLM is always called from a serverless function, never the client, for API-key safety; the system prompt is split into a behavior block + a data block with `cache_control: ephemeral`.
- **Assistant chat history is ephemeral by default** (does not persist across a session close) — a deliberate product decision, not a technical limitation.
- **Design density is role-specific by design, not an oversight**: Administrador screens accept menus and filters; Zeladoria screens use direct buttons and a full-screen guided flow, no hidden/overflow menus.
- **Dates never use free-text input** — always the shared `MiniCalendar` component.
- Backend is Supabase (anon-key client access only in this environment; no DDL privilege — schema changes are documented in `supabase/schema_*.sql` for manual application).

## Brand Commitments

Product name: **Aegis Condomínios**. Current pilot building: Condomínio Esquina das Silvas. No further binding visual/brand assets confirmed yet (no logo, palette, or typography mandate recorded).

## Evidence on Hand

None confirmed yet (no real testimonials, press, or case studies on hand). Do not fabricate any.

## Product Principles

1. Two audiences, two densities, one design system: Administrador tolerates complexity; Zeladoria gets the opposite — minimal taps, high contrast, guided full-screen flows, no hidden menus.
2. Operational rigor in maintenance execution is the moat — protect and keep sharpening it (guided execution, pause/resume, quality double-check, route-based recurrence), not just feature parity with financeiro/portaria competitors.
3. Ship pilot work at commercial-product finish quality — this single-tenant phase is the proof that earns the multi-tenant investment, not a throwaway MVP.
4. AI is a cited, non-acting consultant everywhere it appears: always name its source, never take action, and keep its safety disclaimer a fixed UI element rather than generated prose.
5. Don't build ahead of the strategic sequencing: no condomínio selector, billing/plan UI, or multi-brand support until the single-tenant pilot has proven the product.

## Accessibility & Inclusion

No formal accessibility standard has been mandated yet. Given Zeladoria's outdoor/sunlight field use, high contrast and large, unambiguous tap targets are an existing de facto requirement for that registry (see Operating Context / Capabilities and Constraints), not yet documented as a formal a11y standard.
