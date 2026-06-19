# Insane Crazy 8 — Doodle God Theme v0 Implementation Plan

**Source brief:** `docs/design/THEME-DG-V0.md`  
**Status:** implementation specification / CSS rewrite checklist  
**Scope:** visual theme only — no game-rule or protocol changes.

---

## 1. Goal

Replace the current iOS/green-felt aesthetic with the **True Doodle God / Sketchbook** theme:

- Light graph-paper background (`--paper-bg`).
- Thick ink outlines, flat bright element tiles.
- Hand-drawn SVG iconography on cards.
- Notebook-paper UI components (buttons, inputs, modals).
- `transform`/`opacity` motion only; `prefers-reduced-motion` support preserved.

All existing functionality (lobby, room management, game flow, special cards, admin panel, haptics, reduced motion) stays intact.

---

## 2. Design tokens (CSS `:root` rewrite)

Replace the iOS palette in `public/styles.css` with these tokens. Keep legacy variable names only where code depends on them internally; otherwise map everything to the new ink/paper system.

### Surfaces & ink

| Token | Value | Notes |
|-------|-------|-------|
| `--paper-bg` | `#F5F1E3` | `body`, `.game-body` background |
| `--paper-grid` | `#E2DCC8` | Graph-grid lines (CSS `linear-gradient` background) |
| `--paper-margin` | `#D9CFC0` | Optional left page-margin strip |
| `--paper-white` | `#FFFDF5` | Empty tiles, modals, raised surfaces |
| `--ink-dark` | `#2E2825` | Outlines, primary text, tile borders |
| `--ink-mid` | `#5A524A` | Secondary text, inactive icons |
| `--accent-amber` | `#E8B548` | Primary buttons |

### Element tile fills

| Token | Value | Uses |
|-------|-------|------|
| `--card-red` | `#E65032` | Red/Fire tile fill |
| `--card-blue` | `#4DA8E8` | Blue/Water tile fill |
| `--card-green` | `#65B56A` | Green/Earth tile fill |
| `--card-yellow` | `#F1CC5A` | Yellow/Air tile fill |
| `--card-wild` | `#594A86` | Wild tile fill |
| `--card-cataclysm` | `#7A2E2E` | `+20` cataclysm ground |

### Card dimensions (keep current mobile-first sizes)

```css
--card-width: 68px;
--card-height: 100px;
--card-radius: 10px;
--card-border: 3px solid var(--ink-dark);
```

### Typography

Load in both `index.html` and `game.html`:

```html
<link href="https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Comic+Neue:wght@400;700&family=Patrick+Hand&display=swap" rel="stylesheet">
```

Update `--font-family` and add display fonts:

```css
--font-display: 'Amatic SC', cursive;
--font-tile: 'Patrick Hand', cursive;
--font-body: 'Comic Neue', system-ui, sans-serif;
```

### Shadows

Replace iOS drop shadows with a single small offset “sketch” shadow:

```css
--shadow-tile: 3px 3px 0 var(--ink-dark);   /* hard ink offset */
--shadow-paper: 2px 2px 0 rgba(46,40,37,0.12);
```

Remove or restyle `backdrop-filter` where present; theme prefers flat paper panels.

---

## 3. Global layout changes

### `body` / `.container` (lobby)

- Background: graph-paper grid using `repeating-linear-gradient` on `--paper-bg` with `--paper-grid` lines.
- `.container`: paper-white rounded rectangle with 3 px ink border and a small torn-paper edge effect (optional CSS clip-path).
- No box-shadow; use `--shadow-paper` or a 4 px ink offset.

### `.game-body`

- Replace green felt with graph-paper background.
- Remove `background: var(--board-felt-texture)` entirely.
- Add optional left margin rule with binder-hole circles (pseudo-elements).

---

## 4. Card system rewrite

The card renderer lives in `public/game-client.ts` (`createCardElement`, `renderTopCard`) and styles in `public/styles.css` (`.card`, `.card-back`, color classes).

### 4.1 Card DOM structure

Change from glyph-based text to an **icon + value + label** layout:

