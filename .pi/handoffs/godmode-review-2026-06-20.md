# God Mode Card Logic Review — Handoff

## Context
Reviewed the new **God Mode card** logic in `cards.ts`, `game-logic.ts`, `room-manager.ts`, and `server.ts` for bugs. The feature adds two colored special cards (`luckyhand` and `godmode`) and three God Mode powers: `allSeeingEye`, `bigBang`, `reincarnation`.

## Files Examined
- `/Users/sri/Developer/projs/web-apps/crazy-8/cards.ts` — card type definitions, distribution, `generateBoostedCard`
- `/Users/sri/Developer/projs/web-apps/crazy-8/game-logic.ts` — `canPlayCard`, `startGame`, `playCard`, `drawCard`, God Mode helpers
- `/Users/sri/Developer/projs/web-apps/crazy-8/room-manager.ts` — state fields `luckyDrawPlayerId`, `revealHandsOwnerId`
- `/Users/sri/Developer/projs/web-apps/crazy-8/server.ts` — `godPower` routing/validation/broadcasts
- `/Users/sri/Developer/projs/web-apps/crazy-8/tests/unit/god-mode.test.ts`
- `/Users/sri/Developer/projs/web-apps/crazy-8/tests/unit/god-cards-matching.test.ts`
- `/Users/sri/Developer/projs/web-apps/crazy-8/tests/unit/lucky-hand.test.ts`
- `/Users/sri/Developer/projs/web-apps/crazy-8/tests/unit/game-logic.test.ts`

## Tests Run
- `bun test tests/unit/god-mode.test.ts tests/unit/god-cards-matching.test.ts tests/unit/cards.test.ts` — PASSED (16/16)
- `bun test tests/unit/` — full suite initially PASSED (154/154)

## Bug Found & Fixed

### Issue: Partial state mutation on invalid `godPower`
**Location:** `game-logic.ts` `playCard` (around lines 238–341)

When `playCard` was called for a `godmode` card with a missing or invalid `godPower`, the function removed the card from the player's hand and placed it on the discard pile *before* validating the power, then threw. This left the game in a corrupted state (card lost, discard mutated, turn not advanced).

**Verification script** (`/tmp/godmode-mutation-test.ts`) confirmed:
```
Before play: p0 hand length: 2, discard: number
Threw: Must choose a God Mode power
After play:  p0 hand length: 1, discard: godmode
```

The server validates `godPower` before calling `playCard`, so this was not reachable in production, but the logic function itself was not atomic.

### Fix Applied
Added a pre-mutation validation block in `game-logic.ts` after `canPlayCard` and before `player.hand.splice`. The same pattern was also present for wild/plus cards requiring `chosenColor` and for `pickswap`/`wildpickswap` requiring a target, so those presence/validation checks were also moved up. The later redundant throws were removed.

### Resulting Test Failures
Two existing tests in `tests/unit/game-logic.test.ts` were intentionally documenting the buggy partial-mutation behavior:

1. `Rule 4: wild color enforcement > [BUG] wild thrown after removal: card already gone from hand + discard mutated`
   - Old expectation: hand length 1, top card `plus4`, `pendingDraws` 4.
   - New behavior: no mutation, so these expectations fail.

2. `Rule 14: targeted swap cards > wildpickswap requires both a target and a chosen color`
   - First assertion `expect(...).toThrow("Must choose a player to swap with")` now throws `"Must choose a color"` first because color validation now runs before target validation for `wildpickswap` (a colorless wild-pickswap requires both, and color is checked first in the new ordering).

These tests need to be updated to assert the new, correct atomic behavior.

## Other Observations (Not Fixed)

1. **All-Seeing Eye duration semantics**
   - Implemented as "clear when the owner takes their next action" (`drawCard`/`playCard` both clear `revealHandsOwnerId` if it equals the acting player).
   - The tests name this "one lap", but with Skip/Reverse effects the owner's next action may not line up with an intuitive "full round". This is a design nuance, not a crash/bug.

2. **Skip card advance bug (unrelated to God Mode)**
   - `game-logic.ts` advances Skip by `3 * direction` positions instead of `2`.
   - This is already documented in `tests/unit/game-logic.test.ts` under "Rule 3" with `[ACTUAL]` tests.
   - It can affect All-Seeing Eye timing if a Skip skips the reveal owner.

3. **No other God Mode logic bugs found**
   - Color-match only works correctly.
   - `startGame` excludes `luckyhand`/`godmode` from opening discard and resets flags.
   - `Big Bang` preserves hand sizes and total card count.
   - `Reincarnation` deals exactly 7 cards to everyone.
   - All-Seeing Eye correctly sets/clears `revealHandsOwnerId`.

## Remaining Tasks
- Update the two failing tests in `tests/unit/game-logic.test.ts` to reflect the corrected atomic behavior:
  - Rename/remove the `[BUG]` test and assert that state remains unchanged after a validation throw.
  - Adjust the `wildpickswap` test to expect the new validation order (or reorder validation so target is checked before color if that ordering matters).
- Re-run `bun test tests/unit/` to confirm full green suite.
- Optionally add a God Mode-specific unit test asserting no hand/discard mutation when `godPower` is missing/invalid.
