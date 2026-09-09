---
name: Aegis Condomínios
description: Condominium operations software for síndicos and maintenance crews — operational rigor over feature breadth, quiet paper-and-ink calm over SaaS shine.
colors:
  warm-paper: "#FAF9F6"
  card-white: "#FFFFFF"
  sunken-linen: "#F1EFE9"
  hairline-border: "#E3E0D8"
  border-strong: "#CFCBC1"
  ink-primary: "#22221F"
  ink-secondary: "#6B6862"
  ink-muted: "#9A968D"
  ink-action: "#1A1A17"
  ink-action-pressed: "#000000"
  status-ok: "#2F7D53"
  status-pending: "#A9740B"
  status-overdue: "#B23A2E"
typography:
  display:
    fontFamily: "SourceSerif4_400Regular"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.15
  headline:
    fontFamily: "SourceSerif4_600SemiBold"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Inter_500Medium"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "Inter_400Regular"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Inter_500Medium"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  sm: "0px"
  md: "4px"
  lg: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink-action}"
    textColor: "{colors.warm-paper}"
    typography: "{typography.headline}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-primary-pressed:
    backgroundColor: "{colors.ink-action-pressed}"
  button-destructive-outline:
    backgroundColor: "transparent"
    textColor: "{colors.status-overdue}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  chip-selected:
    backgroundColor: "{colors.ink-action}"
    textColor: "{colors.warm-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  chip-unselected:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  input-field:
    backgroundColor: "{colors.sunken-linen}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  row-record:
    backgroundColor: "transparent"
    borderTop: "1px solid {colors.hairline-border}"
---

# Design System: Aegis Condomínios

## Overview

**Creative North Star: "The Quiet Ledger"**

This system was redirected. The direction it replaces was defined almost entirely by prohibitions — no gradients, no shadows, no terracotta, no SaaS clichés — and a visual language built only from what it refuses converges, quietly, on exactly the safe default it's trying to avoid. A blue-accented, white-card, hairline-bordered interface is the same shape as a hundred other products no matter which blue it picks. This redirect makes the metaphor load-bearing instead of decorative: The Quiet Ledger stops being a mood and starts being a structure.

**Ruled Paper.** A ledger isn't a stack of cards floating on a tinted background — it's a sheet of paper with rules on it, and every entry is a line on that sheet. Aegis now builds its lists the same way: a contract, a plano de manutenção, a normativo is a row, delimited by a single ruled line above and below it, not a bordered, radius-cornered box sitting on a wash. The paper itself — Warm Paper, flat, unadorned — is the only background any screen has; nothing sits "on top of" it in a floating card anymore.

The accent is no longer a color. It's ink. Ink Action (`#1A1A17`, near-black) marks a primary action or a selected state as a filled block of ink, or its inverse — paper on ink. There is no brand blue left to reach for. Cobalt is retired (see Colors). What remains saturated is exactly, and only, the three status colors: a plan or a contract is ok, pending, or overdue, and that is the entire remaining vocabulary of color in the system.

**Key Characteristics:**
- No brand color. The one accent is ink — black on paper, or paper on black — never a hue.
- Records are ruled rows on a sheet, not cards floating on a background wash.
- Status color (ok / pending / overdue) is the only saturated color anywhere, and it always means something operational.
- Flat by default; shadow is reserved for temporary floating overlays only.
- Two densities, one language: Administrador is structured, Zeladoria is stripped down — both are "the real app," not a simplified companion.

## Colors

Paper and cobalt ink, with a small disciplined set of earthy status colors — nothing else in the system is allowed to be loud.

### Primary
- **Ink Action** (`#1A1A17`): the system's only accent, and it isn't a color — it's ink. Primary buttons, selected chips, active tab indicator, links: a filled block of Ink Action (action/selection), or its inverse (paper on ink). Used exactly where it signals "this is the action" or "this is selected," never as a wash.
- **Ink Action, Pressed** (`#000000`): true black — the pressed/active state of Ink Action, one step darker with no remaining warmth.

