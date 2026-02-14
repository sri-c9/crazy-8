# Plan: Integrate ios-haptics for Plus Card Draw Feedback

**STATUS: TENTATIVE** — Implement after Phase 3 (special cards / plus-stacking logic) is complete and the `cardDrawn` message with `cards[]` array is functional.

## Overview

Add haptic feedback on iPhone (iOS 18+) when a player **gets hit** by a plus card and is **forced to draw** (not when they successfully stack/deflect). Uses the `ios-haptics` library which leverages the `<input type="checkbox" switch>` workaround since Safari doesn't support the Vibration API.

## Depends On

- **Phase 3 Complete:** Plus-stacking logic, `cardDrawn` message with `cards[]` array

## Install

```bash
bun add ios-haptics
```

## Integration Point

**File:** `public/game-client.ts`

**Trigger:** When the client receives a `cardDrawn` message where the draw was caused by `pendingDraws > 0` (forced draw from plus stack, not a voluntary single-card draw).

## Haptic Intensity by Plus Interval

| Plus Card Hit | Cards Drawn | Haptic Pattern |
|--------------|-------------|----------------|
| +2 | 2 | `haptic()` — single pulse |
| +4 | 4 | `haptic.confirm()` — two rapid pulses |
| +20 (or stacked combos >= 6) | 6+ | `haptic.error()` — three rapid pulses |

## Implementation

### 1. Haptic Utility Function

Add to `public/game-client.ts` (or a separate `public/haptics.ts` module):

```ts
import { haptic } from "ios-haptics";

function triggerDrawHaptic(cardCount: number) {
  if (cardCount <= 2) {
    haptic();
  } else if (cardCount <= 4) {
    haptic.confirm();
  } else {
    haptic.error(); // +20 or any stacked combo >= 6
  }
}
```

### 2. Wire into cardDrawn Handler

Inside the WebSocket message handler in `public/game-client.ts`:

```ts
case "cardDrawn":
  const cards = msg.cards;
  if (cards.length > 1) {
    // Forced draw from plus stack — trigger haptic
    triggerDrawHaptic(cards.length);
  }
  // ... render cards in hand
  break;
```

## Distinguishing Forced vs Voluntary Draws

**Option A:** Add a `forced: boolean` field to the `cardDrawn` message from the server.

**Option B (Recommended):** Infer from count — if `count > 1`, it was forced. Voluntary draws are always exactly 1 card in the current rules. This requires no server-side changes.

## Build Consideration

Since the frontend is bundled via Bun's bundler (`bun run build`), the `ios-haptics` npm package needs to be importable in the client bundle. Verify that `bun run build` correctly bundles the npm dependency into the browser JS output.

The existing build script:
```bash
bun build public/game-client.ts --outdir public --target browser
```

This should handle npm dependencies automatically since Bun's bundler resolves `node_modules` for browser targets.

## Platform Behavior

| Platform | Behavior |
|----------|----------|
| iOS 18+ (Safari) | Haptic feedback via checkbox switch workaround |
| Android | Falls back to `navigator.vibrate()` automatically |
| Desktop browsers | No-op, no errors thrown |
| iOS < 18 | Silently ignored, no errors |

## Caveats

- **iOS 18+ only** — older iPhones silently get no feedback (no errors thrown)
- **Single haptic weight** — the checkbox hack only produces one tap weight; the "confirm" and "error" patterns are just rapid repeats of the same tap
- **No server changes required** — uses existing `cardDrawn` message data

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `ios-haptics` dependency |
| `public/game-client.ts` | Import `haptic`, add `triggerDrawHaptic()`, call in `cardDrawn` handler |

## Testing & Verification

### Manual Testing Steps

1. **Forced draw haptic (iPhone):**
   - Player A plays +2
   - Player B has no +card, draws 2 cards
   - Verify Player B's phone buzzes (single pulse)

2. **Larger stack haptic:**
   - Stack +2 then +4 = 6 cards pending
   - Player forced to draw 6 cards
   - Verify phone buzzes with error pattern (three rapid pulses)

3. **Voluntary draw — no haptic:**
   - Player draws 1 card voluntarily
   - Verify no haptic feedback

4. **Desktop — no errors:**
   - Play on desktop browser
   - Verify no console errors from haptic calls

5. **Build verification:**
   - Run `bun run build`
   - Verify `ios-haptics` is bundled into the output JS file
   - Verify no build errors

## Success Criteria

- `bun add ios-haptics` installs without issues
- `bun run build` bundles the dependency for browser use
- Forced draws (count > 1) trigger haptic feedback on iOS
- Voluntary draws (count = 1) do not trigger haptics
- Haptic intensity scales with card count (single / confirm / error)
- No errors on non-iOS platforms (graceful no-op)
