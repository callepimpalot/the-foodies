# 🎨 DESIGN_SYSTEM.md — Meal Buddy / The Foodies
# Version 2.0 — Zinc Design System
# Source of Truth for all visual and component decisions.
# All agents derive design values from this file. Never hardcode values.

---

## 1. DESIGN PHILOSOPHY

**Style:** Cinematic Zinc — Premium Glassmorphism meets Editorial Magazine
**Mood:** Dark, moody, high-contrast. Like a high-end restaurant shot with a single side-light.
**Reference:** A digital culinary magazine that happens to be interactive. Not a utility app.
**Anti-pattern:** No bright hospital cafeteria lighting. No foodie oranges or bright greens in UI chrome. No generic "AI slop" layouts.

**The one-sentence brief for any agent:**
"Every screen should feel like flipping through a premium coffee-table cookbook in a dark room."

---

## 2. COLOR PALETTE

### Backgrounds & Surfaces
| Token | Hex | Usage |
|---|---|---|
| --zinc-950 | #09090b | App background — the base of everything |
| --zinc-900 | #18181b | Card background |
| --zinc-800 | #27272a | Elevated surfaces, modals, bottom sheets |
| --zinc-700 | #3f3f46 | Borders, dividers, separators |

### Text Hierarchy
| Token | Hex | Usage |
|---|---|---|
| --zinc-50 | #fafafa | Hero headings — maximum contrast |
| --zinc-200 | #e4e4e7 | Primary body text |
| --zinc-400 | #a1a1aa | Secondary text, metadata |
| --zinc-500 | #71717a | Placeholder, muted, captions |
| --zinc-600 | #52525b | Disabled states |

### Accent Colors
| Token | Hex | Usage |
|---|---|---|
| --gold | #c9a96e | Primary accent — hero labels, CTAs, active states, eyebrows |
| --gold-dim | #7a6240 | Secondary gold — muted use only |
| --gold-bg | rgba(201,169,110,0.08) | Gold tint background |
| --gold-border | rgba(201,169,110,0.25) | Gold tint border |
| --cream | #f5f0e8 | Off-white for text overlaid directly on food images |
| --slate | #475569 | Tags, time badges, secondary UI elements |

### Semantic / Functional
| Token | Hex | Usage |
|---|---|---|
| --success | #4ade80 | Bought / confirmed / complete |
| --warning | #f59e0b | Low stock nudge |
| --destructive | #ef4444 | Delete / remove actions |

### Forbidden Colors
- No teal or cyan anywhere in UI chrome — remove all legacy instances
- No bright greens in UI (success green only for functional states)
- No white or near-white backgrounds on any screen
- No orange, red, or "foodie" warm tones in UI chrome

---

## 3. TYPOGRAPHY

### Font Stack
```css
--font-display: 'Playfair Display', serif;   /* Names, titles, headings */
--font-ui:      'DM Sans', sans-serif;        /* Everything else */
--font-mono:    'DM Mono', monospace;         /* Numbers, data, timestamps */
```

### Google Fonts Import (paste into index.html <head>)
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### The One Rule
**Playfair Display = anything with a NAME.**
**DM Sans = everything else.**

If it's a recipe title, screen heading, or greeting → Playfair Display.
If it's a tag, label, button, metadata, body copy, or caption → DM Sans.
If it's a number, quantity, kcal, or timestamp → DM Mono.
They never compete. They divide the work.