**Cobalt Ink (`#1F4FE0`) is retired.** It was this system's accent under the prior direction and is deliberately removed here — a redirect, not a bug fix. Saturated blue is the sector's safe default; it signals "software," not this product. The same logic that retired the warm-cream-plus-terracotta pairing (a recognizable AI-generated-design tell) retires cobalt now: a color everyone reaches for by default carries no identity, however competently it's used. The `brand`/`brandPressed`/`brandWash` tokens still exist in `src/theme/index.ts` and will be removed in a later cleanup pass — no new screen should consume them starting now.

### Neutral
- **Warm Paper** (`#FAF9F6`): the base screen background — flat and unadorned. The lavender-tinted gradient wash every screen used to carry has been **removed**: it quietly contradicted this same document's own prohibition on decorative SaaS gradients, and a redirect built around a ruled sheet of paper doesn't get to keep an atmospheric wash on that paper. See Elevation & Depth → Screen Background Gradient — Retired.
- **Card White** (`#FFFFFF`): the surface color for cards, inputs-at-rest containers, and modals — one step lighter than Warm Paper so surfaces read as distinct without a shadow.
- **Sunken Linen** (`#F1EFE9`): the recessed surface for input fields and secondary tiles — visually "pressed into" Warm Paper.
- **Hairline Border** (`#E3E0D8`): the default 1px border on nearly every surface — cards, inputs, dividers. This is how the system separates surfaces, not shadow.
- **Border, Strong** (`#CFCBC1`): a firmer border for the rare case needing more separation than the hairline.
- **Ink, Primary** (`#22221F`): primary text — a warm near-black, never pure `#000`.
- **Ink, Secondary** (`#6B6862`): secondary/supporting text — labels, meta text, timestamps.
- **Ink, Muted** (`#9A968D`): the quietest text tier — placeholder-adjacent, disabled-adjacent, "vigência indeterminada"-style informational tags.

### Status (the only saturated colors in the system)
- **Status OK** (`#2F7D53`, muted forest green): on schedule, completed, comfortably within any deadline.
- **Status Pending** (`#A9740B`, ochre): approaching a deadline or awaiting attention — never used for anything but a real time-sensitive state.
- **Status Overdue** (`#B23A2E`, muted brick red): past due, failed, or blocking. Reserved for genuine urgency.

A `dark` neutral palette (`bg #121211`, `surface #1A1A19`, `elevated #232322`, `border #2E2E2C`, plus matching text tiers `textPrimary #EDEBE7`/`textSecondary #A3A099`) exists in `src/theme/index.ts` and **is** in active use — exclusively in `app/login.tsx`. No post-login screen imports `dark`; every other screen imports `light` directly.

**The Login-Only Dark Rule.** Dark mode belongs to the login screen and nowhere else. No post-login screen may import or reference `dark`. `light` and `dark` never coexist on the same screen.

### Named Rules
**The Ink-Only Action Rule.** The primary action is black ink on paper, or paper on black ink. Aegis has no brand color. When Ink Action marks the action and the surrounding text is also effectively black, the distinction is never color — it's *shape*: a filled block (primary action), a 1.5px underline (secondary action), or nothing at all (plain text). If two things need telling apart and both are ink, change the shape, never reach for a tint.

**The Color-Means-Urgency Rule.** Every drop of color in the app carries operational meaning. If an element has color, a user must be able to say — just by looking at it — whether it's overdue, close to due, or fine. This is the system's central affirmative rule: color is never spent on anything that isn't telling the user how urgent something is.

**The Closed Status Set Rule** (formerly the Status-Only Saturation Rule — renamed to complement the Color-Means-Urgency Rule above). OK/Pending/Overdue are the only saturated colors permitted anywhere in the system: the complete, closed vocabulary the Color-Means-Urgency Rule draws from. A designer reaching for a "nice accent color" for anything else is reaching for the wrong tool — use Ink Action (function) or a neutral (structure) instead. **Exception:** continuous RGB interpolation *between* status colors is authorized for a value that is itself continuous (e.g. days remaining until due) — see Components → Vencimento Gradient Bar. This is not a loophole for new hues; the interpolated color must always land between two status colors already in the palette.

