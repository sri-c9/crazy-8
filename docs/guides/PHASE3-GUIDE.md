# Phase 3: Learning Guide — Special Cards

Welcome to Phase 3! You've got a working card game. Now it's time to make it "Insane" by adding the special card rules: plus-stacking, skip 2 players, and reverse limits.

## Before You Start

**Prerequisites:**
- Phase 2 complete (basic game working with TypeScript)
- Cards can be played and drawn
- Turn order functioning

**What You'll Build:**
- Plus-card stacking (any +card on any +card)
- Skip cards that skip 2 players
- Reverse cards with 4-stack limit
- Enhanced game state for special effects

**Key Concept:**
The "Insane" variant lets ANY +card (+2, +4, +20) stack on ANY +card, regardless of color. This creates wild moments where draws can stack to 50+ cards!

---

## Step 1: Add Special Card Generation

**Goal:** Extend `generateCard()` to include special cards.

### 1.1: Update Card Pool

Currently you only generate number and wild cards. Add:
- +2 cards (4 colors)
- +4 cards (no color)
- +20 cards (no color)
- Skip cards (4 colors)
- Reverse cards (4 colors)

**Distribution:**
- Numbers (0-7, 9): 32 options (keep this)
- Wild: 1 option
- +2: 4 options (one per color)
- +4: 1 option
- +20: 1 option
- Skip: 4 options
- Reverse: 4 options
- **Total: 47 options**

<details>
<summary>💡 Hint: Extended generateCard()</summary>

```ts
const COLORS: CardColor[] = ["red", "blue", "green", "yellow"];

export function generateCard(): Card {
  const random = Math.floor(Math.random() * 47);

  if (random < 32) {
    // Number cards (0-7, 9)
    const colorIndex = Math.floor(random / 8);
    const valueIndex = random % 8;
    const NUMBER_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 9];

    return {
      type: "number",
      color: COLORS[colorIndex],
      value: NUMBER_VALUES[valueIndex]
    } as NumberCard;
  } else if (random < 33) {
    // Wild
    return { type: "wild", chosenColor: null } as WildCard;
  } else if (random < 37) {
    // +2 (4 colors)
    return { type: "plus2", color: COLORS[random - 33] } as Plus2Card;
  } else if (random === 37) {
    // +4
    return { type: "plus4" } as Plus4Card;
  } else if (random === 38) {
    // +20
    return { type: "plus20" } as Plus20Card;
  } else if (random < 43) {
    // Skip (4 colors)
    return { type: "skip", color: COLORS[random - 39] } as SkipCard;
  } else {
    // Reverse (4 colors)
    return { type: "reverse", color: COLORS[random - 43] } as ReverseCard;
  }
}
```
</details>

**Test it:**
```ts
// Generate 20 cards, see variety
for (let i = 0; i < 20; i++) {
  console.log(generateCard());
}
```

---

## Step 2: Plus-Card Stacking Logic

**Goal:** Allow +cards to stack and accumulate draws.

### 2.1: Add `pendingDraws` to Room State

In `room-manager.ts`, add to room object:
```ts
// Update Room interface:
interface Room {
  // ... existing fields
  pendingDraws: number;        // Accumulated +card draws
  reverseStackCount: number;   // Add this now for Phase 3 Step 4
}

// In createRoom():
const room: Room = {
  // ... existing fields
  pendingDraws: 0,
  reverseStackCount: 0
};
```

### 2.2: Update `canPlayCard` for Stacking

When `pendingDraws > 0`, only +cards can be played:

<details>
<summary>💡 Hint: Stacking validation</summary>

