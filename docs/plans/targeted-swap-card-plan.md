# Plan: Add Targeted Hand-Swap Card Variants

## Goal
Introduce **two new card types** that let the current player exchange their entire hand with any one opponent of their choice:
1. **Fixed-color targeted swap** (`pickswap`) — colored card that can be played when the color/type matches.
2. **Wild targeted swap** (`wildpickswap`) — wild card that can be played anytime and requires choosing a color.

The existing auto-target `swap` card (swaps with next player) must keep working exactly as before.

---

## Names & Card Identity

| Internal type | Display label | Corner value | Card styling | Requires target? | Requires color choice? |
|---|---|---|---|---|---|
| `pickswap` | `SWAP` | `⇆` | Card color | Yes | No |
| `wildpickswap` | `SWAP` | `⇆` | Wild conic gradient | Yes | Yes |

The UI will show the same symbol for both to make it clear they are swap variants, and the wild version uses the rainbow wild style.

---

## Files to Change

### 1. `cards.ts`
Add the two new card interfaces and include them in the `Card` union.

Update `CARD_DISTRIBUTION` to add the two types and rebalance weights so they still sum to `1.0`. Keep total weight check unchanged.

Suggested weights:

```ts
{ type: "number",       weight: 0.25, ... }, // reduced from 0.29
{ type: "wild",         weight: 0.05, ... },
{ type: "plus2",        weight: 0.09, ... },
{ type: "plus4",        weight: 0.05, ... },
{ type: "plus20",       weight: 0.15, ... },
{ type: "plus20color",  weight: 0.15, ... },
{ type: "skip",         weight: 0.05, ... },
{ type: "reverse",      weight: 0.04, ... },
{ type: "swap",         weight: 0.02, ... }, // existing auto-target
{ type: "pickswap",     weight: 0.02, ... }, // NEW
{ type: "wildpickswap", weight: 0.02, ... }, // NEW
{ type: "nope",         weight: 0.05, ... },
{ type: "rotate",       weight: 0.04, ... },
{ type: "steal",        weight: 0.02, ... },
```

---

### 2. `game-logic.ts`

#### `canPlayCard`
- `wildpickswap` is always playable (like `plus4`/`wild`).
- `pickswap` is playable:
  - if the card color matches the current target color, **or**
  - if the top card is also a `pickswap` (type match), **or**
  - as part of normal special-card color matching.

Add `pickswap` to the `typeMatchable` list; add `wildpickswap` to the always-playable list.

#### `startGame`
Exclude both new types from the starting top card so a swap-target-prompt is not required before the first play.

#### `playCard`
Change signature to accept `targetPlayerId?: string`:

```ts
export function playCard(
  room: Room,
  playerId: string,
  cardIndex: number,
  chosenColor?: CardColor,
  targetPlayerId?: string,
): void
```

After removing the card from the player's hand and adding it to the discard pile:

1. If `card.type === "pickswap"` or `card.type === "wildpickswap"`:
   - Validate `targetPlayerId` is present, is not the current player, and exists in the room. Throw descriptive errors.
   - Swap `player.hand` with `targetPlayer.hand`.
2. Keep the existing `swap` logic untouched — it swaps with the next player by direction.

#### Last-played color
- `pickswap`: set `room.lastPlayedColor = card.color` (already handled by `"color" in card`).
- `wildpickswap`: require `chosenColor` and set `room.lastPlayedColor = chosenColor` in the same block as `wild`/`plus4`/`plus20`.

---

### 3. `server.ts`

#### Message protocol
Update `IncomingMessage` to include:

```ts
targetPlayerId?: string;
```

#### Validation in `handlePlayCard`
- After reading the card from the player's hand, determine whether it needs a target.
- `pickswap`: if `msg.targetPlayerId` is missing, invalid format, equal to the player, or not in the room → send a clear error and return.
- `wildpickswap`: validate both `targetPlayerId` and `chosenColor`.
- `swap`: keep the existing next-player behavior.

The effect-notification block already uses `swapTargetId`, so just set it for the new cards as well; no new broadcast code is needed.

#### Safe error messages
Add these patterns to `safeErrorMessage` so the client sees useful errors:
- `Must choose a player to swap with`
- `Cannot swap with yourself`
- `Target player not found`