```html
<div class="card red number">
  <span class="card-corner card-corner-tl">
    <span class="corner-value">5</span>
    <svg class="corner-icon">…fire…</svg>
  </span>
  <div class="card-face">
    <svg class="card-icon">…fire…</svg>
    <span class="card-value">5</span>
  </div>
  <span class="card-corner card-corner-br">…inverted…</span>
  <span class="card-label">RED</span>
</div>
```

Use CSS `transform: rotate(180deg)` for the bottom-right corner instead of duplicating content.

### 4.2 Card classes

Keep the per-color classes (`.red`, `.blue`, `.green`, `.yellow`, `.wild`) but change their rules:

- `background: var(--card-*)`
- `border: 3px solid var(--ink-dark)`
- `color: var(--ink-dark)` (text always dark ink; white text only on cataclysm `+20`)
- Remove gradients, text shadows, glows.

Add type modifier classes (`.number`, `.plus2`, `.plus4`, `.plus20`, `.skip`, `.reverse`, `.swap`, `.nope`, `.rotate`, `.steal`, `.luckyhand`, `.godmode`, `.wildcard`) so special-card iconography can be targeted.

### 4.3 Card back (`.card-back`)

Replace blue gradient with:

- `--paper-white` fill
- 3 px `--ink-dark` border
- Center doodle icon: a question mark or four tiny interlocked elemental symbols.

Update the flying-card stack (`fx-hand-stack`) to match the new card-back style.

### 4.4 SVG icon asset list

Create `public/icons/` or inline SVG strings in a new `public/card-icons.ts`. Each icon should be a simple hand-drawn doodle with `--ink-dark` strokes and, where noted, a small lighter inner accent.

| Icon ID | Used on | Description |
|---------|---------|-------------|
| `fire` | Red cards | Simple flame with inner lighter orange flicker. |
| `water` | Blue cards | Teardrop / wave with white highlight dot. |
| `leaf` | Green cards | Single jagged leaf with vein line. |
| `swirl` | Yellow cards | Spiral / wind curl. |
| `spark` | Wild / 8 cards | Star-burst / magic element with inner lighter violet accent. |
| `flash-small` | `+2` cards | Tiny lightning / sparkle near value. |
| `flash-big` | `+4` cards | Bigger explosion / reaction burst behind value. |
| `cataclysm` | `+20` cards | Eruption / crackle on `--card-cataclysm` fill. |
| `skip-arrow` | Skip cards | Crossed-out step arrow. |
| `reverse-arrow` | Reverse cards | Circular reverse arrow. |
| `swap-arrows` | Swap cards | Two interlocked arrows. |
| `shield` | Nope cards | Simple hand-drawn shield with slash. |
| `rotate-arrow` | Rotate cards | Circular arrow with seat markers. |
| `steal-mask` | Steal cards | Bandit mask / sneaky eyes. |
| `clover` | Lucky Hand cards | Four-leaf clover. |
| `bolt` | God Mode cards | Zig-zag lightning bolt. |
| `question` | Card backs | Hand-drawn question mark. |

**Decision:** Build icons as SVG strings in `public/card-icons.ts` so `createCardElement()` can import them by name. This avoids external HTTP requests and keeps the theme self-contained.

### 4.5 Number cards

- Large centered number in `--font-tile`.
- Same element icon small in all four corners (top-left, top-right, bottom-left, bottom-right). For size constraints, top-left and bottom-right may be enough per the brief.
- Bottom label: `RED` / `BLUE` / `GREEN` / `YELLOW` in uppercase, hidden when card width < 60 px via media query.

### 4.6 Special-card treatments

| Card | Center | Corner | Label | Tile fill |
|------|--------|--------|-------|-----------|
| `+2` | Big `+2` + small `flash-small` icon | `+2` | — | Element color |
| `+4` | Big `+4` with `flash-big` behind | `+4` | — | Element color |
| `+20` / `+20color` | Big `+20` with `cataclysm` eruption | `+20` | — | `--card-cataclysm`, light text |
| Skip | `⊘` styled as `skip-arrow` | `⊘` | `SKIP` | Element color |
| Reverse | `⇄` styled as `reverse-arrow` | `⇄` | `REV` | Element color |
| Swap | `⇅` styled as `swap-arrows` | `⇅` | `SWAP` | Element color |
| Nope | `🛡` → `shield` icon | `N` | `NOPE` | Element color |
| Rotate | `🔄` → `rotate-arrow` | `R` | `ROT` | Element color |
| Steal | `🦹` → `steal-mask` | `S` | `STEAL` | Element color |
| PickSwap / WildPickSwap | `swap-arrows` | `⇆` | `SWAP` | Element color; WildPickSwap uses `--card-wild` |
| Lucky Hand | `clover` + value badge | `🍀` | `LUCKY` | Element color |
| God Mode | `bolt` + value badge | `⚡` | `GOD` | Element color |
| Wild | `spark` icon + number `8` | `8` | `WILD` | `--card-wild` |

