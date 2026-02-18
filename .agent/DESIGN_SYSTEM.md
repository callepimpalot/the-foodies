🎨 Current Design Language
Style: Premium Glassmorphism.
Layout: 4px vertical rhythm grid system.
Transitions: Feathered mask-image headers for smooth scroll depth.
Standard: Responsive-first, ensuring elegance across all device types.

## CTO Architectural Audit Updates
Palette: Strict Zinc palette for all surfaces.
Iconography: Use Lucide icons exclusively; 1.5px stroke weight, 20px size.
Grid: 20px global gutters and 40px vertical section gaps.
Mobile: Use 100dvh and GPU-accelerated transforms for stability.
Headers: Maintain backdrop-blur-md and feathered mask-image transitions.

## Component Standards
**Recipe Cards:**
- **Grid Layout:** Strictly 2-column grid with `gap-4` for recipe feeds.
- **Aspect Ratio:** Strictly `aspect-[4/5]` for all vertical cards.
- **Visuals:** Full bleed images with cinematic gradient overlays.
- **Fallback State:** If image fails, use `bg-gradient-to-br from-zinc-900 to-zinc-950` with centered "FOODIES" logo.
- **Typography:** Titles must be `font-bold`, `tracking-tight`, and scaled to container (no squeezing).
