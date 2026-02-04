# Phase 2: Learning Guide — Game Logic

Welcome to Phase 2! Now that you have the multiplayer infrastructure working, it's time to add the actual card game. You'll build the game engine that handles cards, turns, and basic gameplay rules.

## Before You Start

**Prerequisites:**
- Phase 1 complete (server, rooms, WebSocket working)
- Server running with room creation/joining tested
- Basic understanding of game state management

**What You'll Build:**
- Card generation system (infinite deck)
- Turn order management
- Card validation (color/number matching)
- Deal and draw mechanics
- Win condition detection

**Learning Approach:**
- Build the pure logic first (no server integration)
- Test each function in isolation
- Wire up to server once logic is solid
- Add minimal UI for testing

---

## Step 1: Build the Card System

**Goal:** Create functions to generate and validate cards.

### What You'll Learn
- Random card generation
- Card type system
- Validation logic

### Your Task

Create `game-logic.js` in the project root.

### 1.1: Define Card Structure

First, understand what a card looks like:

```js
// Number cards (0-7, 9)
{ type: "number", color: "red", value: 5 }

// Wild card (8)
{ type: "wild", chosenColor: null }  // Color chosen when played

// Special cards (define structure now, implement in Phase 3)
{ type: "plus2", color: "blue" }
{ type: "plus4" }  // No color
{ type: "plus20" }
{ type: "skip", color: "yellow" }
{ type: "reverse", color: "green" }
```

### 1.2: `generateCard()`

Write a function that returns a random card. For Phase 2, focus on:
- Number cards (0-7, 9): 8 numbers × 4 colors = 32 options
- Wild cards (8): just "wild" type

**Strategy:**
1. Generate random number 0-32
2. If 0-31: number card (divide by 4 for color, modulo for value)
3. If 32: wild card

<details>
<summary>💡 Hint: Card generation logic</summary>

```js
const COLORS = ["red", "blue", "green", "yellow"];
const NUMBER_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 9]; // Skip 8 (that's wild)

export function generateCard() {
  const random = Math.floor(Math.random() * 33); // 0-32

  if (random < 32) {
    // Number card
    const colorIndex = Math.floor(random / 8);
    const valueIndex = random % 8;

    return {
      type: "number",
      color: COLORS[colorIndex],
      value: NUMBER_VALUES[valueIndex]
    };
  } else {
    // Wild card
    return {
      type: "wild",
      chosenColor: null
    };
  }
}
```
</details>

**Test it:**
```js
// At bottom of file
for (let i = 0; i < 10; i++) {
  console.log(generateCard());
}
```
Run: `bun game-logic.js`

Expected: Mix of number cards with different colors/values and occasional wilds

### 1.3: `canPlayCard(card, topCard, chosenColor)`

Write a function that returns `true` if `card` can be played on `topCard`.

**Rules:**
- Wild cards: always playable
- Number cards: must match color OR value with top card
- If top card is wild, match against `chosenColor`

<details>
<summary>💡 Hint: Validation logic</summary>

```js
export function canPlayCard(card, topCard, chosenColor = null) {
  // Wild cards always playable
  if (card.type === "wild") {
    return true;
  }

  // Get the color to match against
  const targetColor = topCard.type === "wild" ? chosenColor : topCard.color;

  // Number cards: match color OR value
  if (card.type === "number" && topCard.type === "number") {
    return card.color === targetColor || card.value === topCard.value;
  }

  // Same color
  return card.color === targetColor;
}
```
</details>

**Test it:**
```js
const red5 = { type: "number", color: "red", value: 5 };
const red3 = { type: "number", color: "red", value: 3 };
const blue5 = { type: "number", color: "blue", value: 5 };
const wild = { type: "wild", chosenColor: null };

console.log(canPlayCard(red3, red5)); // true (same color)
console.log(canPlayCard(blue5, red5)); // true (same value)
console.log(canPlayCard(blue5, red3)); // false (no match)
console.log(canPlayCard(wild, red5)); // true (wild always works)
```

---

## Step 2: Game Initialization

**Goal:** Deal cards and set up initial game state.

### 2.1: Extend Room State

First, update `room-manager.js` to include game fields in the room object:

```js
// In createRoom(), add these fields:
const room = {
  roomCode: code,
  players: new Map(),
  hostId: playerId,
  gameStatus: "waiting",
  createdAt: Date.now(),

  // Game state (added in Phase 2)
  currentPlayerIndex: 0,
  direction: 1,  // 1 = clockwise, -1 = counter-clockwise
  discardPile: [],
  playerHands: new Map(),
  lastPlayedColor: null
};
```

### 2.2: `startGame(room)`