Note: The brief does not include Nope/Rotate/Steal/LuckyHand/GodMode, but the current game has them. Treat them as element-colored reaction/special tiles with doodle icons so the whole deck is consistent.

---

## 5. Game board components

### 5.1 Center workspace

Replace the dark green center with a **paper patch**:

```css
.center-area {
  background: var(--paper-white);
  border: 3px solid var(--ink-dark);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-tile);
}
```

Draw and discard piles sit on this patch.

### 5.2 Draw pile

- `.draw-pile-stack` uses new `.card-back` tiles (paper-white + doodle).
- Optional small hard shadow offset instead of soft shadow.
- Draw button: sketchbook button style (see §6).

### 5.3 Discard pile (`#topCard`)

- Uses new card rendering.
- `discard-pop` animation preserved: scale pop only, no blur/glow.

### 5.4 Pending reaction badge

Replace the red pill with a sketched “!” bubble:

```css
.pending-alert {
  background: var(--paper-white);
  border: 3px solid var(--card-red);
  color: var(--ink-dark);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-tile);
}
```

### 5.5 Direction indicator

Replace circular dark badge with a simple ink circular arrow drawn around/near the discard pile. Keep the `↻` / `↺` glyphs or redraw as SVG arrow, and preserve the `direction-spin` animation.

---

## 6. UI components

### 6.1 Buttons (`.btn`)

- Rounded rectangle (`border-radius: 12px`).
- `border: 3px solid var(--ink-dark)`.
- Flat fill:
  - `.btn-primary`: `--accent-amber`
  - `.btn-secondary`: `--paper-white`
- Hard offset shadow (`box-shadow: 3px 3px 0 var(--ink-dark)`).
- `:active` state: remove offset and translate 2 px down/right to look “pressed into the page.”

### 6.2 Text inputs

- Remove iOS rounded filled input.
- New style: underlined notebook lines.

```css
input[type="text"] {
  background: transparent;
  border: none;
  border-bottom: 3px dashed var(--ink-mid);
  border-radius: 0;
  font-family: var(--font-tile);
  color: var(--ink-dark);
}
input[type="text"]:focus {
  border-bottom-style: solid;
  border-color: var(--ink-dark);
  outline: none;
  box-shadow: none;
}
```

### 6.3 Room code input (`.room-code-input`)

Convert from single underlined input to **four blank boxes** with rough borders:

- Use `display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;`
- Each box: 48–56 px square, `--paper-white` fill, 3 px `--ink-dark` border.
- JS in `index.html` syncs key input across the four cells (or keeps single input visually split with CSS background).

### 6.4 Avatar grid (`.avatar-btn`)

- Square tile buttons with ink border.
- Selected state: thick ink border + small rotation (`transform: rotate(-2deg)`).

### 6.5 Player list / room display

- Replace grouped iOS list with paper-white panel + ink borders.
- `.code-card`: torn-paper strip or dashed border.
- `.host-badge`: amber sketch badge instead of gold pill.

### 6.6 Modals

Replace the dark iOS bottom sheet:

- `.modal-content`: `--paper-white` background, 3 px ink border, torn-paper edge or sticky-note rotation.
- `.modal-overlay`: flat半透明 ink (no `backdrop-filter`).
- Color picker (`.color-btn`): large element tiles (80 × 80 px) with ink border; selected = offset shadow/rotation.
- Winner modal: doodle diploma ribbon + confetti (existing confetti animation works; recolor to element colors).

### 6.7 Loading overlay

- Replace dark blur with paper-white panel centered on graph-paper bg.
- Loading dots become hand-drawn circles or notebook doodles.

---

## 7. Opponents & hand area

### 7.1 Opponent nodes

