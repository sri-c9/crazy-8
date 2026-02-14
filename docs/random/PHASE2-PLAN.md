# Phase 2: Game Logic — Technical Plan

**STATUS: TENTATIVE** — This plan will be refined when Phase 2 begins.

## Goal

Implement core game logic including card generation, deck management, turn order, card play validation, dealing, and drawing. Players should be able to start a game, receive hands, play cards that match color/number, and draw when needed. No special cards yet — just basic gameplay.

## Depends On

- **Phase 1 Complete:** Room management, WebSocket infrastructure, player list broadcasting

## Files to Create/Modify

### 1. `game-logic.ts` — Game Rules Engine (NEW)

**Responsibilities:**
- Card generation and deck management
- Turn order tracking with player index
- Card validation (match by color or number)
- Wild card (8) handling
- Deal initial hands (7 cards per player)
- Draw card logic
- Win condition detection (hand empty)

**Type Definitions:**

```ts
type CardColor = "red" | "blue" | "green" | "yellow";
type CardType = "number" | "wild" | "plus2" | "plus4" | "plus20" | "skip" | "reverse";

interface Card {
  type: CardType;
  color?: CardColor;
  value?: number;
  chosenColor?: CardColor;  // For wild cards after played
}

interface PlayerInfo {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
  hand: Card[];
}

interface Room {
  roomCode: string;
  players: Map<string, PlayerInfo>;
  hostId: string;
  gameStatus: "waiting" | "playing" | "finished";
  createdAt: number;
  currentPlayerIndex: number;
  direction: 1 | -1;
  discardPile: Card[];
  pendingDraws: number;
  reverseStackCount: number;
  lastPlayedColor: string | null;
}
```

**Exported Functions:**

- `generateCard(): Card`
  - Returns random card object: `{ type, color?, value? }`
  - Types: number (0-7, 9), wild (8), plus2, plus4, plus20, skip, reverse
  - Colors: red, blue, green, yellow (not applicable for wild/plus4/plus20)

- `startGame(room: Room): void`
  - Validates minimum 3 players
  - Deals 7 cards to each player
  - Generates initial discard pile card
  - Sets `currentPlayerIndex` to 0
  - Sets `direction` to 1 (clockwise)
  - Sets `gameStatus` to "playing"

- `canPlayCard(card: Card, topCard: Card, chosenColor?: string): boolean`
  - Wild (8) cards: always playable
  - Regular cards: match color OR value with top of discard pile
  - Returns true/false

- `playCard(room: Room, playerId: string, cardIndex: number, chosenColor?: string): void`
  - Validates it's player's turn
  - Validates card can be played
  - Removes card from player's hand
  - Adds card to discard pile
  - Sets chosen color if wild card played
  - Advances turn
  - Checks for win condition
  - Throws error if invalid

- `drawCard(room: Room, playerId: string): Card`
  - Validates it's player's turn
  - Generates new random card
  - Adds to player's hand
  - Advances turn
  - Returns card for client display

- `advanceTurn(room: Room): void`
  - Increments/decrements `currentPlayerIndex` based on `direction`
  - Wraps around player count

- `getCurrentPlayer(room: Room): string`
  - Returns playerId of current player

- `checkWinCondition(room: Room): string | null`
  - Returns playerId of winner if any player has 0 cards
  - Returns null otherwise

**Card Object Examples:**
```ts
// Number cards (0-7, 9)
{ type: "number", color: "red", value: 3 }

// Wild card (8)
{ type: "wild", chosenColor: "blue" }  // chosenColor set when played

// Special cards (Phase 3, but structure defined now)
{ type: "plus2", color: "green" }
{ type: "plus4" }  // no color
{ type: "plus20" }  // no color
{ type: "skip", color: "yellow" }
{ type: "reverse", color: "red" }
```

### 2. `room-manager.ts` — ADD Game State Fields (MODIFY)

**New Fields in Room Object:**
```ts
interface Room {
  // ... existing fields (roomCode, players, hostId, gameStatus, createdAt)

  // Game state fields (added in Phase 2)
  currentPlayerIndex: number;        // Index in players Map iteration order
  direction: 1 | -1;                 // 1 = clockwise, -1 = counter-clockwise
  discardPile: Card[];               // Top card is last element
  pendingDraws: number;              // For plus-stacking in Phase 3 (default: 0)
  reverseStackCount: number;         // For reverse-limit in Phase 3 (default: 0)
  lastPlayedColor: string | null;    // Current color (for wild cards)
}
```

**New Exported Function:**
- `startGameInRoom(roomCode: string): void`
  - Delegates to `game-logic.startGame(room)`
  - Only host can start
  - Minimum 3 players required

### 3. `server.ts` — ADD Game Action Handlers (MODIFY)

**New WebSocket Message Handlers:**

- `action: "startGame"` (host only)
  - Calls `room-manager.startGameInRoom()`
  - Broadcasts initial game state to all players

- `action: "play"` (with `cardIndex`, optional `chosenColor`)
  - Calls `game-logic.playCard()`
  - Broadcasts updated game state to room

