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
  cobalt-ink: "#1F4FE0"
  cobalt-ink-pressed: "#16358F"
  cobalt-wash: "#E7ECFC"
  status-ok: "#2F7D53"
  status-pending: "#A9740B"
  status-overdue: "#B23A2E"
typography:
  display:
    fontFamily: "Inter_600SemiBold"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.15
  headline:
    fontFamily: "Inter_600SemiBold"
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
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.cobalt-ink}"
    textColor: "#FFFFFF"
    typography: "{typography.headline}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-primary-pressed:
    backgroundColor: "{colors.cobalt-ink-pressed}"
  button-destructive-outline:
    backgroundColor: "transparent"
    textColor: "{colors.status-overdue}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  chip-selected:
    backgroundColor: "{colors.cobalt-ink}"
    textColor: "#FFFFFF"
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
  card-surface:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Aegis Condomínios

## Overview

**Creative North Star: "The Quiet Ledger"**

Aegis is a ledger, not a billboard. Hierarchy and restraint communicate trust more than any visual effect could — the brand's one cobalt ink appears rarely and only with function (a primary action, a selected state, an active indicator), never as decoration. Surfaces stay warm and neutral, never cold or clinical: paper-toned backgrounds, hairline borders, no shine.

The system deliberately answers to two audiences with opposite densities inside one visual language. Administrador screens carry more on-screen structure — filters, menus, calendars, reports — because that work is desk-paced. Zeladoria screens strip to direct buttons and full-screen guided flow with no hidden menu, because that work happens on a phone, often outdoors in direct sun, where every extra tap costs something real. Both read as the same product; neither is a simplified version of the other.

Color is reserved almost entirely for status: a plan or order is ok (muted forest green), pending (ochre), or overdue (brick red) — never decorative. This system explicitly rejects two recognizable extremes: the generic SaaS kit (purple-blue gradients, cute 3D illustration, identical cards sharing one radius and one shadow with no hierarchy) and the warm-cream-plus-terracotta pairing near `#D97757` that reads today as an AI-generated-design tell — Aegis used exactly that accent early on and deliberately replaced it with the current cobalt once the resemblance was identified. Glass/blur is never decorative either: it appears only where real content actually scrolls behind it (the bottom tab bar), and was removed everywhere it showed up as an effect without a function.

**Key Characteristics:**
- One functional accent (cobalt ink), used rarely, never for decoration.
- Warm neutral paper tones throughout — no cold grays, no clinical whites.
- Status color (ok / pending / overdue) is the only place saturated color appears.
- Flat by default; shadow is reserved for temporary floating overlays only.
- Two densities, one language: Administrador is structured, Zeladoria is stripped down — both are "the real app," not a simplified companion.

## Colors

Paper and cobalt ink, with a small disciplined set of earthy status colors — nothing else in the system is allowed to be loud.

### Primary
- **Cobalt Ink** (`#1F4FE0`): the single functional accent — primary buttons, selected chips, active tab indicator, links. Used sparingly and only where it signals "this is the action" or "this is selected." Never a background wash for its own sake.
- **Cobalt Ink, Pressed** (`#16358F`): the pressed/active state of Cobalt Ink, darker and more saturated.
- **Cobalt Wash** (`#E7ECFC`): a near-white tint of the accent, reserved for the rare soft-fill treatment (e.g. an unselected switch track) — not a general-purpose light-blue background.

### Neutral
- **Warm Paper** (`#FAF9F6`): the base screen background. Every screen sits on this, reinforced by a very subtle warm-tinted radial/linear wash (see Elevation & Depth).
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

A `dark` neutral palette (`bg #121211`, `surface #1A1A19`, `elevated #232322`, `border #2E2E2C`, plus matching text tiers) exists in `src/theme/index.ts` but is not yet wired into any screen — every current screen imports `light` directly. Treat it as a reserved, unconfirmed direction rather than an active token set until a screen actually consumes it.

### Named Rules
**The Rare Ink Rule.** Cobalt Ink appears on primary actions, selection, and active indicators only — never as a background wash, never as decoration, never just because a screen "needs some color." If removing it wouldn't break comprehension of what's actionable or selected, it doesn't belong there.

**The Status-Only Saturation Rule.** OK/Pending/Overdue are the only saturated colors permitted anywhere in the system. A designer reaching for a "nice accent color" for anything else is reaching for the wrong tool — use Cobalt Ink (function) or a neutral (structure) instead.

**The No-Terracotta Rule.** Never pair Warm Paper with an orange/terracotta accent near `#D97757`. That combination is a known, deliberately rejected AI-generated-design signal for this product — it was tried and replaced.

## Typography

**Body & Display Font:** Inter (with system-sans fallback) — a single family across every weight in use (400/500/600), no secondary or mono face.

**Character:** Inter at these weights reads as neutral, legible, and unshowy — exactly the "ledger" register: it disappears into the content instead of performing personality.