Write a function in `game-logic.js` that:
1. Validates minimum 3 players
2. Deals 7 cards to each player
3. Generates initial discard pile card (cannot be wild)
4. Sets `currentPlayerIndex` to 0
5. Sets `gameStatus` to "playing"

<details>
<summary>💡 Hint: startGame implementation</summary>

```js
export function startGame(room) {
  if (room.players.size < 3) {
    throw new Error("Need at least 3 players");
  }

  // Deal 7 cards to each player
  room.playerHands = new Map();
  for (const playerId of room.players.keys()) {
    const hand = [];
    for (let i = 0; i < 7; i++) {
      hand.push(generateCard());
    }
    room.playerHands.set(playerId, hand);
  }

  // Generate initial discard card (ensure it's not wild)
  let initialCard;
  do {
    initialCard = generateCard();
  } while (initialCard.type === "wild");

  room.discardPile = [initialCard];
  room.lastPlayedColor = initialCard.color;
  room.currentPlayerIndex = 0;
  room.direction = 1;
  room.gameStatus = "playing";
}
```
</details>

### 2.3: `getCurrentPlayer(room)`

Helper function to get current player ID:

```js
export function getCurrentPlayer(room) {
  const playerIds = Array.from(room.players.keys());
  return playerIds[room.currentPlayerIndex];
}
```

**Test it:**
```js
// Mock a room
const mockRoom = {
  players: new Map([
    ["p1", { id: "p1", name: "Alice", avatar: "😎" }],
    ["p2", { id: "p2", name: "Bob", avatar: "🔥" }],
    ["p3", { id: "p3", name: "Charlie", avatar: "👻" }]
  ]),
  gameStatus: "waiting"
};

startGame(mockRoom);
console.log("Game started!");
console.log("Current player:", getCurrentPlayer(mockRoom));
console.log("Alice's hand:", mockRoom.playerHands.get("p1"));
console.log("Top card:", mockRoom.discardPile[mockRoom.discardPile.length - 1]);
```

---

## Step 3: Turn Management

**Goal:** Handle playing cards and advancing turns.

### 3.1: `advanceTurn(room)`

Write a function that moves to the next player:

<details>
<summary>💡 Hint: Turn advancement</summary>

```js
export function advanceTurn(room) {
  const playerCount = room.players.size;

  if (room.direction === 1) {
    // Clockwise
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % playerCount;
  } else {
    // Counter-clockwise
    room.currentPlayerIndex = (room.currentPlayerIndex - 1 + playerCount) % playerCount;
  }
}
```
</details>

### 3.2: `playCard(room, playerId, cardIndex, chosenColor)`

Big function! This handles playing a card:

**Steps:**
1. Validate it's the player's turn
2. Get the card from player's hand
3. Validate the card can be played
4. Remove from hand
5. Add to discard pile
6. If wild, set `lastPlayedColor` to `chosenColor`
7. Advance turn
8. Check win condition

<details>
<summary>💡 Hint: playCard implementation</summary>

```js
export function playCard(room, playerId, cardIndex, chosenColor = null) {
  // Validate turn
  if (getCurrentPlayer(room) !== playerId) {
    throw new Error("Not your turn");
  }

  // Get card
  const hand = room.playerHands.get(playerId);
  if (!hand || cardIndex >= hand.length) {
    throw new Error("Invalid card index");
  }

  const card = hand[cardIndex];
  const topCard = room.discardPile[room.discardPile.length - 1];

  // Validate card
  if (!canPlayCard(card, topCard, room.lastPlayedColor)) {
    throw new Error("Card doesn't match");
  }

  // Wild card requires color choice
  if (card.type === "wild" && !chosenColor) {
    throw new Error("Must choose color for wild card");
  }

  // Remove from hand
  hand.splice(cardIndex, 1);

  // Add to discard
  if (card.type === "wild") {
    card.chosenColor = chosenColor;
    room.lastPlayedColor = chosenColor;
  } else {
    room.lastPlayedColor = card.color;
  }

  room.discardPile.push(card);

  // Check win
  if (hand.length === 0) {
    room.gameStatus = "finished";
    room.winnerId = playerId;
    return;
  }

  // Advance turn
  advanceTurn(room);
}
```
</details>

### 3.3: `drawCard(room, playerId)`

Simpler function:
1. Validate it's the player's turn
2. Generate a new card
3. Add to player's hand
4. Advance turn
5. Return the card (so client can display it)

<details>
<summary>💡 Hint: drawCard implementation</summary>

```js
export function drawCard(room, playerId) {
  if (getCurrentPlayer(room) !== playerId) {
    throw new Error("Not your turn");
  }

  const card = generateCard();
  const hand = room.playerHands.get(playerId);
  hand.push(card);

  advanceTurn(room);

  return card;
}
```
</details>