```ts
export function isPlusCard(card: Card): boolean {
  return card.type === "plus2" || card.type === "plus4" || card.type === "plus20";
}

export function canPlayCard(card: Card, topCard: Card, room: Room): boolean {
  // If draws are pending, MUST play a +card (or draw them all)
  if (room.pendingDraws > 0) {
    return isPlusCard(card);
  }

  // Wild always playable
  if (card.type === "wild") {
    return true;
  }

  // For +cards stacking on +cards, ignore color
  if (isPlusCard(card) && isPlusCard(topCard)) {
    return true;
  }

  // Get target color
  const targetColor = topCard.type === "wild" ? room.lastPlayedColor : ("color" in topCard ? topCard.color : null);

  // Number cards: match color OR value
  if (card.type === "number" && topCard.type === "number") {
    return card.color === targetColor || card.value === topCard.value;
  }

  // Match color for special cards
  return "color" in card && card.color === targetColor;
}
```
</details>

### 2.3: Update `playCard` for Plus-Stacking

When a +card is played:
- Add to `pendingDraws` (don't reset it)
- Next player must play a +card OR draw all pending

<details>
<summary>💡 Hint: Plus-card logic in playCard</summary>

```ts
// After validating and removing card from hand...

// Handle +cards
if (card.type === "plus2") {
  room.pendingDraws += 2;
} else if (card.type === "plus4") {
  room.pendingDraws += 4;
} else if (card.type === "plus20") {
  room.pendingDraws += 20;
}

// ... rest of playCard logic
```
</details>

### 2.4: Update `drawCard` for Multi-Draw

When player draws and `pendingDraws > 0`, draw all of them:

<details>
<summary>💡 Hint: Multi-draw logic</summary>

```ts
export function drawCard(room: Room, playerId: string): Card[] {
  if (getCurrentPlayer(room) !== playerId) {
    throw new Error("Not your turn");
  }

  const hand = room.playerHands.get(playerId);
  if (!hand) {
    throw new Error("Player has no hand");
  }

  let drawnCards: Card[] = [];

  if (room.pendingDraws > 0) {
    // Draw all pending cards
    for (let i = 0; i < room.pendingDraws; i++) {
      const card = generateCard();
      hand.push(card);
      drawnCards.push(card);
    }
    room.pendingDraws = 0;
  } else {
    // Normal draw (1 card)
    const card = generateCard();
    hand.push(card);
    drawnCards.push(card);
  }

  advanceTurn(room);

  return drawnCards; // Return array now
}
```
</details>

**Test plus-stacking:**
Create a scenario where:
1. Player A plays +2 (pendingDraws = 2)
2. Player B plays +4 (pendingDraws = 6)
3. Player C plays +20 (pendingDraws = 26)
4. Player D has no +card, draws 26 cards
5. Verify pendingDraws resets to 0

---

## Step 3: Skip Logic (Skip 2 Players)

**Goal:** Make skip cards advance turn by 3 (current + skip 2).

### 3.1: Modify `playCard` for Skip

After playing a skip card, advance turn by 3 instead of 1:

<details>
<summary>💡 Hint: Skip advancement</summary>

```js
// In playCard, after adding card to discard pile...

// Handle skip
if (card.type === "skip") {
  // Skip 2 players = advance by 3
  advanceTurn(room);
  advanceTurn(room);
}

// Regular turn advance
advanceTurn(room);
```
</details>

**Wait, that's wrong!** We're calling `advanceTurn` multiple times. Better approach:

<details>
<summary>💡 Better Hint: Skip with custom advancement</summary>

```ts
// In playCard, BEFORE the final advanceTurn...

let skipCount = 0;
if (card.type === "skip") {
  skipCount = 2; // Skip 2 players
}

// ... win condition check ...

// Advance turn (1 + skipCount)
for (let i = 0; i <= skipCount; i++) {
  advanceTurn(room);
}
```
</details>

**Test skip:**
- 4 players: A, B, C, D
- Player A (index 0) plays skip
- Turn should go to Player D (index 3)

---

## Step 4: Reverse with Stack Limit

**Goal:** Reverse flips direction, max 4 in a row.

### 4.1: Add `reverseStackCount` to Room State

Already added in Step 2.1 above.

### 4.2: Update `canPlayCard` for Reverse Limit

If `reverseStackCount >= 4`, reverse cards can't be played:

<details>
<summary>💡 Hint: Reverse limit validation</summary>

```ts
// In canPlayCard, add check:
if (card.type === "reverse" && room.reverseStackCount >= 4) {
  return false; // Max 4 reverses hit
}
```
</details>

### 4.3: Update `playCard` for Reverse

When reverse played:
1. Flip direction (1 → -1 or -1 → 1)
2. Increment `reverseStackCount`
3. If count hits 4, block further reverses until non-reverse played

When NON-reverse played:
- Reset `reverseStackCount` to 0

<details>
<summary>💡 Hint: Reverse logic</summary>

```ts
// In playCard, after adding to discard pile...

if (card.type === "reverse") {
  room.direction *= -1 as 1 | -1; // Flip direction
  room.reverseStackCount++;
} else {
  // Reset reverse counter when non-reverse played
  room.reverseStackCount = 0;
}
```
</details>

**Test reverse:**
1. Player A plays reverse (direction = -1, count = 1)
2. Player D (counter-clockwise) plays reverse (direction = 1, count = 2)
3. Player A plays reverse (direction = -1, count = 3)
4. Player D plays reverse (direction = 1, count = 4)
5. Player A **cannot** play reverse (blocked)
6. Player A plays number card (count resets to 0)

---

## Step 5: Update Server Broadcasts

**Goal:** Include special card state in game broadcasts.

### 5.1: Add Fields to Game State

In `broadcastGameState`, include:
- `pendingDraws`
- `reverseStackCount`
- `direction`

<details>
<summary>💡 Hint: Enhanced state broadcast</summary>

```ts
const state = {
  type: "state",
  gameState: {
    currentPlayerId,
    topCard,
    lastPlayedColor: room.lastPlayedColor,
    direction: room.direction,
    pendingDraws: room.pendingDraws,
    reverseStackCount: room.reverseStackCount,
    players: [/* ... */],
    winner: room.winnerId || null
  },
  yourPlayerId: playerId
};
```
</details>

### 5.2: Update `handleDraw` to Send Multiple Cards

Since `drawCard` now returns an array:

```ts
function handleDraw(ws: ServerWebSocket<WebSocketData>, msg: IncomingMessage) {
  try {
    if (!ws.data.roomCode || !ws.data.playerId) {
      throw new Error("Not in a room");
    }

    const room = getRoom(ws.data.roomCode);
    if (!room) throw new Error("Room not found");

    const cards = drawCard(room, ws.data.playerId);

    ws.send(JSON.stringify({
      type: "cardDrawn",
      cards, // Array now
      count: cards.length
    }));

    broadcastGameState(ws.data.roomCode);
  } catch (error) {
    ws.send(JSON.stringify({ type: "error", message: (error as Error).message }));
  }
}
```

---

## Utility Functions (Shared Client/Server)

You may want to export helper functions that can be used both server-side and client-side:

```ts
// In game-logic.ts

export function cardToString(card: Card): string {
  switch (card.type) {
    case "number":
      return `${card.color} ${card.value}`;
    case "wild":
      return card.chosenColor ? `Wild (${card.chosenColor})` : "Wild";
    case "plus2":
      return `${card.color} +2`;
    case "plus4":
      return "+4";
    case "plus20":
      return "+20";
    case "skip":
      return `${card.color} Skip`;
    case "reverse":
      return `${card.color} Reverse`;
    default:
      return "Unknown";
  }
}
```

---

## Final Checkpoint: Test Special Cards

**Goal:** Display pending draws and reverse info.

### 6.1: Add UI Elements

In `index.html`, add:

```html
<div id="special-alerts"></div>
```

### 6.2: Show Pending Draws Alert

In `renderGameState`:

```js
function renderGameState(state, yourId) {
  // ... existing code ...

  // Special alerts
  const alertDiv = document.getElementById("special-alerts");
  if (state.pendingDraws > 0) {
    alertDiv.innerHTML = `<p style="color: orange;">⚠️ +${state.pendingDraws} cards pending!</p>`;
  } else {
    alertDiv.innerHTML = "";
  }

  // Reverse counter
  if (state.reverseStackCount > 0) {
    alertDiv.innerHTML += `<p>🔄 Reverses: ${state.reverseStackCount}/4</p>`;
  }

  // Direction indicator
  const directionArrow = state.direction === 1 ? "➡️" : "⬅️";
  document.getElementById("turn-indicator").textContent =
    `${currentPlayer.name}'s turn ${directionArrow}`;

  // ... rest of rendering ...
}
```

### 6.3: Highlight +Cards When Pending

When `pendingDraws > 0`, only +cards should be enabled:

```js
// In renderGameState, when rendering hand buttons:
if (you && you.hand) {
  you.hand.forEach((card, index) => {
    const btn = document.createElement("button");
    btn.textContent = cardToString(card);

    let playable = false;
    if (state.currentPlayerId === yourId) {
      if (state.pendingDraws > 0) {
        // Only +cards playable
        playable = isPlusCard(card);
      } else {
        playable = canPlayCard(card, state.topCard, state.lastPlayedColor);
      }
    }

    btn.disabled = !playable;
    if (playable) btn.style.background = "gold";

    btn.onclick = () => {
      /* ... */
    };

    handDiv.appendChild(btn);
  });
}

