# 🎫 DESIGN_SYSTEM.md — Meal Buddy / The Foodies
# Version 3.0 — The Chit Rail
# Source of Truth for all visual and component decisions.
# All agents derive design values from this file. Never hardcode values.
# CSS lives in src/mealbuddy-design-system.css. Tailwind tokens live in tailwind.config.js.
# Shared React primitives live in src/components/ui/ (Button, TicketCard, Sheet, Chip) — use them.

---

## 1. DESIGN PHILOSOPHY

**Style:** The Chit Rail — a kitchen order ticket, clipped above a line cook's station.
**Mood:** A tool, not a mood board. Warm because it's useful, not because it's trying to be a magazine.
**Reference:** Dark chalkboard-green shell holding warm kraft-paper "ticket" cards — like tickets pinned to a rail above the stove.
**Anti-pattern:** Not a "premium coffee-table cookbook." No full-bleed photo-card grids as the primary pattern. No pill-shaped buttons except the one stamp mark. No emoji in UI chrome.

**The one-sentence brief for any agent:**
"One dad, a phone propped against a spice rack — a ticket rail earns its warmth by being useful first."

**Note on history:** v2.0 ("Cinematic Zinc," dark/gold/Playfair) was documented but never actually implemented — the shipped app was a plain light zinc/white theme, and this file didn't match reality. v3.0 is a full rebuild: the tokens below are the actual live CSS and Tailwind config, not an aspiration. If you change a value, change it in `src/mealbuddy-design-system.css` / `tailwind.config.js` first, then update this file to match — never the other way around.

---

## 2. COLOR PALETTE

### The board — shell & chrome
| Token | Hex | Tailwind | Usage |
|---|---|---|---|
| --board | #14211B | `bg-board` | App background. Chalkboard green-black — a real hue, not neutral gray. |
| --board-2 | #1C2C24 | `bg-board2` | Header, nav bar, elevated chrome panels. |
| --line | #33493B | `border-line` | Hairlines, dividers, resting borders. |
| --chalk | #EDE7D8 | `text-chalk` | Primary text on the board. Warm, never pure white. |
| --chalk-dim | #93A395 | `text-chalkDim` | Secondary text, captions, muted labels, inactive nav. |

### The ticket — card surface
| Token | Hex | Tailwind | Usage |
|---|---|---|---|
| --ticket | #F1E7CC | `bg-ticket` | Card surface. Kraft paper, not white. |
| --ticket-2 | #EADFBE | `bg-ticket2` | Secondary ticket surface (nested chips/rows). |
| --ticket-shadow | #D8C495 | `border-ticketShadow` | Fold lines, dashed dividers, card drop. |
| --ink | #251C10 | `text-ink` | Primary text on ticket surfaces. |
| --ink-dim | #6B5D45 | `text-inkDim` | Secondary text on ticket surfaces. |

### The marks — used sparingly
| Token | Hex | Tailwind | Usage |
|---|---|---|---|
| --stamp | #C1442C | `bg-stamp` | **The one primary action per screen.** Rubber-stamp red. |
| --stamp-ink | #9C3620 | `border-stampInk` | Stamp hover/border-darken state. |
| --grease | #B98523 | `bg-grease` | Tags, difficulty, in-progress badges. Grease-pencil ochre. |
| --done | #5C7A4E | `bg-done` | Checked off, cooked, fired. Success state. |
| --destructive | #D8735E | — | Delete / remove actions only. |

### Forbidden
- No light/white app background anywhere — this is one deliberate dark visual world, not a light/dark toggle.
- No `rounded-full` buttons or cards — reserved for the one stamp mark only.
- No emoji in UI chrome (icons, buttons, nav, empty states). Emoji stay confined to user-facing pantry item data (`src/data/commonItems.js`) — that's product data, not UI chrome.
- Stamp red is not decorative. If more than one element per screen uses it, that's a bug, not a style choice.

---

## 3. TYPOGRAPHY

