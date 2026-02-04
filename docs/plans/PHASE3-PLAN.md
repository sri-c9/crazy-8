# Phase 3: Special Cards — Technical Plan

**STATUS: TENTATIVE** — This plan will be refined when Phase 3 begins.

## Goal

Implement "Insane" rule variants for special cards: plus-stacking (any +card deflects to next player), skip behavior (skip 2 players), reverse with 4-card stack limit, and proper win condition with special card interrupts.

## Depends On

- **Phase 2 Complete:** Basic game logic, turn order, card play validation, drawing

## Files to Modify

### 1. `game-logic.js` — Special Card Logic (MODIFY)

**New/Modified Functions:**

- `canPlayCard(card: Card, topCard: Card, room: Room) → boolean`
  - **NEW RULE:** If `room.pendingDraws > 0`, only +cards can be played (deflection)
  - Any +card (+2, +4, +20) can be played on any +card (ignore color matching)
  - Regular matching rules apply otherwise

- `playCard(room: Room, playerId: string, cardIndex: number, chosenColor?: string) → { skipCount: number, reverseApplied: boolean }`
  - **Plus cards (+2, +4, +20):**
    - If previous card was also a +card, add to `pendingDraws` (stacking)
    - If NOT stacking, next player must draw or stack with another +card
    - +2 adds 2, +4 adds 4, +20 adds 20

  - **Skip cards:**
    - Skips next 2 players (not 1)
    - Advances turn by 3 total (current → +3)

  - **Reverse cards:**
    - Flips `direction` (1 → -1 or -1 → 1)
    - Increment `reverseStackCount`
    - If `reverseStackCount` reaches 4, reset to 0 and prevent further stacking
    - Max 4 reverses in a row, then normal play resumes

  - Returns metadata about skip/reverse effects for broadcasting

- `drawCard(room: Room, playerId: string) → Card[]`
  - **CHANGE RETURN TYPE:** Returns array of cards (for multi-draw)
  - If `room.pendingDraws > 0`:
    - Draw that many cards
    - Reset `pendingDraws` to 0
    - Advance turn
  - Otherwise, draw 1 card and advance turn

- `resolvePendingDraws(room: Room, playerId: string) → void`
  - Called when player can't/won't stack +cards
  - Forces draw of `pendingDraws` cards
  - Resets `pendingDraws` to 0
  - Advances turn

**Room State Changes:**
```js
{
  // ... existing fields
  pendingDraws: number,        // Accumulated +card draws (0 if none pending)
  reverseStackCount: number,   // Count of consecutive reverses (max 4)
  lastSpecialCard: string | null  // "plus" | "reverse" | null (for UI hints)
}
```

### 2. `server.js` — Special Card Broadcasting (MODIFY)

**Enhanced Game State Messages:**

Include special card context in state broadcasts:
- `pendingDraws` (so UI can show "+X cards pending")
- `reverseStackCount` (so UI can show "X/4 reverses")
- `lastSpecialCard` (for animations/effects in Phase 6)

**New Direct Message:**

When player is forced to draw multiple cards:
```json
{
  "type": "forcedDraw",
  "cards": [...],
  "reason": "Plus-stack resolved: drew 8 cards"
}
```

### 3. `public/index.html` — Special Card Indicators (MODIFY)

**New UI Elements:**
- Pending draws indicator: "⚠️ +8 cards pending — play a +card or draw!"
- Reverse stack counter: "🔄 3/4 reverses"
- Skip announcement: "⏭️ Skipped 2 players"

**JavaScript Updates:**
- Display pending draws warning
- Highlight +cards in hand when `pendingDraws > 0`
- Show skip/reverse effects in action log

## WebSocket Protocol Changes

### Server → Client (MODIFIED)

**Enhanced Game State:**
```json
{
  "type": "state",
  "gameState": {
    "currentPlayerId": "p_abc123",
    "topCard": { "type": "plus2", "color": "red" },
    "lastPlayedColor": "red",
    "direction": -1,  // counter-clockwise
    "pendingDraws": 8,  // 8 cards pending
    "reverseStackCount": 2,  // 2 reverses in a row
    "players": [...],
    "winner": null
  },
  "yourPlayerId": "p_abc123"
}
```

**Special Card Effect (broadcast):**
```json
{
  "type": "specialEffect",
  "effect": "skip",  // or "reverse", "plusStack"
  "playerId": "p_abc123",
  "data": { "skipCount": 2 }  // or { "reverseCount": 3 }, { "totalDraws": 8 }
}
```

## Key Design Decisions