- Replace dark circular frames with **sketched circle frames**:
  - Thin dashed or 2 px ink border.
  - `--paper-white` fill.
- Current turn indicator: small pencil-cursor SVG or ink-blot badge instead of yellow glow.
- Names and card counts use `--ink-dark` text; drop text-shadow.

### 7.2 Hand area

- Replace dark translucent bar with a **torn-paper strip** at the bottom or a lightly shaded paper panel.
- `.your-turn` state: ink underline or small flag instead of gold border glow.
- Keep fan layout and scroll-layout logic unchanged.

### 7.3 `.playable` / `.unplayable`

- `.playable`: lift on hover (`transform: translateY(-8px) rotate(var(--fan-angle))`), border thickens to 4 px.
- Remove drop-shadow/glow; use offset shadow.
- `.unplayable`: grayscale + opacity 0.5 (already present; keep).

---

## 8. Motion & effects

### Keep from current system

- `card-draw-in` keyframes (translate + scale only).
- `discard-pop` scale pop.
- `direction-spin` rotation.
- `pending-bump` scale.
- Confetti `transform` animation.
- Reduced-motion media query disabling arcs and flashes.

### Update or replace

- Remove `filter: brightness(...)`, `filter: drop-shadow(...)`, `backdrop-filter` from card interactions.
- Replace bright flash effects for special cards (All-Seeing Eye, Big Bang, Reincarnation) with flat paper-compatible tints or ink-colored ring pulses.
- Optional “reaction flash”: quick background-color flash on discard pile using existing CSS classes; do not use `backdrop-filter` or `filter: brightness`.

---

## 9. HTML changes

### `public/index.html`

1. Add Google Fonts link.
2. Update `.logo-badge` to hand-drawn title treatment (or keep emoji “8” with sketch border).
3. Room code input: swap to four-box markup or keep `<input>` with split visual.
4. No script logic changes required unless room-code input markup changes.

### `public/game.html`

1. Add Google Fonts link.
2. Update `#loadingOverlay` markup (optional).
3. Update `.picker-dialog` and modals to match sketchbook style; mostly CSS-driven.
4. Add inline SVG icon sprite or ensure `card-icons.ts` is bundled.

### `public/admin.html`

Apply same paper/button tokens (admin has its own `admin.css`; extend with shared variables or duplicate theme tokens).

---

## 10. TypeScript / JS changes

### `public/game-client.ts`

1. **Refactor `createCardElement` and `renderTopCard`** to use icon helpers instead of glyphs.
   - Import icon map from `card-icons.ts`.
   - Build card DOM with explicit `.card-face` / `.card-corner` / `.card-label` elements.
   - Add type modifier classes to `.card` for CSS targeting.
2. **Ensure plus20 / plus20color share the cataclysm styling** regardless of whether a color is set.
3. **Keep all click handlers, animations, and game-logic integration untouched.**
4. Update `card back` cloning for opponent-play fly-over if the clone class changes.

### New file: `public/card-icons.ts`

- Export a record: `{ fire, water, leaf, swirl, spark, flashSmall, flashBig, cataclysm, skipArrow, reverseArrow, swapArrows, shield, rotateArrow, stealMask, clover, bolt, question }`.
- Each export returns an SVG string. Use `currentColor` for strokes and an optional accent color class.

### `public/haptics.ts`

No changes.

---

## 11. Build / bundling notes

- The project currently loads `dist/game-client.js` from `public/game-client.ts` via Bun bundler.
- Adding `card-icons.ts` is fine; it will be included in the bundle.
- Google Fonts link is external; no build change needed.
- Run `bun run build` after CSS/TS edits.

---

## 12. Phase plan

We work in small, reviewable merges. Each phase is testable in isolation.

### Phase A — Tokens & global shell (1 commit)

- [ ] Replace `:root` tokens in `styles.css` with paper/ink system.
- [ ] Apply graph-paper background to `body` and `.game-body`.
- [ ] Restyle `.container`, `.btn`, and text inputs.
- [ ] Add Google Fonts to both pages.
- [ ] Verify lobby still functions (create/join room).

### Phase B — Card shell & backs (1 commit)