**Test the turn system:**
```js
// After startGame on mockRoom
const p1 = "p1", p2 = "p2", p3 = "p3";

console.log("Turn 1:", getCurrentPlayer(mockRoom)); // p1

// Find a playable card in p1's hand
const hand = mockRoom.playerHands.get(p1);
const topCard = mockRoom.discardPile[mockRoom.discardPile.length - 1];
const playableIndex = hand.findIndex(card => canPlayCard(card, topCard, mockRoom.lastPlayedColor));

if (playableIndex >= 0) {
  playCard(mockRoom, p1, playableIndex);
  console.log("Turn 2:", getCurrentPlayer(mockRoom)); // p2
} else {
  drawCard(mockRoom, p1);
  console.log("Drew card, Turn 2:", getCurrentPlayer(mockRoom)); // p2
}
```

---

## Step 4: Wire Up to Server

**Goal:** Connect game logic to WebSocket handlers.

### 4.1: Update `room-manager.js`

Add a function to start the game:

```js
import { startGame as startGameLogic } from "./game-logic.js";

export function startGameInRoom(roomCode, playerId) {
  const room = rooms.get(roomCode);

  if (!room) throw new Error("Room not found");
  if (room.hostId !== playerId) throw new Error("Only host can start");
  if (room.players.size < 3) throw new Error("Need at least 3 players");

  startGameLogic(room);
}
```

### 4.2: Add WebSocket Handler in `server.js`

Add new message handlers:

```js
import { playCard, drawCard } from "./game-logic.js";
import { startGameInRoom } from "./room-manager.js";

// In message handler, add cases:
case "startGame":
  handleStartGame(ws, msg);
  break;

case "play":
  handlePlay(ws, msg);
  break;

case "draw":
  handleDraw(ws, msg);
  break;
```

### 4.3: Implement `handleStartGame`

<details>
<summary>💡 Hint: handleStartGame</summary>

```js
function handleStartGame(ws, msg) {
  try {
    startGameInRoom(ws.data.roomCode, ws.data.playerId);

    // Broadcast game started
    server.publish(ws.data.roomCode, JSON.stringify({
      type: "gameStarted",
      message: `Game started by ${ws.data.playerName}`
    }));

    // Send initial state to all players
    broadcastGameState(ws.data.roomCode);
  } catch (error) {
    ws.send(JSON.stringify({ type: "error", message: error.message }));
  }
}
```
</details>

### 4.4: Implement `broadcastGameState`

This is important! Each player needs to see:
- The full game state
- Their own hand (full details)
- Other players' card counts (not the actual cards)

<details>
<summary>💡 Hint: broadcastGameState</summary>

```js
function broadcastGameState(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;

  const topCard = room.discardPile[room.discardPile.length - 1];
  const currentPlayerId = getCurrentPlayer(room);

  // Send to each player individually
  for (const [playerId, player] of room.players) {
    const hand = room.playerHands.get(playerId) || [];

    const state = {
      type: "state",
      gameState: {
        currentPlayerId,
        topCard,
        lastPlayedColor: room.lastPlayedColor,
        direction: room.direction,
        players: Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          cardCount: room.playerHands.get(p.id)?.length || 0,
          hand: p.id === playerId ? hand : undefined // Only show your own hand
        })),
        winner: room.winnerId || null
      },
      yourPlayerId: playerId
    };

    // Publish to room (each subscribed client gets it)
    server.publish(roomCode, JSON.stringify(state));
  }
}
```
</details>

### 4.5: Implement `handlePlay` and `handleDraw`

<details>
<summary>💡 Hint: handlePlay</summary>

```js
function handlePlay(ws, msg) {
  try {
    const room = getRoom(ws.data.roomCode);
    playCard(room, ws.data.playerId, msg.cardIndex, msg.chosenColor);

    broadcastGameState(ws.data.roomCode);
  } catch (error) {
    ws.send(JSON.stringify({ type: "error", message: error.message }));
  }
}
```
</details>

<details>
<summary>💡 Hint: handleDraw</summary>

```js
function handleDraw(ws, msg) {
  try {
    const room = getRoom(ws.data.roomCode);
    const card = drawCard(room, ws.data.playerId);

    // Send the drawn card to the player
    ws.send(JSON.stringify({ type: "cardDrawn", card }));

    broadcastGameState(ws.data.roomCode);
  } catch (error) {
    ws.send(JSON.stringify({ type: "error", message: error.message }));
  }
}
```
</details>

---

## Step 5: Add Minimal Game UI

**Goal:** Update `public/index.html` to test gameplay.

### 5.1: Add Game State Display

After the player list in `index.html`, add:

```html
<div id="game-area" style="display: none;">
  <h3>Game In Progress</h3>

  <div id="turn-indicator"></div>

  <div id="discard-pile">
    <h4>Top Card:</h4>
    <div id="top-card"></div>
  </div>

  <div id="your-hand">
    <h4>Your Hand:</h4>
    <div id="hand-cards"></div>
  </div>

  <button id="draw-btn">Draw Card</button>
</div>

<button id="start-game-btn" style="display: none;">Start Game</button>
```

### 5.2: Update WebSocket Message Handler

Add cases for game messages:

```js
case "gameStarted":
  document.getElementById("game-area").style.display = "block";
  status.innerHTML += `<p>${msg.message}</p>`;
  break;

case "state":
  renderGameState(msg.gameState, msg.yourPlayerId);
  break;

case "cardDrawn":
  status.innerHTML += `<p>You drew: ${cardToString(msg.card)}</p>`;
  break;
```

### 5.3: Implement `renderGameState`

<details>
<summary>💡 Hint: renderGameState function</summary>

```js
function renderGameState(state, yourId) {
  // Turn indicator
  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId);
  document.getElementById("turn-indicator").textContent =
    state.currentPlayerId === yourId
      ? "Your turn!"
      : `${currentPlayer.name}'s turn`;

  // Top card
  document.getElementById("top-card").textContent = cardToString(state.topCard);

  // Your hand
  const you = state.players.find(p => p.id === yourId);
  const handDiv = document.getElementById("hand-cards");
  handDiv.innerHTML = "";

  if (you && you.hand) {
    you.hand.forEach((card, index) => {
      const btn = document.createElement("button");
      btn.textContent = cardToString(card);
      btn.className = "card-btn";

      // Check if playable
      const playable = canPlayCard(card, state.topCard, state.lastPlayedColor);
      btn.disabled = !playable || state.currentPlayerId !== yourId;

      btn.onclick = () => {
        if (card.type === "wild") {
          const color = prompt("Choose color: red, blue, green, yellow");
          ws.send(JSON.stringify({
            action: "play",
            cardIndex: index,
            chosenColor: color
          }));
        } else {
          ws.send(JSON.stringify({ action: "play", cardIndex: index }));
        }
      };

      handDiv.appendChild(btn);
    });
  }

  // Draw button
  document.getElementById("draw-btn").disabled = state.currentPlayerId !== yourId;

  // Winner
  if (state.winner) {
    const winner = state.players.find(p => p.id === state.winner);
    alert(`${winner.name} wins!`);
  }
}

function cardToString(card) {
  if (card.type === "wild") {
    return card.chosenColor ? `Wild (${card.chosenColor})` : "Wild";
  }
  return `${card.color} ${card.value}`;
}
```
</details>

### 5.4: Draw Button Handler

```js
document.getElementById("draw-btn").onclick = () => {
  ws.send(JSON.stringify({ action: "draw" }));
};
```

### 5.5: Show Start Button for Host

Update the playerList handler to show start button:

```js
case "playerList":
  displayPlayers(msg.players);

  // Show start button if you're the host and game not started
  const youAreHost = msg.players.some(p => p.isHost && p.id === yourPlayerId);
  if (youAreHost && msg.players.length >= 3) {
    document.getElementById("start-game-btn").style.display = "block";
  }
  break;
```

Wire up start button:
```js
document.getElementById("start-game-btn").onclick = () => {
  ws.send(JSON.stringify({ action: "startGame" }));
};
```

---

## Final Checkpoint: Play a Game!

Test the full flow:

1. **Create room** (tab 1, Alice)
2. **Join room** (tabs 2-3, Bob and Charlie)
3. **Start game** (Alice clicks Start Game)
4. **Play cards:**
   - Current player clicks a playable card
   - If no playable cards, click Draw
   - Turn advances
5. **Wild cards:**
   - When playing wild, enter color in prompt
6. **Win condition:**
   - Play all cards → see winner alert

**Debug checklist:**
- ✅ Only current player can play/draw
- ✅ Only valid cards are enabled
- ✅ Wild cards prompt for color
- ✅ Turn advances after play/draw
- ✅ Winner detected when hand empty

---

## What You Built

- ✅ Card generation system (infinite deck)
- ✅ Card validation (color/number matching)
- ✅ Turn order with direction support
- ✅ Deal 7 cards to each player
- ✅ Play card logic (with wild card color selection)
- ✅ Draw card logic
- ✅ Win condition detection
- ✅ Game state broadcasting
- ✅ Functional test UI

## Next Steps

Phase 3 will add:
- Plus-card stacking (any +card on any +card)
- Skip behavior (skip 2 players)
- Reverse with 4-card stack limit
- Special card effects

Questions to solidify understanding:
- Why generate cards instead of shuffling a deck?
- How does turn advancement work with direction?
- Why send different state to each player?
- What happens if two players play simultaneously?

Ready for Phase 3? Or want to add features like card count display, better error messages, or styling?