### Type Scale
| Role | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Display | Playfair Display | clamp(32px, 8vw, 48px) | 900 | Screen titles, greetings |
| Display Italic | Playfair Display | clamp(28px, 7vw, 42px) | 400 italic | Editorial moments e.g. "Magazine" |
| Heading | Playfair Display | 22px | 700 | Recipe names, card titles |
| Heading MD | Playfair Display | 18px | 700 | Section titles |
| Eyebrow | DM Sans | 10px | 600 | Letter-spacing 0.2em, uppercase, gold color |
| Body LG | DM Sans | 16px | 300 | Subtitles, descriptions |
| Body | DM Sans | 14px | 400 | Standard copy |
| Label | DM Sans | 12px | 500 | Tags, buttons, nav |
| Caption | DM Sans | 11px | 400 | Timestamps, secondary meta |
| Mono | DM Mono | 12px | 400 | Kcal, quantities, timestamps |
| Recipe Card | Playfair Display | 14px | 700 | On image overlays — use --cream color |
| Hero Recipe | Playfair Display | 26px | 700 | Large home screen card |

### Typography Rules
- Recipe titles never truncate with ellipsis — reduce font size instead
- `tracking-tight` on all display and heading sizes
- `font-bold` on hero titles
- Eyebrow labels always gold (#c9a96e), always uppercase, always letter-spacing 0.2em

---

## 4. SPACING & LAYOUT

### Spacing Scale
```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
```

### Layout Rules
- Global horizontal page padding: 24px (--space-6)
- Card internal padding: 16px minimum (--space-4)
- Vertical section gaps: 40px (--space-10)
- Global gutters: 20px
- Vertical rhythm grid: 4px base unit
- Never use arbitrary pixel values — always use scale tokens

### Grid System
- Recipe feeds: strictly 2-column grid, gap-4
- Essentials grid: 3-column within category sections
- Horizontal scroll rows: no scrollbar visible, scroll-snap where appropriate

### Mobile Rules
- Use 100dvh for full-height layouts — prevents jumping dock
- GPU-accelerated transforms only for animations
- All interactive touch targets minimum 44x44px
- Bottom nav safe area: 28px bottom padding minimum
- One-handed thumb reach: primary actions bottom-anchored

---

## 5. BORDER RADIUS
```css
--radius-sm:   10px;   /* Tags, badges, small elements */
--radius-md:   14px;   /* Recipe cards, grid items */
--radius-lg:   18px;   /* Main cards */
--radius-xl:   24px;   /* Hero cards, bottom sheets, modals */
--radius-pill: 999px;  /* Buttons, tags, nav bar */
```

---

## 6. TRANSITIONS & ANIMATION

```css
--transition-fast:   150ms ease;   /* Taps, toggles */
--transition-normal: 250ms ease;   /* Card reveals, slides */
--transition-slow:   400ms ease;   /* Page transitions */
```

### Animation Rules
- **Hardware-accelerated only:** transform and opacity exclusively
- **Never animate:** width, height, top, left, margin, padding — these trigger layout
- Swipe card physics: JS handles during drag, CSS transition on release only
- Tap feedback: scale(0.96-0.98) on active state, returns on release
- All transitions feel instant at 150ms, deliberate at 250ms

---

## 7. SHADOWS
```css
--shadow-card: 0 4px 24px rgba(0, 0, 0, 0.4);
--shadow-hero: 0 8px 40px rgba(0, 0, 0, 0.6);
```

---

## 8. IMAGE TREATMENT

All food images must have an overlay applied. Raw images are never shown directly.

### Overlay Patterns
```css
/* Standard recipe card overlay */
.img-overlay {
  background: linear-gradient(
    to top,
    rgba(9,9,11,0.90) 0%,
    rgba(9,9,11,0.40) 50%,
    rgba(9,9,11,0.10) 100%
  );
}

/* Hero card overlay — stronger */
.img-overlay-hero {
  background: linear-gradient(
    to top,
    rgba(9,9,11,0.95) 0%,
    rgba(9,9,11,0.50) 40%,
    rgba(9,9,11,0.10) 100%
  );
}

/* Cinematic side-light glow — adds moody depth */
.img-glow {
  background: radial-gradient(
    ellipse at 70% 30%,
    rgba(201,169,110,0.12) 0%,
    transparent 65%
  );
}
```

### Image Fallback (mandatory — no broken images ever)
When imageUrl returns 404 or fails to load:
- Background: `linear-gradient(135deg, #18181b 0%, #09090b 100%)`
- Centered recipe title in Playfair Display italic, --zinc-500 color
- Never show a broken image icon
- Never show a black box
- Do not mutate the recipe record — handle fallback in UI layer only

---

## 9. COMPONENT STANDARDS

### Recipe Cards (Grid)
- Layout: 2-column grid, gap-4, strictly enforced
- Aspect ratio: aspect-[4/5] for all vertical cards
- Image: full bleed with .img-overlay gradient
- Title: Playfair Display 700, 14px, --cream color, bottom-left
- Meta: DM Sans 400, 10px, --zinc-400
- Fallback: zinc gradient + centered Playfair italic title
- Hover: scale(1.02), transition-fast
- Tap: scale(0.98) active state

### Hero Card (Home Screen)
- Full width, border-radius --radius-xl
- Min-height: 200px
- Image: full bleed with .img-overlay-hero + .img-glow
- UP NEXT badge: gold eyebrow badge, top-left
- Recipe title: Playfair Display 700, 24px, --zinc-50
- Tags row: DM Sans 500, 10px, semi-transparent pill tags
- Shadow: --shadow-hero

### Essential Item Cards
- 3-column grid within category
- Neutral state: --zinc-800 background, --zinc-700 border
- Flagged state: --gold-bg background, --gold-border border, --gold text
- Emoji: 20px, centered above name
- Name: DM Sans 400, 11px
- Tap: instant toggle, scale(0.96) active, transition-fast
- No confirmation dialog — single tap toggles

### Day Cards (Planning HQ)
- Min-width: 140px, horizontal scroll row
- Background: --zinc-900, border --zinc-700
- Day name: DM Sans 600, 10px, uppercase, --zinc-500
- Day number: Playfair Display 900, 28px, --zinc-200
- Empty slot: dashed --zinc-700 border, --zinc-600 text
- Selected slot: solid --gold border, --gold-bg background
- Filled slot: recipe thumbnail with overlay, Playfair title bottom-left

### Buttons
- Primary CTA: full-width pill, --zinc-50 background, --zinc-950 text, Playfair Display 700 16px
- Secondary: --zinc-800 background, --zinc-200 text, --zinc-700 border, DM Sans 500
- Ghost: transparent, --zinc-400 text, hover reveals --zinc-800 background
- Destructive: rgba(239,68,68,0.1) background, --destructive text, matching border

### Tags & Badges
- Standard tag: rgba(255,255,255,0.07) background, rgba(255,255,255,0.10) border, --zinc-400 text, pill
- Gold badge: --gold-bg background, --gold-border border, --gold text, uppercase, tracking-wide
- Count badge: DM Mono 11px, --zinc-500

### Navigation Bar
- Background: --zinc-900
- Border-top: 1px solid --zinc-800
- Border-radius: top corners --radius-xl only
- Bottom padding: 28px for safe area
- Active item: --zinc-800 icon background, --zinc-200 label
- Inactive: transparent background, --zinc-600 label
- Label: DM Sans 500, 9px, uppercase

### Empty States
- Never broken, never clinical
- Title: Playfair Display italic, 20px, --zinc-500
- Body: DM Sans 300, 14px, --zinc-600, max-width 260px
- No emoji icons in empty states — typographic solutions only

---

## 10. ICONOGRAPHY
- Library: Lucide icons exclusively
- Stroke weight: 1.5px
- Size: 20px standard
- Color: inherits from context (--zinc-400 default, --zinc-200 active)

---

## 11. HEADERS & NAVIGATION
- Backdrop blur: backdrop-blur-md on sticky headers
- Feathered mask-image transitions for smooth scroll depth
- Frosted glass effect on fixed headers over content

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
| Feb 20 | v2.0 — Full Zinc system documented | Design system was critically thin; rebuilt from scratch |
| Feb 10 | v1.0 — Migrated to Tailwind Zinc palette | Initial design system migration |