---

### 4. `public/game-client.ts`

#### Card rendering
In both `createCardElement` and `renderTopCard`, add cases for `pickswap` and `wildpickswap`:
- `content`: `<span class="card-value">⇆</span><span class="card-type">SWAP</span>`
- `cornerValue`: `⇆`
- Color class for `wildpickswap` is `wild`; for `pickswap` it uses `card.color`.

#### Playability (`canPlayCardClient`)
- `wildpickswap` always playable.
- Add `pickswap` to the `typeMatchable` list and color matching.

#### Target selection flow
Add state: `pendingTargetCardIndex`, `pendingTargetCardEl`, and `pendingTargetCardType`.

In `handleCardClick`:
- If card type is `pickswap` or `wildpickswap`, open a **target picker modal** (list of opponents) **before** sending.
- If it is `wildpickswap`, after picking a target, open the existing **color picker**; use the selected target when sending.
- Animate the card after choices are made.

#### `playCard` function
Accept an options object:

```ts
function playCard(options: { index: number; chosenColor?: string; targetPlayerId?: string }) { ... }
```

Send `action: "play"` with `cardIndex`, `chosenColor`, and `targetPlayerId`.

#### Target picker modal
Add `showTargetPicker()` and `hideTargetPicker()` helpers. Render opponent avatars/names as clickable rows. Hide if an opponent disconnects or game is over.

#### Effects
Existing `swapped` / `youSwapped` card effect messages cover the new variants, so no new effect handlers are required.

---

### 5. `public/game.html`

Add a target-picker modal after the color picker modal:

```html
<!-- Target Player Picker Modal -->
<div id="targetPicker" class="modal hidden">
  <div class="modal-overlay" id="targetPickerOverlay"></div>
  <div class="modal-content target-picker-content">
    <h3>Choose a player to swap hands with:</h3>
    <div id="targetList" class="target-list"></div>
  </div>
</div>
```

---

### 6. `public/styles.css`

Add minimal styles for the target list so each opponent row is a clickable touch target:

```css
.target-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-5);
}

.target-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--duration-fast);
}

.target-row:hover {
  background: rgba(0, 122, 255, 0.1);
}

.target-row .target-avatar {
  font-size: 24px;
}

.target-row .target-name {
  font-weight: var(--font-weight-medium);
}
```

---

### 7. `tests/unit/game-logic.test.ts`

Update tests that enumerate valid types to include `pickswap` and `wildpickswap`:
- `generateCard always returns a valid card type`
- `valid card types include new special cards`
- `startGame` initial-top-card exclusion list

Add helpers:

```ts
const pickswap = (color: CardColor): Card => ({ type: "pickswap", color });
const wildpickswap = (): Card => ({ type: "wildpickswap" });
```

Add a new describe block, e.g. `Rule 14: Targeted swap cards`:

1. `pickswap` requires a target player ID.
2. `pickswap` rejects targeting self.
3. `pickswap` rejects targeting a missing player.
4. `wildpickswap` requires both a target and a chosen color.
5. `pickswap` swaps hands with the chosen target.
6. `wildpickswap` swaps hands with the chosen target and sets `lastPlayedColor`.
7. `pickswap` is not playable without a color/type match (if target top is plain red, blue pickswap is unplayable).
8. `wildpickswap` is always playable regardless of top card.

---

## Verification Steps

Run these after implementation:

```bash
# Type-check server and frontend source
bunx tsc --noEmit

# Build browser bundles
bun run build

# Run unit tests
bun test

# Optionally run Playwright smoke tests
bun test:ui   # or bun test
```

---

## Open Questions / Decisions

1. **Playability rule for `pickswap`:** Proposed to require color/type match like other colored specials. If the user intended fixed-color swaps to be always playable (like the existing auto `swap`), move `pickswap` into the always-playable list instead.
2. **Weights:** The weights above are a starting suggestion; tweak them if the new cards feel too frequent.
3. **Symbols/labels:** Using `⇆` and `SWAP`. If this is too similar to the existing `swap` (`⇅`/`SWAP`), consider labels like `PICK` or `SWITCH`.