### Hierarchy
- **Display** (Inter SemiBold 600, 24px): the rare big number — a stat total on a report tile, a large percentage. Used only for a single hero figure per section, never for body content.
- **Headline** (Inter SemiBold 600, 17px, centered): screen titles and full-screen modal titles. Admin's own home title runs slightly larger (20px) as the one exception at the root of the navigation stack; every pushed screen and modal uses 17px.
- **Title** (Inter Medium 500, 15px): card titles, primary list-item text, standalone destructive-button labels.
- **Body** (Inter Regular 400, 14–15px): chat bubble text, form input text, descriptive card text (contraparte, resumo, chip labels' regular sibling). 15px inside form inputs, 14px inside chat bubbles and denser card metadata.
- **Label** (Inter Medium 500, 11–13px): field labels, secondary meta text ("Atualizado em…", "Vence em…"), badge/selo text, chip text, bottom-tab labels. No uppercase transform anywhere in the system — case stays as written.

### Named Rules
**The One-Family Rule.** Inter, three weights (400/500/600), no exceptions. Weight and size carry hierarchy; a second typeface would be decoration, not structure.

## Layout

Every screen is a single-column, full-bleed stack: a fixed header (back affordance + centered title + a right-side action), a scrollable body, and — for edit/creation flows — a full-screen `Modal` that slides up rather than a sheet or popover. There is no persistent sidebar; the only persistent chrome is the frosted bottom tab bar on screens that have more than one section (e.g. Contratos' Listagem/Relatórios).

Spacing runs on an 8px base scale (`xs 4 · sm 8 · md 16 · lg 24 · xl 32`). Screen padding is consistently `spacing.lg` (24px) horizontal; card internal padding is `spacing.md` (16px); the gap between stacked form fields is `spacing.lg` (24px), between list cards `spacing.sm`–`spacing.md`. Scrollable content that sits above the bottom tab bar reserves 90px of bottom padding so the last item never hides behind it.

Density is the deliberate lever between the two audiences: Administrador screens compose multiple `field` blocks, chip rows, and calendar pickers in sequence inside one scroll; Zeladoria/execution screens reduce to one primary action and minimal supporting text per screen, often full-screen and modal, to keep a field worker's next tap unambiguous.

## Elevation & Depth

Flat by default, confirmed as an invariant, not an omission. Every resting surface — card, input, button, modal body — carries a 1px `Hairline Border` and zero shadow; separation comes from that hairline and from the `Card White`-on-`Warm Paper` (or `Sunken Linen`-recessed) tonal step, never from a drop shadow. Pure black shadows and `elevation:` bumps do not appear on anything sitting flush against the screen.

Shadow is reserved for genuinely temporary, floating content: a context menu or a date-picker overlay that appears above the current screen and must read as "not part of the page flow." Those get a real soft shadow (`shadowOpacity 0.15, shadowRadius 8, offset {0,4}`, `elevation 8` on Android) plus a hairline border, and disappear on dismiss.

Blur/glass is not a decorative material here — it is used exactly once, on the persistent bottom tab bar, and only because real scrollable content passes behind it; anywhere blur appeared over a flat, non-scrolling background it has been removed as an effect without a function.

### Shadow Vocabulary
- **Floating overlay** (`shadowColor: #000, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: {0,4}, elevation: 8`): context menus (`CardMenu`), inline date-picker overlays. Never applied to a resting card, button, or input.

### Named Rules
**The Flat-at-Rest Rule.** If a surface isn't floating above other content right now, it has a hairline border and no shadow. Shadow means "temporary and above the page," full stop.

**The Function-Only Blur Rule.** Blur is a material for real content passing behind an element, not an aesthetic finish. No blur over a static, non-scrolling background.

## Shapes

Three radius steps only — `sm` (8px, small badges and secondary buttons), `md` (12px, the default: cards, inputs, primary buttons, modal panels), `lg` (16px, pills: chips, status badges, the largest modal-panel corners). No sharp (0px) corners and no fully circular corners outside genuinely circular controls (the header "+" add button, the bottom-tab icon indicator dot). Borders are always 1px and hairline-colored at rest; a colored 1px border (status color) marks an outline/destructive button or a status badge, never a decorative accent.

## Components

### Buttons
- **Shape:** `rounded.md` (12px) for the standard full-width footer button; `rounded.sm`–`rounded.md` for inline/destructive buttons.
- **Primary:** solid Cobalt Ink background, white `Headline`/`Title`-weight label, full-width in modal footers, `12px` vertical padding. Pressed state darkens to Cobalt Ink Pressed; disabled drops to 40% opacity — no other disabled treatment.
- **Destructive / Outline:** transparent background, 1px Status Overdue border, Status Overdue text — used for "Excluir," never filled solid red.
- **Icon-only (add/back/close):** no background at rest; the header "+" action is the one circular filled exception (Cobalt Ink circle, white icon).

### Chips
- **Style:** pill shape (`rounded.lg`), used for every user-facing single/multi-select in forms (tipo, periodicidade, prioridade) — never a native picker or dropdown.
- **Selected:** solid fill in the assigned accent (Cobalt Ink by default, or a semantic color when the chip represents a status/priority value), white text.
- **Unselected, neutral:** `Card White` background, `Hairline Border`, `Ink Primary` text.
- **Unselected, color-coded:** 10%-opacity tint of the assigned color as background, full-opacity color as border and text (see Named Rule below).

### Cards / Containers
- **Corner Style:** `rounded.md` (12px).
- **Background:** `Card White` on `Warm Paper`.
- **Shadow Strategy:** none (see Elevation & Depth) — separation is the hairline border plus the tonal step from the page background.
- **Border:** 1px `Hairline Border`.
- **Internal Padding:** `spacing.md` (16px), internal vertical rhythm `spacing.xs`–`spacing.sm`.

### Inputs / Fields
- **Style:** `Sunken Linen` background (recessed, not raised), 1px `Hairline Border`, `rounded.md`, `Body` text.
- **Date fields never accept free text.** Every date value is entered through the shared calendar picker component, triggered from a field that echoes the already-formatted `DD/MM/AAAA` value — this is an enforced product rule, not a style preference.
- **Multiline / long text:** same field style, taller `minHeight`, `textAlignVertical: top`.

### Status Badges / Selos
- **Style:** small pill (`rounded.sm`), 10%-opacity tint of the status color as background, full-opacity status color as text — no border on the softest informational tags (e.g. "Vigência indeterminada" in muted `Ink Muted`), a full-opacity 1px border on the ones meant to read as more alert (e.g. "Renovação em breve" in `Status Pending`).
- **Placement:** inline, directly below the content it qualifies (a card title, a progress bar) — never as a corner-pinned decoration.

### Navigation
- **Header:** fixed row — a 32px-wide left tap target (back chevron or spacer), a centered `Headline` title, a 32px-wide right tap target (a circular Cobalt Ink "+", a context "…" menu, or a spacer to keep the title centered when no right action exists).
- **Bottom Tab Bar:** the one persistent nav surface, frosted-glass (`BlurView intensity 40, tint light`) with a hairline top border and a faint white sheen gradient — used only where real scrollable content passes behind it. Active tab: Cobalt Ink icon + a small dot indicator; inactive: `Ink Primary` icon, no dot. An optional small red dot marks a pending-item badge on a tab.

### Full-Screen Modal (signature pattern)
Every create/edit flow — never a bottom sheet, never an inline expand — is a full-screen `Modal` that slides up: header with a centered title and a right-side "X" that closes **without saving**, a scrollable body of `label` + field-style groups, and a sticky footer with one full-width primary action. A destructive "Excluir" action, when present, lives inside this same modal body and — on tap — replaces its own area with an inline confirmation ("Confirmar exclusão?" + Cancelar/Excluir), never a native `Alert.alert` and never a second modal stacked on top.

### AI Assistant Chat (signature pattern)
Both shipped assistants (Normativos, Contratos) render inside this same full-screen modal shell. Assistant replies are left-aligned `Card White` bubbles with a copy affordance; user turns are right-aligned solid Cobalt Ink bubbles. A pending reply shows three animated dots in the assistant-bubble position — never a "Digitando…" text label. A fixed, non-generated caption ("Respostas geradas por IA…") sits above the input, outside the scrolling message list, at all times.

## Do's and Don'ts

### Do:
- **Do** use Cobalt Ink only for primary actions, selected state, and active indicators — everywhere else, reach for a neutral.
- **Do** keep every resting surface flat with a 1px `Hairline Border`; reserve shadow for floating overlays that sit temporarily above the page.
- **Do** use the tinted-background-plus-full-opacity-text pattern (`{status-color}` at ~10% opacity as fill, full opacity as text/border) for every status badge, chip, and tag.
- **Do** route every date entry through the shared calendar-picker component; a date field is a trigger, never a free-text input.
- **Do** keep destructive confirmation inline inside the same modal (replace the area, don't stack a second modal or use a native alert).
- **Do** treat Zeladoria/execution screens as full-screen, single-primary-action flows — strip, don't shrink, the Administrador density down to them.

### Don't:
- **Don't** introduce a purple-blue gradient, 3D illustration, or any other generic-SaaS-kit visual — this system is explicitly built against that look.
- **Don't** pair Warm Paper with an orange/terracotta accent near `#D97757` — this exact combination was tried, recognized as an AI-generated-design signal, and deliberately replaced.
- **Don't** add a drop shadow to a card, button, or input at rest. If it isn't a temporary floating overlay, it doesn't get one.
- **Don't** apply blur/glass over a static, non-scrolling background — blur is reserved for the one surface with real content passing behind it.
- **Don't** use a native `Alert.alert`, `confirm()`, or a stacked second modal for destructive confirmation — always the inline in-modal pattern.
- **Don't** use uppercase text transforms, a second typeface, or any weight of Inter outside 400/500/600.