- `action: "draw"`
  - Calls `game-logic.drawCard()`
  - Sends drawn card to player (direct message)
  - Broadcasts updated game state to room (hides other players' hands)

**Broadcasting Game State:**
- Send full state to all players, but replace other players' hands with card counts
- Each player gets their own hand in full detail

### 4. `public/index.html` — ADD Start Game Button (MODIFY)

**New UI Elements:**
- "Start Game" button (visible only to host, only when gameStatus = "waiting")
- Game state display (minimal placeholder for testing Phase 2)
  - Current player indicator
  - Top discard card
  - Your hand (list of cards)
  - "Play Card" / "Draw Card" buttons (ugly but functional)

**Note:** Frontend UI implementation will be handled by Claude Code.

**JavaScript Updates:**
- Handle `startGame` action
- Handle `play` and `draw` actions
- Display received game state

## WebSocket Message Protocol

### Client → Server (NEW)

**Start Game:**
```json
{
  "action": "startGame"
}
```

**Play Card:**
```json
{
  "action": "play",
  "cardIndex": 3,
  "chosenColor": "red"  // only for wild cards
}
```

**Draw Card:**
```json
{
  "action": "draw"
}
```

### Server → Client (NEW)

**Game Started:**
```json
{
  "type": "gameStarted",
  "message": "Game started by Alice"
}
```

**Game State (broadcast to room):**
```json
{
  "type": "state",
  "gameState": {
    "currentPlayerId": "p_abc123",
    "topCard": { "type": "number", "color": "red", "value": 5 },
    "lastPlayedColor": "red",
    "direction": 1,
    "players": [
      { "id": "p_abc123", "name": "Alice", "cardCount": 7, "hand": [...] },  // full hand only if you
      { "id": "p_def456", "name": "Bob", "cardCount": 7 }  // card count only for others
    ],
    "winner": null  // or playerId if game over
  },
  "yourPlayerId": "p_abc123"  // so client knows which hand to show
}
```

**Card Drawn (direct message to drawer):**
```json
{
  "type": "cardDrawn",
  "card": { "type": "number", "color": "blue", "value": 3 }
}
```

## Key Design Decisions

### Infinite Deck Strategy

No card reshuffling needed. `generateCard()` creates random cards on-demand. This simplifies implementation and avoids "running out of cards" edge cases.

**Probability Distribution:**
- Number cards (0-7, 9): 8 types × 4 colors = 32 options
- Wild card (8): 1 type (choose color when played)
- Special cards (Phase 3): +2 (4 colors), +4, +20, skip (4 colors), reverse (4 colors)

Simple uniform random works fine for casual gameplay.

### Turn Order with Direction

Use `currentPlayerIndex` (0-based) and `direction` (1 or -1). Wrap around player count.

```ts
// Clockwise
currentPlayerIndex = (currentPlayerIndex + 1) % playerCount;

// Counter-clockwise
currentPlayerIndex = (currentPlayerIndex - 1 + playerCount) % playerCount;
```

### Player Iteration Order

`Map<playerId, PlayerInfo>` maintains insertion order in JavaScript. Convert to array for indexing:
```ts
const playerArray = Array.from(room.players.keys());
const currentPlayerId: string = playerArray[room.currentPlayerIndex];
```

## Implementation Order

1. **`game-logic.ts` — Card generation and validation**
   - Write `generateCard()` first (testable in isolation)
   - Write `canPlayCard()` (unit-testable with sample cards)

2. **`game-logic.ts` — Game initialization**
   - Implement `startGame()` to deal cards and set initial state

3. **`game-logic.ts` — Turn management**
   - Implement `playCard()`, `drawCard()`, `advanceTurn()`
   - Add win condition checking

4. **`room-manager.ts` — Extend room state**
   - Add new fields to room object
   - Implement `startGameInRoom()`

5. **`server.ts` — Wire up game actions**
   - Add message handlers for `startGame`, `play`, `draw`
   - Implement game state broadcasting logic

6. **`public/index.html` — Minimal game UI**
   - Add start button and game state display
   - Handle play/draw interactions
   - Note: Frontend UI implementation will be handled by Claude Code.

## Testing & Verification

### Manual Testing Steps

1. **Start a game:**
   - Create room with Alice (tab 1)
   - Join with Bob and Charlie (tabs 2-3)
   - Alice clicks "Start Game"
   - Verify all players receive initial hands (7 cards each)
   - Verify top discard card is shown
   - Verify current player indicator points to player 0

2. **Play valid cards:**
   - Current player plays a card matching color OR number
   - Verify card moves to discard pile
   - Verify turn advances to next player
   - Verify hand size decreases

3. **Play wild card:**
   - Player plays a wild (8) card
   - Choose a color (red/blue/green/yellow)
   - Verify next player must match chosen color

4. **Draw card:**
   - Current player has no valid cards
   - Click "Draw Card"
   - Verify new card appears in hand
   - Verify turn advances

5. **Win condition:**
   - Play all cards from hand
   - Verify game ends with winner announcement
   - Verify `gameStatus` changes to "finished"

### Edge Cases to Test

- Empty hand triggers win
- Wild card can be played on any color
- Turn wraps around from last player to first
- Can't play out of turn
- Can't play invalid card (error message)

## Success Criteria

- ✅ Host can start game with 3+ players
- ✅ All players receive 7 random cards
- ✅ Current player can play valid cards (color/number match)
- ✅ Wild (8) cards work with color selection
- ✅ Turn order advances correctly
- ✅ Draw card adds to hand and advances turn
- ✅ Win condition detected when player empties hand
- ✅ Invalid actions show error messages
- ✅ Game state syncs to all players in real-time

## What's NOT in Phase 2

- Special card logic (plus-stacking, skip, reverse)
- Polished game UI
- Animations
- Mobile optimization
- Reconnection during active game

These come in later phases. Phase 2 focuses on the basic turn-based card game loop.