### Font Stack — four faces, four jobs, self-hosted via @fontsource
```css
--f-display: 'Anton', sans-serif;        /* Rare big numbers / stamps only */
--f-head:    'Zilla Slab', serif;        /* Recipe names, screen/section titles */
--f-body:    'IBM Plex Sans', sans-serif;/* Everything else: labels, copy, buttons, nav */
--f-mono:    'IBM Plex Mono', monospace; /* Every number, always */
```
No Google Fonts `<link>` needed — installed as npm packages (`@fontsource/anton`, `@fontsource/zilla-slab`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`), imported in `src/index.css`.

### The One Rule
**Every number renders in IBM Plex Mono, tabular.** Kcal, minutes, servings, quantities, timestamps, counts — no exceptions, never in body or heading type. This is the rule most worth enforcing in review: a kcal or time value in the wrong font is the single most common regression in this codebase's history.

**Zilla Slab = anything with a NAME.** Recipe titles, screen headings, section titles.
**IBM Plex Sans = everything else.** Tags, labels, buttons, metadata, body copy, captions.
**Anton is rare on purpose.** Reserve it for a handful of big stat callouts (e.g. "128 RECIPES") — if it shows up more than once or twice per screen, pull it back.

### Type Scale
| Role | Font | Size | Weight | Class |
|---|---|---|---|---|
| Display | Anton | clamp(34px, 5vw, 64px) | 400 | `.t-display` |
| Heading LG | Zilla Slab | 26px | 700 | `.t-heading-lg` |
| Heading MD | Zilla Slab | 21px | 700 | `.t-heading-md` |
| Heading SM | Zilla Slab | 17px | 600 | `.t-heading-sm` |
| Body | IBM Plex Sans | 14px | 400 | `.t-body` |
| Label | IBM Plex Sans | 12px | 600 | `.t-label` |
| Eyebrow | IBM Plex Mono | 10.5px | 400 | `.t-eyebrow` — uppercase, 0.1em tracking |
| Mono / data | IBM Plex Mono | context-dependent | 400–600 | `.t-mono` — always `tabular-nums` |

### Typography Rules
- Recipe titles never truncate with ellipsis — reduce font size instead.
- Eyebrow labels always mono, always uppercase, always 0.1em tracking.
- Numbers never share a text node with prose — give them their own `<span className="t-mono">`.

---

## 4. SPACING & LAYOUT

### Spacing Scale (unchanged from v2.0 — this was never the problem)
```css
--sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px; --sp-5: 20px;
--sp-6: 24px; --sp-8: 32px; --sp-10: 40px; --sp-12: 48px; --sp-16: 64px;
```

### Layout Rules
- **Global horizontal page padding: 16px (--sp-4), owned by `src/App.jsx` alone.** Every normal-flow view renders inside App.jsx's single padded container — views must NOT add their own `px-*` page-edge padding on top of it. (v2.0 had views re-adding `px-6` on top of App.jsx's own padding, silently doubling the margin to 40–48px on every screen — that's the bug this rule exists to prevent.) A view only needs its own horizontal inset if it renders as `fixed inset-0` and therefore escapes App.jsx's container (e.g. `CookModeView.jsx`).
- Card internal padding: 16–20px
- Vertical section gaps: 24–32px — v2.0 said 40px, which read as too generous once every screen was reviewed together
- Never use arbitrary pixel values — always use scale tokens

### Grid System
- Recipe feeds: 2-column grid
- Horizontal scroll rows: no visible scrollbar, scroll-snap where appropriate

### Mobile Rules
- Use 100dvh for full-height layouts
- GPU-accelerated transforms only for animations
- All interactive touch targets minimum 44×44px
- Nav bar respects `env(safe-area-inset-bottom)`
- One-handed thumb reach: primary actions bottom-anchored

---

## 5. BORDER RADIUS

Deliberately restrained — cut paper, not soft plastic.

```css
--r-xs: 3px;   /* tags, badges, small chips */
--r-sm: 6px;   /* buttons, inputs */
--r-md: 10px;  /* cards */
--r-lg: 14px;  /* modals, sheets, hero cards */
```

**`rounded-full` is reserved for the stamp mark only** (`.btn-stamp` / `StampButton`). Not buttons, not nav pills, not cards. If you reach for `rounded-full` anywhere else, you're reverting to the old (pre-v3.0) shipped theme by habit — stop and use the scale above instead.

---

## 6. TRANSITIONS & ANIMATION

```css
--t-fast:   150ms ease;   /* Taps, toggles */
--t-normal: 250ms ease;   /* Card reveals, slides */
--t-slow:   400ms ease;   /* Page transitions */
```

- Hardware-accelerated only: `transform` and `opacity`.
- Never animate `width`/`height`/`top`/`left`/`margin`/`padding`.
- Tap feedback: `scale(0.96–0.98)` on active state.
- Sheets/modals slide up via `.animate-slide-up`.

---

## 7. SHADOWS

```css
--shadow-card: 0 4px 16px rgba(0, 0, 0, 0.35);
--shadow-hero: 0 8px 32px rgba(0, 0, 0, 0.5);
```

---

## 8. IMAGE TREATMENT

Recipe photography is secondary to the ticket, not the whole card. Where a photo is used (recipe grid, discover feed), treat it as a small pinned "photo tag" (square, slightly rotated, clipped to the card corner) rather than a full-bleed background — this is a deliberate point of view, not a placeholder-image workaround.

### Image Fallback (mandatory — no broken images ever)
When `image_url` returns 404 or fails to load:
- Background: a two-color gradient built from `--grease`/`--done`/`--stamp` (rotate through the marks per card, per `RecipeCard.jsx`)
- Never show a broken image icon or a black box
- Do not mutate the recipe record — handle fallback in the UI layer only

---

## 9. COMPONENT STANDARDS

### Cards
- Base: `.card` — ticket surface, `--r-lg`, `--shadow-card`
- Hero/plan cards: add `.card-torn` (zigzag torn top edge) + `.card-punch` (center punch-hole dot) — use the `TicketCard` primitive with `torn`
- Chrome panels that sit on the board itself (not content cards): `.card-board` / `BoardCard`

### Buttons — `src/components/ui/Button.jsx`
- Primary: `.btn-primary` — stamp fill, ticket text. One per screen.
- Secondary: `.btn-secondary` — outline, chalk text
- Ghost: `.btn-ghost` — no border, dim text
- Destructive: `.btn-destructive` — outline, muted red
- Stamp mark: `.btn-stamp` / `StampButton` — the only round element in the system

### Sheets / Modals — `src/components/ui/Sheet.jsx`
Every bottom sheet and modal uses the shared `Sheet` component (`surface="ticket"` for content, `surface="board"` for app chrome). Do not hand-roll a new overlay+panel implementation — that's how the pre-v3.0 app ended up with eight different modal patterns.

### Tags & Badges — `src/components/ui/Chip.jsx`
- Static tag: `.tag`
- Interactive filter: `Chip variant="filter"`
- Stamp badge (e.g. "UP NEXT" eyebrow on a hero card): `.badge-stamp`
- Grease badge (e.g. difficulty): `.badge-grease`

### Navigation Bar — `src/components/BottomNav.jsx`
- Full-width, screen-anchored (`left: 0; right: 0; bottom: 0`) — **not a floating inset pill.**
- Background `--board-2`, `border-top: 1px solid var(--line)`
- 6 items: Home, Capture, Plan, Recipes, Shop, Pantry
- Active item: `--stamp` icon-dot background, `--chalk` label
- Inactive: transparent, `--chalk-dim` label
- Respects `env(safe-area-inset-bottom)`

### Lists (shopping list, menus) — `.list-ticket` / `.list-row`
- Ticket-paper container, dashed divider between rows (`--ticket-shadow`)
- Checked-off items: `--done` color + strikethrough — never just disappear

### Empty States
- Title: Zilla Slab italic, `--chalk-dim`
- Body: IBM Plex Sans, `--chalk-dim`, max-width ~260px
- No emoji icons — typographic solutions only

---

## 10. ICONOGRAPHY
- Library: Lucide icons exclusively
- Stroke weight: 1.5–2.25px (heavier when active)
- Size: 18–20px standard
- Color: `currentColor`, driven by `--chalk-dim` (default) / `--chalk` (active) / `--ink-dim` (on ticket surfaces)

---

## 11. HEADERS & NAVIGATION
- Backdrop blur on sticky headers over scrolling content
- Header chrome uses `--board-2`, not a translucent overlay on `--board`

---

## 12. SPECIAL CHARACTER HANDLING
- Never interpolate user-generated strings (recipe names, item names) into raw innerHTML
- Never use template literals that feed innerHTML
- Always use JSX rendering or textContent assignment
- This prevents the ampersand (&) fragility — a known project bug

---

## 13. CHANGELOG
| Date | Change | Reason |
|---|---|---|
| Aug 15 | v3.0 — Full rebuild to "The Chit Rail," implemented end-to-end (not just documented) | v2.0 described a system that was never actually shipped; user wanted a genuine rebrand after seeing the Chit Rail exploration artifact |
| Feb 20 | v2.0 — Full Zinc system documented (never fully implemented) | Design system was critically thin; rebuilt from scratch |
| Feb 10 | v1.0 — Migrated to Tailwind Zinc palette | Initial design system migration |
