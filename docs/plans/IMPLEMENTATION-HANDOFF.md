# Insane Crazy 8 — Theme Implementation Handoff Prompt

**Approved design:** `docs/design/THEME-DG-V0.md`  
**Task:** Produce a detailed implementation plan for applying the approved Doodle God / Sketchbook visual theme to the existing web app.

## Context

The visual direction is finalized: a light graph-paper notebook look, vertical "element tile" playing cards with clean CSS borders and hand-drawn SVG icons, paper-colored surfaces, and a friendly school-desk-doodle mood. The existing app is a Bun + TypeScript real-time multiplayer game; the frontend is plain TypeScript served from `public/`. No game rules are changing, only look & feel.

## Required reading

Read these files before planning:

1. `CLAUDE.md` — project overview, architecture, constraints, dev commands
2. `docs/design/THEME-DG-V0.md` — the approved design
3. `docs/OVERVIEW.md` — roadmap and plan structure conventions
4. `public/styles.css` — the current CSS to be rewritten
5. `public/index.html` — lobby markup
6. `public/game.html` — game board markup
7. `public/game-client.ts` — game DOM/render logic
8. `public/lobby.ts` — lobby DOM/render logic

## What to produce

Create a new plan file at: `docs/plans/IMPLEMENTATION-DG-THEME.md`

It must contain:

### 1. Scope summary
- What changes; what does **not** change (e.g., game logic, network protocol)
- Explicitly state that room/game state remains unchanged

### 2. Work breakdown / phases
Suggested order:

1. **Foundation** — new CSS custom properties, fonts, base resets, paper/grid background
2. **Card system** — new card CSS classes, SVG icon set, color labels, card back
3. **Lobby** — retheme room creation / join / waiting UI
4. **Game board** — retheme piles, hand fan, opponent avatars, HUD, modals
5. **Motion / polish** — animations, reduced-motion, micro-interactions
6. **Build & verification** — `bun run build`, mobile smoke test

### 3. File-by-file changes
For each touched file, list:
- What to add / remove / rewrite
- Any new class names or dependencies
- Any content-only changes (e.g., copy rewrites)

### 4. New assets needed
- SVG doodle icons per element/color
- Logo/title treatment
- Button textures or repeated borders (if any)
- Optional graph-paper background image

### 5. Technical decisions to make
- Should we keep `styles.css` monolithic or split into modules?
- Inline SVG defs vs. separate `.svg` sprite file
- Strategy for icon replacement in `game-client.ts` (currently card text?)

### 6. Risk / uncertainty log
Call out anything ambiguous in the design doc, such as:
- Exact roughness of borders
- Whether to show color labels on all hand cards
- Whether graph grid should be CSS-only or an image
- Fallback behavior when user has no network font load

### 7. Verification checklist
- `bun dev` starts and loads
- `bun run build` passes TypeScript check
- Cards render in hand fan on mobile viewport (≤390 px wide)
- Colorblind-friendly: card values/icons readable independent of color
- `prefers-reduced-motion` disables motion

## Use pi features where they help

- **Subagents:** Run parallel explorations. For example:
  - Subagent 1: Audit current CSS; map every selector that needs renaming or deletion.
  - Subagent 2: Audit `game-client.ts` DOM generation for cards; report how card HTML is built and what data is available for new icons.
  - Subagent 3: Generate the SVG icon set (fire, water, earth, air, wild, +2, +4, +20, skip, reverse, swap) as simple hand-drawn doodles matching the design.
- **Skills:** If you hit an unexpected bug, invoke the `systematic-debugging` skill for root-cause-first methodology.
- **Visual companion (optional):** If you need to validate card/board treatments, consider restarting the brainstorming visual companion to compare variations with the user.

## Hard constraints

- Mobile-first; do not degrade phone playability for desktop polish
- No database; all state stays in-memory
- Do not change the WebSocket message protocol or game rules
- TypeScript must compile with `bun run build`
- Respect `prefers-reduced-motion`
- Keep clean CSS borders (per approved decision — no wobbly SVG strokes per-card)

## Success criteria for this plan

The implementation plan is done when:
1. `docs/plans/IMPLEMENTATION-DG-THEME.md` exists and is complete enough that another coder could execute it without re-reading the whole design doc.
2. Every file change is accounted for in the plan.
3. Asset requirements are itemized (SVG names, sizes, views).
4. Risks and open questions are clearly listed with recommended defaults.

Start planning.