- [ ] Rewrite `.card`, `.card-back`, color classes.
- [ ] Update `.draw-pile-stack`, `.fx-hand-stack` to new card back.
- [ ] Keep card DOM structure compatible with existing JS; icons can be placeholder glyphs for now.
- [ ] Verify draw pile and discard pile render correctly.

### Phase C — Card icons & renderer (1 commit)

- [ ] Create `public/card-icons.ts` with all icon SVGs.
- [ ] Refactor `createCardElement` / `renderTopCard` to emit icon + value + label.
- [ ] Apply cataclysm style to `+20` / `+20color`.
- [ ] Test every card type renders and remains playable.

### Phase D — Game board & HUD (1 commit)

- [ ] Center workspace paper patch.
- [ ] Pending-alert sketch bubble.
- [ ] Direction indicator as ink arrow.
- [ ] Opponent circle frames and hand-area torn-paper strip.
- [ ] Your-turn states with paper-compatible indicators.

### Phase E — Modals & lobby details (1 commit)

- [ ] Modal paper/sticky-note style.
- [ ] Color picker element tiles.
- [ ] Winner diploma + confetti recolor.
- [ ] Room code four-box input (optional; defer if risky).
- [ ] Admin panel theme pass.

### Phase F — Motion polish (1 commit)

- [ ] Remove `filter` / `backdrop-filter` from game interactions.
- [ ] Verify reduced-motion still disables motion.
- [ ] Playtest special-card effects (god mode, lucky hand, etc.) for visual consistency.

---

## 13. Testing checklist

### Visual
- [ ] Lobby renders on iPhone SE / 375 px width without horizontal scroll.
- [ ] All 4 color suits and wild card visible in discard pile and hand.
- [ ] `+20` cataclysm tile is visually distinct.
- [ ] Card labels readable at 60 px width.
- [ ] Playable cards clearly lift on hover/tap.

### Functional
- [ ] Create room → join room → start game still works.
- [ ] Play a number, +2, +4, +20, Skip, Reverse, Swap, Wild, Nope, Rotate, Steal, Lucky Hand, God Mode.
- [ ] Color picker modal opens and closes correctly.
- [ ] Target picker modal opens and closes correctly.
- [ ] Winner modal displays with confetti.

### Performance / accessibility
- [ ] No `backdrop-filter` or `filter: blur` on game board.
- [ ] All special cards distinguishable by icon/text, not color alone.
- [ ] Touch targets ≥ 44 × 44 px (preferably 56 px in hand fan).
- [ ] `prefers-reduced-motion: reduce` disables arcs and flashes.
- [ ] Run existing Playwright tests: `bun test`.

---

## 14. Risks & mitigation

| Risk | Mitigation |
|------|------------|
| SVG icons slow first render | Inline SVG strings in bundle; no external requests. |
| Card text less readable than current glyphs | Keep large numerals; hide labels only below 60 px; test on real phones. |
| Game board feels too busy with graph grid | Keep grid faint (`--paper-grid` at low opacity). |
| Special-card effects clash with paper theme | Phase F dedicated to flattening/removing filter-based effects. |
| Room-code four-box input breaks autofill/paste | Keep hidden `<input>` if needed, or implement robust key handling before merging. |

---

## 15. File touch list

- `public/styles.css` — major rewrite.
- `public/index.html` — fonts, optional room-code input.
- `public/game.html` — fonts, optional markup tweaks.
- `public/admin.html` — fonts (if admin uses theme).
- `public/admin.css` — theme tokens.
- `public/game-client.ts` — card renderer refactor.
- `public/card-icons.ts` — new.
- `package.json` / build scripts — no changes expected.

---

## 16. Open questions to resolve before coding

1. Should icons be full SVG files in `public/icons/` or inline strings in `public/card-icons.ts`?  
   **Recommended:** inline strings in `card-icons.ts` for bundling and theming.
2. Do we keep the legacy `--color-primary`, `--color-success`, etc. tokens for any non-card UI?  
   **Recommended:** map them to paper/ink equivalents or delete them after audit.
3. Should we implement the torn-paper edge on modals in v0, or keep straight borders?  
   **Recommended:** straight borders with slight rotation for sticky-note feel; torn edges optional follow-up.
4. Do we theme the admin panel now or later?  
   **Recommended:** same token pass in Phase E so admin does not look orphaned, but no custom icon work beyond buttons/surfaces.
