# Design System Rules

**Status**: Active
**Enforcement**: Strict

## 1. Typography
-   **Font Family**: `Geist Sans`
-   **Hierarchy**:
    -   Headers: Tight tracking (`tracking-tight`), Bold/Semibold.
    -   Body: Regular weight, relaxed line-height.
    -   Secondary Text: Muted colors (`text-zinc-500`).

## 2. Color Palette
-   **Primary Neutral**: Zinc (`zinc-50` to `zinc-950`).
-   **Backgrounds**: `bg-zinc-50` or `bg-white`.
-   **Borders**: `border-zinc-200` with `opacity-50` preferred for subtle separation.

## 3. Layout & Spacing
-   **Whitespace**: Prioritize high whitespace.
-   **Section Spacing**: Use `gap-8` (2rem) as the standard separation between major sections.
-   **Containers**: Use `rounded-2xl` for all cards and major containers.

## 4. Interactivity
-   **All Interactive Elements** (Buttons, Cards, Links):
    -   Must have smooth transitions: `transition-all`.
    -   Hover effect: `hover:scale-[1.01]`.
    -   Active effect: `active:scale-[0.98]` (optional but recommended).

## 5. Components
### Cards
-   **Shape**: `rounded-2xl`.
-   **Border**: `border border-zinc-200/50`.
-   **Shadow**: Subtle `shadow-sm` or none.

### Buttons
-   **Primary**: Zinc-900 text-white `rounded-full` or `rounded-2xl`.
-   **Secondary**: Zinc-100 text-zinc-900.

---
*These rules are configured in `tailwind.config.js` and `src/index.css`.*