### Plus-Stacking Rules ("Insane" Variant)

**ANY +card stacks on ANY +card**, regardless of color:
- +2 on +20 = 22 cards pending
- +4 on +2 = 6 cards pending
- +20 on +4 = 24 cards pending

**Stacking ends when:**
1. Player can't play a +card (must draw all pending)
2. Player chooses to draw instead of stacking

**Implementation:**
- When `pendingDraws > 0`, validate that played card is a +card
- Add card's draw value to accumulator
- If next player draws, resolve entire stack

### Reverse Stack Limit (4 Cards)

After 4 consecutive reverses:
- Reset `reverseStackCount` to 0
- Further reverses are NOT allowed until a non-reverse card is played
- Prevents infinite reverse loops

**Example:**
1. Player A plays reverse (count = 1, direction flips)
2. Player B plays reverse (count = 2, direction flips back)
3. Player C plays reverse (count = 3, direction flips)
4. Player D plays reverse (count = 4, direction flips)
5. Next player CANNOT play reverse (must play different card or draw)

### Skip Behavior (Skip 2 Players)

Unlike standard Crazy 8s (skip 1), this variant skips 2 players:
- Current player index: 0
- Plays skip card
- Turn advances to index 3 (skips 1 and 2)

**Wrap-around handling:**
```js
currentPlayerIndex = (currentPlayerIndex + 3) % playerCount;
```

## Implementation Order

1. **`game-logic.js` — Plus-stacking logic**
   - Modify `canPlayCard()` to allow any +card when `pendingDraws > 0`
   - Update `playCard()` to accumulate `pendingDraws`
   - Update `drawCard()` to handle multi-card draws

2. **`game-logic.js` — Reverse stack limit**
   - Track `reverseStackCount` in room state
   - Increment on reverse play
   - Reset after 4 or when non-reverse played
   - Validate max 4 limit in `canPlayCard()`

3. **`game-logic.js` — Skip 2 players**
   - Modify turn advancement in `playCard()` for skip cards
   - Advance by 3 instead of 1

4. **`server.js` — Enhanced state broadcasting**
   - Include `pendingDraws` and `reverseStackCount` in state messages
   - Send special effect announcements

5. **`public/index.html` — Special card UI indicators**
   - Display pending draws warning
   - Show reverse stack progress
   - Highlight stackable cards in hand

## Testing & Verification

### Manual Testing Steps

1. **Plus-stacking:**
   - Player A plays +2
   - Player B plays +4 on it → 6 cards pending
   - Player C plays +20 on it → 26 cards pending
   - Player D has no +card, draws all 26 cards
   - Verify hand size increased by 26
   - Verify `pendingDraws` reset to 0
   - Verify turn advanced to Player E

2. **Cross-color stacking:**
   - Red +2 on table
   - Play blue +4 (different color)
   - Verify stack allowed (ignore color matching for +cards)

3. **Reverse stack limit:**
   - Players play 4 consecutive reverses
   - Verify 5th player cannot play another reverse
   - Must play different card or draw
   - After non-reverse played, reverse is allowed again

4. **Skip 2 players:**
   - 5 players: A, B, C, D, E
   - Player A (index 0) plays skip
   - Verify turn goes to Player D (index 3)
   - Players B and C are skipped

5. **Skip with wrap-around:**
   - 4 players: A, B, C, D
   - Player C (index 2) plays skip
   - Turn advances by 3: (2 + 3) % 4 = 1
   - Verify turn goes to Player B (wraps around)

### Edge Cases to Test

- +20 stacked multiple times (50+ cards)
- Reverse during 2-player game (ping-pong effect)
- Skip in 3-player game (skips 2 = back to original player after full rotation)
- Draw when `pendingDraws = 0` vs. `pendingDraws > 0`

## Success Criteria

- ✅ Any +card can stack on any +card (ignore color)
- ✅ Accumulated draws resolve when player can't stack
- ✅ Reverse flips direction and increments counter
- ✅ 4 consecutive reverses hit the limit
- ✅ 5th reverse is blocked until non-reverse played
- ✅ Skip cards skip 2 players (advance by 3)
- ✅ Special card effects broadcast to all players
- ✅ UI shows pending draws and reverse stack count
- ✅ Multi-card draws work correctly (e.g., draw 20 cards)

## What's NOT in Phase 3

- Polished UI/animations for special effects
- Mobile-optimized layout
- Sound effects
- Card play animations
- Timer for turns
- Reconnection logic during special card resolution

These come in later phases. Phase 3 focuses purely on the special card game rules.