**The No-Terracotta Rule.** Never pair Warm Paper with an orange/terracotta accent near `#D97757`. That combination is a known, deliberately rejected AI-generated-design signal for this product — it was tried and replaced.

## Typography

**Body & Display Font:** Inter (with system-sans fallback) — a single family across every weight in use (400/500/600), no secondary or mono face.

**Character:** Inter at these weights reads as neutral, legible, and unshowy — exactly the "ledger" register: it disappears into the content instead of performing personality.

### Hierarchy
- **Display** (Source Serif 4 Regular 400, 24px): the rare big number — a stat total on a report tile, a large percentage. Used only for a single hero figure per section, never for body content.
- **Headline** (Source Serif 4 SemiBold 600, 17px, centered): screen titles and full-screen modal titles. Admin's own home title runs slightly larger (20px) as the one exception at the root of the navigation stack; every pushed screen and modal uses 17px.
- **Title** (Inter Medium 500, 15px): card titles, primary list-item text, standalone destructive-button labels.
- **Body** (Inter Regular 400, 14–15px): chat bubble text, form input text, descriptive card text (contraparte, resumo, chip labels' regular sibling). 15px inside form inputs, 14px inside chat bubbles and denser card metadata.
- **Label** (Inter Medium 500, 11–13px): field labels, secondary meta text ("Atualizado em…", "Vence em…"), badge/selo text, chip text, bottom-tab labels. No uppercase transform anywhere in the system — case stays as written.

### Named Rules
**The Two-Family Rule.** Source Serif 4 in Display and Headline; Inter in Title, Body, and Label — exactly two families, each with a fixed job. Serif carries the big, rare moments (a hero number, a screen title); Inter carries everything read at length or in quantity. No third family, ever. Two hard limits keep the serif rare instead of precious: it never sets below 17px, and it never appears on a Zeladoria execution screen at all — field work happens on a phone, often in direct sun, and those screens run Inter end to end, no exception.

**The Tabular Figures Rule.** Every numeral that appears in a comparable position — a monetary value, a date, a counter, days remaining — sets `fontVariant: ['tabular-nums']`, and right-aligns when it sits in a column with other numbers. Numbers in a ledger line up; a column of figures that doesn't align at the same digit isn't a ledger, it's just text that happens to be numeric.

## Layout

Every screen is a single-column, full-bleed stack: a fixed header (back affordance + centered title + a right-side action), a scrollable body, and — for edit/creation flows — a full-screen `Modal` that slides up rather than a sheet or popover. There is no persistent sidebar; the only persistent chrome is the frosted bottom tab bar on screens that have more than one section (e.g. Contratos' Listagem/Relatórios).

Spacing runs on an 8px base scale (`xs 4 · sm 8 · md 16 · lg 24 · xl 32`). Screen padding is consistently `spacing.lg` (24px) horizontal; card internal padding is `spacing.md` (16px); the gap between stacked form fields is `spacing.lg` (24px), between list cards `spacing.sm`–`spacing.md`. Scrollable content that sits above the bottom tab bar reserves 90px of bottom padding so the last item never hides behind it.

Density is the deliberate lever between the two audiences: Administrador screens compose multiple `field` blocks, chip rows, and calendar pickers in sequence inside one scroll; Zeladoria/execution screens reduce to one primary action and minimal supporting text per screen, often full-screen and modal, to keep a field worker's next tap unambiguous.

## Elevation & Depth

Flat by default, confirmed as an invariant, not an omission. Every resting surface — card, input, button, modal body — carries a 1px `Hairline Border` and zero shadow; separation comes from that hairline and from the `Card White`-on-`Warm Paper` (or `Sunken Linen`-recessed) tonal step, never from a drop shadow. Pure black shadows and `elevation:` bumps do not appear on anything sitting flush against the screen.

Shadow is reserved for genuinely temporary, floating content: a context menu or a date-picker overlay that appears above the current screen and must read as "not part of the page flow." Those get a real soft shadow (`shadowOpacity 0.15, shadowRadius 8, offset {0,4}`, `elevation 8` on Android) plus a hairline border, and disappear on dismiss.

Blur/glass is not a decorative material here — it is used exactly once, on the persistent bottom tab bar, and only because real scrollable content passes behind it; anywhere blur appeared over a flat, non-scrolling background it has been removed as an effect without a function.

### Screen Background Gradient — Retired
Every screen used to sit on `Warm Paper` reinforced by a full-bleed lavender-tinted `LinearGradient` wash (`rgba(216, 220, 240, 0.12→0.35→0.7)`, top-to-bottom, weak at the top, intensifying toward the bottom). **This wash is retired as of the Ruled Paper redirect.** It was the one atmospheric effect anywhere in the system, and it stood in direct, unresolved tension with this document's own prohibition against decorative SaaS gradients. The background is now flat `Warm Paper`, full stop — no gradient, no wash.

The gradient still exists in code today — `src/components/ScreenBackground.tsx`, and duplicated inline in `app/home.tsx` — pending a code change that is outside the scope of this document edit. Both are now **stale relative to this design system**; treat their continued presence in the repo as a pending cleanup, not as design authority.

### Shadow Vocabulary
- **Floating overlay** (`shadowColor: #000, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: {0,4}, elevation: 8`): context menus (`CardMenu`), inline date-picker overlays. Never applied to a resting card, button, or input.

### Named Rules
**The Flat-at-Rest Rule.** If a surface isn't floating above other content right now, it has a hairline border and no shadow. Shadow means "temporary and above the page," full stop.

**The Function-Only Blur Rule.** Blur is a material for real content passing behind an element, not an aesthetic finish. No blur over a static, non-scrolling background.

**The Ruled-Row Rule.** A record in a list is a ruled row, not a box. Background fill and corner radius are reserved for surfaces that are genuinely floating above the page — `CardMenu`, the inline calendar overlay — never for an item sitting in a plain list. If it isn't floating, it doesn't get a card treatment; it gets a rule.

## Shapes

Three radius steps, and none of them soft: `sm` (square corners — the default for a ruled row and most surfaces), `md` (a small allowance for a tap target that needs a whisper of softening: buttons, inputs, chip rectangles), `lg` (a full pill, reserved strictly for genuinely circular controls: the bottom-tab active-indicator dot, the header "+" add button). Nothing in the system rounds "a little" by default anymore. Borders are always 1px and hairline-colored at rest; a colored 1px border (status color) marks an outline/destructive button or a status badge, never a decorative accent.

**The retired scale — three step values in the eight, twelve, and sixteen-pixel range — was never a deliberate choice on Aegis's part; it was Tailwind's and shadcn's default radius scale, carried over unexamined.** Squaring the corners off is part of the same redirect that retired Cobalt Ink: a rounded-corner system that close to the ecosystem default is one more way the prior direction accidentally matched the market instead of departing from it. Exact values live in the frontmatter (`rounded.sm`/`md`/`lg`), not repeated here, so this section can't drift out of sync with them again.

## Motion

Real tokens from `src/theme/index.ts` (`motion`), lines 37–44:
- **Duration:** `fast: 150ms` · `base: 250ms` · `slow: 400ms`.
- **Easing:** `Easing.out(Easing.cubic)` — a single system-wide easing curve, no per-component custom curves.

Every animation must respect `AccessibilityInfo.isReduceMotionEnabled()` — check it before triggering non-essential motion, and skip or shorten the animation when it's on. Motion has a purpose (state change, feedback, orientation) or it doesn't ship.

**Fixed prohibition: never install Reanimated or NativeWind.** This is a settled decision, not an open question. Build every animation with React Native's built-in `Animated` API, `Easing.bezier()` for custom curves when the standard easing above doesn't fit, `Animated.stagger()` for sequenced motion, and `Pressable`'s `({ pressed })` render-prop for press feedback. Translate any design-skill example written for CSS/web or Framer Motion into this native API rather than reaching for either banned dependency.

## Components

### Buttons
- **Shape:** `rounded.md` (12px) for the standard full-width footer button; `rounded.sm`–`rounded.md` for inline/destructive buttons.
- **Primary:** solid Ink Action background, white `Headline`/`Title`-weight label, full-width in modal footers, `12px` vertical padding. Pressed state darkens to Ink Action Pressed (true black); disabled drops to 40% opacity — no other disabled treatment.
- **Destructive / Outline:** transparent background, 1px Status Overdue border, Status Overdue text — used for "Excluir," never filled solid red.
- **Icon-only (add/back/close):** no background at rest; the header "+" action is the one circular filled exception (Ink Action circle, white icon).

### Chips
- **Style:** pill shape (`rounded.lg`), used for every user-facing single/multi-select in forms (tipo, periodicidade, prioridade) — never a native picker or dropdown.
- **Selected:** solid fill in the assigned accent (Ink Action by default, or a semantic color when the chip represents a status/priority value), white text.
- **Unselected, neutral:** `Card White` background, `Hairline Border`, `Ink Primary` text.
- **Unselected, color-coded:** 10%-opacity tint of the assigned color as background, full-opacity color as border and text (see Named Rule below).

### Ruled Rows (signature pattern)
A record — a contract, a plano de manutenção, a normativo — is a row on `Warm Paper`, not a card. It carries no background color of its own and no corner radius; it's separated from its neighbors by a 1px horizontal rule in `Hairline Border`, top and bottom. The first row of a group carries a heavier 2px rule in `Ink Action` above it, standing in for a section head — no separate header component, no card wrapper. Internal layout: the record's title sets in Source Serif (`Title`/`Headline`, by weight), supporting metadata sets in Inter `Label`, and a numeric value — when the row has one — right-aligns on the title's own baseline with `fontVariant: ['tabular-nums']` (see Typography → The Tabular Figures Rule). Press state: the entire row's background fills `Sunken Linen`, bleeding edge-to-edge to the screen's own margins, not just the row's own padded box — so the whole line reads as activated, never as a card lifting off the page.

### Inputs / Fields
- **Style:** `Sunken Linen` background (recessed, not raised), 1px `Hairline Border`, `rounded.md`, `Body` text.
- **Date fields never accept free text.** Every date value is entered through `MiniCalendar` (`src/components/MiniCalendar.tsx`), triggered from a field that echoes the already-formatted `DD/MM/AAAA` value — this is an enforced product rule, not a style preference. Current consumers: `app/admin/contratos.tsx`, `app/admin/preservacao.tsx`, `src/components/AdiarAcao.tsx`. Any change to `MiniCalendar` requires a regression pass across all three.
- **Multiline / long text:** same field style, taller `minHeight`, `textAlignVertical: top`.

### Status Badges / Selos
- **Style:** small pill (`rounded.sm`), 10%-opacity tint of the status color as background, full-opacity status color as text — no border on the softest informational tags (e.g. "Vigência indeterminada" in muted `Ink Muted`), a full-opacity 1px border on the ones meant to read as more alert (e.g. "Renovação em breve" in `Status Pending`).
- **Placement:** inline, directly below the content it qualifies (a card title, a progress bar) — never as a corner-pinned decoration.

### Navigation
- **Header:** fixed row — a 32px-wide left tap target (back chevron or spacer), a centered `Headline` title, a 32px-wide right tap target (a circular Ink Action "+", a context "…" menu, or a spacer to keep the title centered when no right action exists).
- **Bottom Tab Bar:** the one persistent nav surface, frosted-glass (`BlurView intensity 40, tint light`) with a hairline top border — used only where real scrollable content passes behind it. Active tab: Ink Action icon + a small dot indicator; inactive: `Ink Primary` icon, no dot. An optional small red dot marks a pending-item badge on a tab.

### Full-Screen Modal (signature pattern)
Every create/edit flow — never a bottom sheet, never an inline expand — is a full-screen `Modal` that slides up: header with a centered title and a right-side "X" that closes **without saving**, a scrollable body of `label` + field-style groups, and a sticky footer with one full-width primary action. A destructive "Excluir" action, when present, lives inside this same modal body and — on tap — replaces its own area with an inline confirmation ("Confirmar exclusão?" + Cancelar/Excluir), never a native `Alert.alert` and never a second modal stacked on top.

### Vencimento Gradient Bar (signature pattern)
Contracts render a thin progress bar whose fill color is a continuous function of days-until-due, not a fixed status color. It is rendered inline in `app/admin/contratos.tsx` — not an extracted component — and its color comes from `corVencimento()` in `src/data/contratos.ts`, built on the pure helper `interpolarCorHex(corA, corB, fator)` (linear per-channel RGB blend, `fator` clamped to `[0,1]`). Real thresholds, read from the source:
- **≥ 60 days remaining:** fixed `Status OK`.
- **30–60 days remaining:** continuous interpolation from `Status OK` toward `Status Pending` (`fator = (60 − dias) / 30`).
- **0–30 days remaining:** continuous interpolation from `Status Pending` toward `Status Overdue` (`fator = (30 − dias) / 30`).
- **Overdue (< 0 days remaining):** fixed `Status Overdue`.
See the Closed Status Set Rule's exception, above, for why this continuous blend is authorized where a fixed three-value badge would not be.

### AI Assistant Chat (signature pattern)
Both shipped assistants (Normativos, Contratos) render inside this same full-screen modal shell. Assistant replies are left-aligned `Card White` bubbles with a copy affordance; user turns are right-aligned solid Ink Action bubbles. A pending reply shows three animated dots in the assistant-bubble position — never a "Digitando…" text label. A fixed, non-generated caption ("Respostas geradas por IA…") sits above the input, outside the scrolling message list, at all times.

**Charts.** A Relatórios chart that doesn't represent a status value (e.g. a monthly total by contract type) marks its data in Ink Action, never a leftover accent color. Only a chart segment that literally represents ok/pending/overdue is allowed a status color; everything else drawn on a chart is ink.

## Do's and Don'ts

### Do:
- **Do** build every list as ruled rows on `Warm Paper` — a title, its metadata, and a right-aligned tabular number, separated by a 1px rule — never a bordered, radius-cornered card.
- **Do** use ink as shape, not color, to tell actions from text: a filled Ink Action block for the primary action, a 1.5px underline for a secondary one, plain text for everything else.
- **Do** set Display and Headline in Source Serif 4 and everything else in Inter — two families, each with exactly one job, never a third.
- **Do** use the tinted-background-plus-full-opacity-text pattern (`{status-color}` at ~10% opacity as fill, full opacity as text/border) for every status badge, chip, and tag.
- **Do** route every date entry through `MiniCalendar`; a date field is a trigger, never a free-text input.
- **Do** keep destructive confirmation inline inside the same modal (replace the area, don't stack a second modal or use a native alert).
- **Do** treat Zeladoria/execution screens as full-screen, single-primary-action flows, set entirely in Inter — strip, don't shrink, the Administrador density down to them.

### Don't:
- **Don't** reach for Cobalt Ink or any brand-blue accent — it's retired. The only accent left in the system is ink.
- **Don't** give a list item its own background fill, border, or corner radius at rest — that's a card, and cards are reserved for surfaces genuinely floating above the page (`CardMenu`, the calendar overlay), never for a row in a plain list.
- **Don't** introduce a purple-blue gradient, 3D illustration, or any other generic-SaaS-kit visual — this system is explicitly built against that look.
- **Don't** pair Warm Paper with an orange/terracotta accent near `#D97757` — this exact combination was tried, recognized as an AI-generated-design signal, and deliberately replaced.
- **Don't** add a drop shadow to a row, button, or input at rest. If it isn't a temporary floating overlay, it doesn't get one.
- **Don't** apply blur/glass over a static, non-scrolling background — blur is reserved for the one surface with real content passing behind it.
- **Don't** use a native `Alert.alert`, `confirm()`, or a stacked second modal for destructive confirmation — always the inline in-modal pattern.
- **Don't** use uppercase text transforms, or any font outside Source Serif 4 (Display/Headline) and Inter (Title/Body/Label).