function isPlusCard(card) {
  return card.type === "plus2" || card.type === "plus4" || card.type === "plus20";
}
```

### 6.4: Update `cardToString` for Special Cards

```js
function cardToString(card) {
  switch (card.type) {
    case "number":
      return `${card.color} ${card.value}`;
    case "wild":
      return card.chosenColor ? `Wild (${card.chosenColor})` : "Wild";
    case "plus2":
      return `${card.color} +2`;
    case "plus4":
      return "+4";
    case "plus20":
      return "+20 💥";
    case "skip":
      return `${card.color} Skip`;
    case "reverse":
      return `${card.color} Reverse`;
    default:
      return "Unknown";
  }
}
```

---

## Final Checkpoint: Test Special Cards

Test using browser DevTools or programmatic tests:

**1. Plus-Stacking:**
- Player A plays +2 (pendingDraws = 2)
- Player B plays +4 (pendingDraws = 6)
- Player C plays +20 (pendingDraws = 26)
- Player D draws (receives 26 cards, pendingDraws resets to 0)

**2. Skip:**
- 4 players (A, B, C, D)
- Player A (index 0) plays skip
- Turn advances to Player D (index 3, skipped B and C)

**3. Reverse:**
- Player A plays reverse (direction = -1, reverseStackCount = 1)
- Turn goes counter-clockwise
- Stack 4 reverses total
- 5th reverse card becomes unplayable

**4. Reverse Limit Reset:**
- After 4 reverses, play a number card
- reverseStackCount resets to 0
- Reverse cards become playable again

**5. Cross-Color +Stacking:**
- Red +2 on table
- Blue +4 is playable (ignore color for +card stacking)
- Green +2 is playable

---

## What You Built

- ✅ Plus-card stacking (any +card on any +card) with TypeScript types
- ✅ Accumulated draw system (50+ cards possible)
- ✅ Skip cards that skip 2 players
- ✅ Reverse cards with direction flip
- ✅ 4-reverse stack limit
- ✅ Enhanced game state with pendingDraws and reverseStackCount
- ✅ Type-safe card discrimination (discriminated unions)
- ✅ Shared utility functions (cardToString, isPlusCard)

## Next Steps

Phase 4 will add:
- Proper lobby UI (nice avatar picker)
- Game board layout (mobile-optimized)
- Card rendering with colors
- Visual polish (no animations yet)

Questions to solidify understanding:
- Why allow any +card to stack on any +card?
- How does the reverse limit prevent infinite loops?
- What happens if skip played in 3-player game?
- How does turn order work with negative direction?

Ready for Phase 4 (UI overhaul)? Or want to test edge cases and add better error messages?
