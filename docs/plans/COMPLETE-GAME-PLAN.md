# Complete Game Implementation Plan

## Overview

This plan covers implementing ALL remaining features to complete the Insane Crazy 8 game. You've finished the WebSocket infrastructure (Phase 1), now you'll build the game logic, UI, and admin features.

**Implementation order:** Core game logic → Special cards → Game UI → Admin backend → Optional enhancements

**Time estimate:** 15-25 hours for complete implementation

---

## Part 1: Core Game Logic (Phase 2)

**Goal:** Implement basic turn-based card game: dealing, playing valid cards, drawing, win conditions.

**Estimated time:** 4-6 hours

### Files to Modify/Create

#### 1.1: `game-logic.ts` — Game Engine (EXTEND)

**Current state:** Basic card types and `canPlayCard()` exist
**What to add:**

```ts
// Add to existing types
interface PlayerHand {
  playerId: string;
  cards: Card[];
}

interface GameState {
  currentPlayerIndex: number;
  direction: 1 | -1;
  discardPile: Card[];
  topCard: Card;
  lastPlayedColor: CardColor | null;
  pendingDraws: number;        // For Phase 3 (set to 0 for now)
  reverseStackCount: number;   // For Phase 3 (set to 0 for now)
  winner: string | null;
}

// NEW FUNCTIONS TO IMPLEMENT:

export function startGame(room: Room): void {
  // 1. Validate: min 3 players, status = "waiting"
  // 2. Deal 7 cards to each player
  // 3. Generate initial discard pile card (first card)
  // 4. Set currentPlayerIndex = 0, direction = 1
  // 5. Set gameStatus = "playing"
  // 6. Initialize pendingDraws = 0, reverseStackCount = 0
}

export function playCard(
  room: Room,
  playerId: string,
  cardIndex: number,
  chosenColor?: CardColor
): void {
  // 1. Validate it's player's turn
  // 2. Get card from player's hand at cardIndex
  // 3. Validate card can be played with canPlayCard()
  // 4. Remove card from hand
  // 5. Add card to discardPile
  // 6. If wild card, set lastPlayedColor = chosenColor
  // 7. Check win condition (hand empty)
  // 8. Advance turn if no winner
  // Throws error if invalid
}

export function drawCard(room: Room, playerId: string): Card {
  // 1. Validate it's player's turn
  // 2. Generate random card with generateCard()
  // 3. Add to player's hand
  // 4. Advance turn
  // 5. Return the drawn card
}

export function advanceTurn(room: Room): void {
  const playerArray = Array.from(room.players.keys());
  const count = playerArray.length;

  if (room.direction === 1) {
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % count;
  } else {
    room.currentPlayerIndex = (room.currentPlayerIndex - 1 + count) % count;
  }
}

export function getCurrentPlayer(room: Room): string {
  const playerArray = Array.from(room.players.keys());
  return playerArray[room.currentPlayerIndex];
}

export function checkWinCondition(room: Room): string | null {
  for (const [playerId, player] of room.players) {
    if (player.hand.length === 0) {
      room.gameStatus = GameStatus.finished;
      return playerId;
    }
  }
  return null;
}

export function getTopCard(room: Room): Card {
  return room.discardPile[room.discardPile.length - 1];
}
```

**Card generation distribution:**
```ts
// Update generateCard() to include all card types
function generateCard(): Card {
  const rand = Math.random();

  // 60% number cards (0-7, 9)
  if (rand < 0.6) {
    return {
      type: "number",
      color: randomColor(),
      value: randomNumberValue() // 0-7, 9
    };
  }
  // 10% wild (8)
  else if (rand < 0.7) {
    return {
      type: "wild",
      chosenColor: null
    };
  }
  // 15% +2
  else if (rand < 0.85) {
    return {
      type: "plus2",
      color: randomColor()
    };
  }
  // 5% +4
  else if (rand < 0.9) {
    return { type: "plus4" };
  }
  // 2% +20
  else if (rand < 0.92) {
    return { type: "plus20" };
  }
  // 4% skip
  else if (rand < 0.96) {
    return {
      type: "skip",
      color: randomColor()
    };
  }
  // 4% reverse
  else {
    return {
      type: "reverse",
      color: randomColor()
    };
  }
}
```

#### 1.2: `room-manager.ts` — Add Game State (MODIFY)

**Add to existing Room interface:**
```ts
interface Room {
  roomCode: string;
  players: Map<string, PlayerInfo>;
  hostId: string;
  gameStatus: GameStatus;
  createdAt: number;

  // ADD THESE:
  currentPlayerIndex: number;
  direction: 1 | -1;
  discardPile: Card[];
  pendingDraws: number;
  reverseStackCount: number;
  lastPlayedColor: CardColor | null;
}

// ADD THIS to PlayerInfo:
interface PlayerInfo {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
  hand: Card[];  // ADD THIS
}
```

**New function:**
```ts
export function startGameInRoom(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Room not found");
  if (room.players.size < 3) throw new Error("Need 3+ players");
  if (room.gameStatus !== GameStatus.waiting) throw new Error("Game already started");

  startGame(room);  // Delegate to game-logic
}
```

#### 1.3: `server.ts` — Add Game Actions (MODIFY)

**Add to message handler:**
```ts
case "startGame":
  handleStartGame(ws, msg);
  break;

case "play":
  handlePlayCard(ws, msg);
  break;

case "draw":
  handleDrawCard(ws, msg);
  break;
```

**New handler functions:**
```ts
import { startGame, playCard, drawCard, getCurrentPlayer, getTopCard } from "./game-logic";

function handleStartGame(ws: ServerWebSocket<WebSocketData>, msg: IncomingMessage) {
  const { roomCode, playerId } = ws.data;

  try {
    const room = getRoom(roomCode!);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== playerId) throw new Error("Only host can start game");

    startGame(room);

    // Broadcast game state to all players
    broadcastGameState(roomCode!);
  } catch (error) {
    ws.send(JSON.stringify({ type: "error", message: (error as Error).message }));
  }
}

function handlePlayCard(ws: ServerWebSocket<WebSocketData>, msg: IncomingMessage) {
  const { roomCode, playerId } = ws.data;
  const { cardIndex, chosenColor } = msg;

  try {
    const room = getRoom(roomCode!);
    if (!room) throw new Error("Room not found");

    playCard(room, playerId!, cardIndex, chosenColor);

    // Check for winner
    const winner = checkWinCondition(room);

    // Broadcast updated state
    broadcastGameState(roomCode!, winner);
  } catch (error) {
    ws.send(JSON.stringify({ type: "error", message: (error as Error).message }));
  }
}

function handleDrawCard(ws: ServerWebSocket<WebSocketData>, msg: IncomingMessage) {
  const { roomCode, playerId } = ws.data;

  try {
    const room = getRoom(roomCode!);
    if (!room) throw new Error("Room not found");

    const drawnCard = drawCard(room, playerId!);

    // Send drawn card to player (direct message)
    ws.send(JSON.stringify({
      type: "cardDrawn",
      card: drawnCard
    }));

    // Broadcast updated state (hide drawn card from others)
    broadcastGameState(roomCode!);
  } catch (error) {
    ws.send(JSON.stringify({ type: "error", message: (error as Error).message }));
  }
}

// Helper function
function broadcastGameState(roomCode: string, winner?: string | null) {
  const room = getRoom(roomCode);
  if (!room) return;

  const currentPlayerId = getCurrentPlayer(room);
  const topCard = getTopCard(room);

  // Send personalized state to each player
  for (const [playerId, player] of room.players) {
    const personalizedState = {
      type: "state",
      gameState: {
        currentPlayerId,
        topCard,
        lastPlayedColor: room.lastPlayedColor,
        direction: room.direction,
        pendingDraws: room.pendingDraws,
        reverseStackCount: room.reverseStackCount,
        players: Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          cardCount: p.hand.length,
          hand: p.id === playerId ? p.hand : undefined  // Only send own hand
        })),
        winner: winner || null
      },
      yourPlayerId: playerId
    };

    // Send to this specific player
    server.publish(roomCode, JSON.stringify(personalizedState));
  }
}
```

### Testing Phase 2

**Manual test checklist:**
- [ ] Host starts game with 3+ players
- [ ] All players receive 7 random cards
- [ ] Current player can play valid card (color OR number match)
- [ ] Wild card playable anytime, prompts for color choice
- [ ] Turn advances after play/draw
- [ ] Draw button adds card to hand
- [ ] Player with 0 cards triggers win condition
- [ ] Error shown for invalid plays (wrong turn, invalid card)

---

## Part 2: Special Cards (Phase 3)

**Goal:** Implement "Insane" rules: plus-stacking, skip 2, reverse limit.

**Estimated time:** 3-5 hours

### Files to Modify

#### 2.1: `game-logic.ts` — Special Card Logic (EXTEND)

**Modify existing functions:**

```ts
// UPDATE canPlayCard()
export function canPlayCard(card: Card, topCard: Card, room: Room): boolean {
  // NEW RULE: If pendingDraws > 0, only +cards can be played
  if (room.pendingDraws > 0) {
    return card.type === "plus2" || card.type === "plus4" || card.type === "plus20";
  }

  // Wild cards always playable
  if (card.type === "wild") return true;

  // +cards can stack on any +card (ignore color)
  if ((card.type === "plus2" || card.type === "plus4" || card.type === "plus20") &&
      (topCard.type === "plus2" || topCard.type === "plus4" || topCard.type === "plus20")) {
    return true;
  }

  // Reverse limit: max 4 in a row
  if (card.type === "reverse" && room.reverseStackCount >= 4) {
    return false;
  }

  // Regular matching
  const targetColor = topCard.type === "wild" ? room.lastPlayedColor : topCard.color;

  if (card.type === "number" && topCard.type === "number") {
    return card.color === targetColor || card.value === topCard.value;
  }

  return card.color === targetColor;
}

// UPDATE playCard()
export function playCard(
  room: Room,
  playerId: string,
  cardIndex: number,
  chosenColor?: CardColor
): void {
  // ... existing validation

  const player = room.players.get(playerId);
  const card = player!.hand[cardIndex];

  // Remove from hand, add to discard
  player!.hand.splice(cardIndex, 1);
  room.discardPile.push(card);

  // HANDLE SPECIAL CARDS:

  // Plus cards: stack or set pending
  if (card.type === "plus2") {
    room.pendingDraws += 2;
  } else if (card.type === "plus4") {
    room.pendingDraws += 4;
  } else if (card.type === "plus20") {
    room.pendingDraws += 20;
  }

  // Skip: advance by 3 instead of 1 (skips next 2 players)
  if (card.type === "skip") {
    const playerArray = Array.from(room.players.keys());
    const count = playerArray.length;
    room.currentPlayerIndex = (room.currentPlayerIndex + 3 * room.direction + count) % count;
    return;  // Don't call advanceTurn()
  }

  // Reverse: flip direction, increment counter
  if (card.type === "reverse") {
    room.direction = room.direction === 1 ? -1 : 1;
    room.reverseStackCount++;
  } else {
    // Reset reverse counter if non-reverse played
    room.reverseStackCount = 0;
  }

  // Wild card: set chosen color
  if (card.type === "wild" && chosenColor) {
    room.lastPlayedColor = chosenColor;
  } else if (card.color) {
    room.lastPlayedColor = card.color;
  }

  // Check win
  if (player!.hand.length === 0) {
    room.gameStatus = GameStatus.finished;
    return;
  }

  // Advance turn
  advanceTurn(room);
}

// UPDATE drawCard() to handle multi-draw
export function drawCard(room: Room, playerId: string): Card[] {
  const currentPlayer = getCurrentPlayer(room);
  if (currentPlayer !== playerId) {
    throw new Error("Not your turn");
  }

  const player = room.players.get(playerId)!;
  const drawnCards: Card[] = [];

  // Multi-draw if pendingDraws > 0
  if (room.pendingDraws > 0) {
    const count = room.pendingDraws;
    for (let i = 0; i < count; i++) {
      const card = generateCard();
      player.hand.push(card);
      drawnCards.push(card);
    }
    room.pendingDraws = 0;  // Reset
  } else {
    // Normal single draw
    const card = generateCard();
    player.hand.push(card);
    drawnCards.push(card);
  }

  advanceTurn(room);
  return drawnCards;
}
```

#### 2.2: `server.ts` — Broadcast Special Effects (MODIFY)

**Update broadcastGameState() to include:**
```ts
// Add to gameState object:
pendingDraws: room.pendingDraws,
reverseStackCount: room.reverseStackCount,
```

**Update handleDrawCard():**
```ts
function handleDrawCard(ws: ServerWebSocket<WebSocketData>, msg: IncomingMessage) {
  // ... existing code

  const drawnCards = drawCard(room, playerId!);  // Now returns array

  // Send drawn cards to player
  ws.send(JSON.stringify({
    type: "cardDrawn",
    cards: drawnCards,
    forced: drawnCards.length > 1  // True if plus-stack forced draw
  }));

  // ... existing broadcast
}
```

### Testing Phase 3

**Manual test checklist:**
- [ ] Red +2 stacks on blue +4 (ignore color)
- [ ] +20 on +2 creates 22 pending draws
- [ ] Player with no +card draws all pending cards
- [ ] Skip card skips 2 players (turn advances by 3)
- [ ] Reverse flips direction indicator
- [ ] 4 consecutive reverses hit limit
- [ ] 5th reverse shows error "Reverse limit reached"
- [ ] Non-reverse card resets reverse counter

---

## Part 3: Game UI (Phase 4-6)

**Goal:** Build complete game board with card rendering, touch controls, animations.

**Estimated time:** 6-10 hours

### Frontend Structure

**Files to create:**
- `public/game.html` — Game board layout
- `public/game-client.ts` — WebSocket client + rendering
- `public/lobby.ts` — Separate lobby logic from index.html

**Files to modify:**
- `public/index.html` — Clean up, use lobby.ts
- `public/styles.css` — Complete redesign

### 3.1: Game Board Layout (`game.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Insane Crazy 8</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="game-screen">
  <!-- Top Bar -->
  <div class="top-bar">
    <span class="room-badge" id="roomBadge">ABXY</span>
    <span class="turn-indicator" id="turnIndicator">Your turn</span>
    <button class="menu-btn" id="menuBtn">⋮</button>
  </div>

  <!-- Opponents Area -->
  <div class="opponents-container">
    <div id="opponentsList" class="opponents-scroll">
      <!-- Opponent cards rendered here -->
    </div>
  </div>

  <!-- Center: Draw & Discard Piles -->
  <div class="center-area">
    <!-- Pending Draws Alert -->
    <div id="pendingAlert" class="pending-alert hidden">
      ⚠️ <span id="pendingCount">0</span> cards pending!
    </div>

    <div class="piles-container">
      <!-- Draw Pile -->
      <div class="pile draw-pile">
        <div class="card-back">🎴</div>
        <button id="drawBtn" class="pile-btn">Draw</button>
      </div>

      <!-- Discard Pile -->
      <div class="pile discard-pile">
        <div id="topCard" class="card"></div>
      </div>
    </div>

    <!-- Direction Indicator -->
    <div class="direction-indicator" id="directionIndicator">
      <span id="directionArrow">→</span>
    </div>
  </div>

  <!-- Your Hand -->
  <div class="hand-area">
    <div class="hand-label">
      <span>Your cards:</span>
      <span id="cardCount">0</span>
    </div>
    <div id="handCards" class="hand-cards-scroll">
      <!-- Cards rendered here -->
    </div>
  </div>

  <!-- Color Picker Modal -->
  <div id="colorPicker" class="modal hidden">
    <div class="modal-content">
      <h3>Choose a color:</h3>
      <div class="color-buttons">
        <button class="color-btn red" data-color="red"></button>
        <button class="color-btn blue" data-color="blue"></button>
        <button class="color-btn green" data-color="green"></button>
        <button class="color-btn yellow" data-color="yellow"></button>
      </div>
    </div>
  </div>

  <!-- Game Over Modal -->
  <div id="gameOver" class="modal hidden">
    <div class="modal-content">
      <h2>🎉 <span id="winnerName"></span> wins!</h2>
      <button id="backToLobbyBtn" class="btn-primary">Back to Lobby</button>
    </div>
  </div>

  <script src="dist/game-client.js"></script>
</body>
</html>
```

### 3.2: Card Rendering Styles (`styles.css`)

```css
/* Card Styling */
.card {
  width: 70px;
  height: 105px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: bold;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
  user-select: none;
}

.card.red { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; }
.card.blue { background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; }
.card.green { background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); color: white; }
.card.yellow { background: linear-gradient(135deg, #f1c40f 0%, #f39c12 100%); color: #333; }
.card.wild {
  background: linear-gradient(45deg,
    #e74c3c 0%, #e74c3c 25%,
    #3498db 25%, #3498db 50%,
    #2ecc71 50%, #2ecc71 75%,
    #f1c40f 75%, #f1c40f 100%
  );
  color: white;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}

/* Playable Card Highlight */
.card.playable {
  border: 3px solid gold;
  transform: translateY(-10px);
  box-shadow: 0 8px 16px rgba(255, 215, 0, 0.5);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 8px 16px rgba(255, 215, 0, 0.5); }
  50% { box-shadow: 0 8px 20px rgba(255, 215, 0, 0.8); }
}

/* Special Card Badges */
.card-value {
  font-size: 36px;
}

.card-type {
  font-size: 14px;
  margin-top: 4px;
}

/* Plus cards */
.card.plus::before {
  content: '+';
  font-size: 20px;
}

/* Hand Layout */
.hand-cards-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 15px 10px;
  scroll-snap-type: x proximity;
}

.hand-cards-scroll .card {
  scroll-snap-align: center;
  flex-shrink: 0;
}

/* Opponents */
.opponent-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.1);
}

.opponent-card.current-turn {
  background: rgba(255, 215, 0, 0.3);
  border: 2px solid gold;
}

.opponent-avatar {
  font-size: 48px;
  margin-bottom: 5px;
}

.opponent-name {
  font-size: 14px;
  font-weight: bold;
}

.opponent-card-count {
  font-size: 12px;
  color: #aaa;
  margin-top: 3px;
}

/* Mobile Responsive */
@media (max-width: 375px) {
  .card {
    width: 60px;
    height: 90px;
    font-size: 24px;
  }

  .hand-cards-scroll {
    gap: 8px;
  }
}
```

### 3.3: Game Client Logic (`game-client.ts`)

```ts
// WebSocket connection
let ws: WebSocket | null = null;
let yourPlayerId: string | null = null;
let pendingWildCardIndex: number | null = null;

// Initialize
function init() {
  connectWebSocket();
  setupEventListeners();
}

function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  ws = new WebSocket(`${protocol}//${host}/ws`);

  ws.onopen = () => console.log("Connected");
  ws.onmessage = handleMessage;
  ws.onerror = (err) => console.error("WebSocket error:", err);
  ws.onclose = () => console.log("Disconnected");
}

function handleMessage(event: MessageEvent) {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "state":
      renderGameState(data.gameState, data.yourPlayerId);
      break;

    case "cardDrawn":
      handleCardDrawn(data.cards, data.forced);
      break;

    case "error":
      showError(data.message);
      break;
  }
}

function renderGameState(state: GameState, playerId: string) {
  yourPlayerId = playerId;

  // Update turn indicator
  const isYourTurn = state.currentPlayerId === yourPlayerId;
  document.getElementById("turnIndicator")!.textContent =
    isYourTurn ? "Your turn!" : "Waiting...";

  // Render opponents
  renderOpponents(state.players, state.currentPlayerId, yourPlayerId);

  // Render top card
  renderTopCard(state.topCard, state.lastPlayedColor);

  // Render your hand
  const yourPlayer = state.players.find(p => p.id === yourPlayerId);
  if (yourPlayer && yourPlayer.hand) {
    renderHand(yourPlayer.hand, state.topCard, state.pendingDraws, isYourTurn);
  }

  // Update pending draws alert
  if (state.pendingDraws > 0) {
    document.getElementById("pendingAlert")!.classList.remove("hidden");
    document.getElementById("pendingCount")!.textContent = `+${state.pendingDraws}`;
  } else {
    document.getElementById("pendingAlert")!.classList.add("hidden");
  }

  // Update direction indicator
  const arrow = state.direction === 1 ? "→" : "←";
  document.getElementById("directionArrow")!.textContent = arrow;

  // Check for winner
  if (state.winner) {
    const winner = state.players.find(p => p.id === state.winner);
    showGameOver(winner!.name);
  }
}

function renderHand(hand: Card[], topCard: Card, pendingDraws: number, isYourTurn: boolean) {
  const container = document.getElementById("handCards")!;
  container.innerHTML = "";

  hand.forEach((card, index) => {
    const cardEl = createCardElement(card);
    cardEl.dataset.index = index.toString();

    // Highlight playable cards
    if (isYourTurn && canPlayCard(card, topCard, pendingDraws)) {
      cardEl.classList.add("playable");
      cardEl.onclick = () => handleCardClick(index, card);
    }

    container.appendChild(cardEl);
  });

  document.getElementById("cardCount")!.textContent = hand.length.toString();
}

function createCardElement(card: Card): HTMLElement {
  const div = document.createElement("div");
  div.className = `card ${card.color || "wild"}`;

  if (card.type === "number") {
    div.innerHTML = `<span class="card-value">${card.value}</span>`;
  } else if (card.type === "wild") {
    div.innerHTML = `<span class="card-value">8</span><span class="card-type">WILD</span>`;
  } else if (card.type === "plus2") {
    div.innerHTML = `<span class="card-value">+2</span>`;
  } else if (card.type === "plus4") {
    div.innerHTML = `<span class="card-value">+4</span>`;
  } else if (card.type === "plus20") {
    div.innerHTML = `<span class="card-value">+20</span>`;
  } else if (card.type === "skip") {
    div.innerHTML = `<span class="card-value">⏭️</span>`;
  } else if (card.type === "reverse") {
    div.innerHTML = `<span class="card-value">🔄</span>`;
  }

  return div;
}

function renderOpponents(players: PlayerInfo[], currentPlayerId: string, yourId: string) {
  const container = document.getElementById("opponentsList")!;
  container.innerHTML = "";

  players
    .filter(p => p.id !== yourId)
    .forEach(player => {
      const div = document.createElement("div");
      div.className = "opponent-card";
      if (player.id === currentPlayerId) {
        div.classList.add("current-turn");
      }

      div.innerHTML = `
        <div class="opponent-avatar">${player.avatar}</div>
        <div class="opponent-name">${player.name}</div>
        <div class="opponent-card-count">${player.cardCount} cards</div>
      `;

      container.appendChild(div);
    });
}

function renderTopCard(card: Card, lastColor: string | null) {
  const topCard = document.getElementById("topCard")!;
  topCard.className = `card ${card.color || lastColor || "wild"}`;

  if (card.type === "number") {
    topCard.innerHTML = `<span class="card-value">${card.value}</span>`;
  } else if (card.type === "wild") {
    topCard.innerHTML = `<span class="card-value">8</span>`;
  } else {
    topCard.innerHTML = `<span class="card-value">${getCardSymbol(card.type)}</span>`;
  }
}

function handleCardClick(index: number, card: Card) {
  if (card.type === "wild") {
    // Show color picker
    pendingWildCardIndex = index;
    document.getElementById("colorPicker")!.classList.remove("hidden");
  } else {
    // Play card immediately
    playCard(index);
  }
}

function playCard(index: number, chosenColor?: string) {
  ws?.send(JSON.stringify({
    action: "play",
    cardIndex: index,
    chosenColor
  }));
}

function setupEventListeners() {
  // Draw button
  document.getElementById("drawBtn")!.onclick = () => {
    ws?.send(JSON.stringify({ action: "draw" }));
  };

  // Color picker buttons
  document.querySelectorAll(".color-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const color = (e.target as HTMLElement).dataset.color;
      if (pendingWildCardIndex !== null) {
        playCard(pendingWildCardIndex, color);
        pendingWildCardIndex = null;
      }
      document.getElementById("colorPicker")!.classList.add("hidden");
    });
  });

  // Back to lobby
  document.getElementById("backToLobbyBtn")!.onclick = () => {
    window.location.href = "/";
  };
}

function showGameOver(winnerName: string) {
  document.getElementById("winnerName")!.textContent = winnerName;
  document.getElementById("gameOver")!.classList.remove("hidden");
}

// Client-side validation (matches server logic)
function canPlayCard(card: Card, topCard: Card, pendingDraws: number): boolean {
  if (pendingDraws > 0) {
    return card.type === "plus2" || card.type === "plus4" || card.type === "plus20";
  }

  if (card.type === "wild") return true;

  if (card.color === topCard.color) return true;
  if (card.type === "number" && topCard.type === "number" && card.value === topCard.value) return true;

  return false;
}

// Start
init();
```

### Testing Phase 4-6

**UI test checklist:**
- [ ] Game board loads without errors
- [ ] Cards render with correct colors
- [ ] Playable cards have gold border + lift effect
- [ ] Click playable card → plays successfully
- [ ] Click wild card → color picker appears
- [ ] Opponent info shows avatars + card counts
- [ ] Current player highlighted with gold border
- [ ] Draw button works, adds card to hand
- [ ] Pending draws alert appears when +cards stacked
- [ ] Direction arrow changes on reverse
- [ ] Game over modal shows winner name
- [ ] "Back to Lobby" returns to index.html
- [ ] Mobile: no horizontal scroll except hand area
- [ ] Mobile: touch targets ≥44px

---

## Part 4: Admin Panel Backend (Phase 8)

**Goal:** Implement "god mode" powers: see all hands, manipulate cards, control turns, kick players.

**Estimated time:** 4-6 hours

### Files to Create/Modify

#### 4.1: `admin-manager.ts` — God Mode State (NEW)

```ts
interface GodModePowers {
  seeAllHands: boolean;
  manipulateCards: boolean;
  controlTurns: boolean;
  roomControl: boolean;
}

interface AdminSession {
  watchedRoom: string | null;
  powers: GodModePowers;
}

const adminSessions = new Map<string, AdminSession>();  // adminId -> session

export function createAdminSession(adminId: string): void {
  adminSessions.set(adminId, {
    watchedRoom: null,
    powers: {
      seeAllHands: false,
      manipulateCards: false,
      controlTurns: false,
      roomControl: false
    }
  });
}

export function togglePower(adminId: string, power: keyof GodModePowers): boolean {
  const session = adminSessions.get(adminId);
  if (!session) throw new Error("Admin session not found");

  session.powers[power] = !session.powers[power];
  return session.powers[power];
}

export function hasPower(adminId: string, power: keyof GodModePowers): boolean {
  const session = adminSessions.get(adminId);
  return session?.powers[power] || false;
}

export function setWatchedRoom(adminId: string, roomCode: string | null): void {
  const session = adminSessions.get(adminId);
  if (!session) throw new Error("Admin session not found");
  session.watchedRoom = roomCode;
}

export function getWatchedRoom(adminId: string): string | null {
  return adminSessions.get(adminId)?.watchedRoom || null;
}
```

#### 4.2: `room-manager.ts` — Admin Functions (EXTEND)

```ts
export function getAllRooms(): Array<{
  roomCode: string;
  playerCount: number;
  gameStatus: GameStatus;
  hostId: string;
}> {
  return Array.from(rooms.values()).map(room => ({
    roomCode: room.roomCode,
    playerCount: room.players.size,
    gameStatus: room.gameStatus,
    hostId: room.hostId
  }));
}

export function kickPlayer(roomCode: string, playerId: string): void {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Room not found");

  leaveRoom(roomCode, playerId);
}

export function forceStartGame(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Room not found");
  if (room.gameStatus !== GameStatus.waiting) throw new Error("Game already started");

  // Bypass 3-player minimum
  startGame(room);
}

export function endGame(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Room not found");

  room.gameStatus = GameStatus.finished;
}
```

#### 4.3: `game-logic.ts` — Admin Card Functions (EXTEND)

```ts
export function adminGiveCard(room: Room, playerId: string, card?: Card): void {
  const player = room.players.get(playerId);
  if (!player) throw new Error("Player not found");

  const cardToAdd = card || generateCard();
  player.hand.push(cardToAdd);
}

export function adminRemoveCard(room: Room, playerId: string, cardIndex: number): void {
  const player = room.players.get(playerId);
  if (!player) throw new Error("Player not found");

  if (cardIndex < 0 || cardIndex >= player.hand.length) {
    throw new Error("Invalid card index");
  }

  player.hand.splice(cardIndex, 1);
}

export function adminSetTopCard(room: Room, card: Card): void {
  room.discardPile.push(card);
  if (card.color) {
    room.lastPlayedColor = card.color;
  }
}

export function adminSkipTurn(room: Room): void {
  advanceTurn(room);
}

export function adminForceDraw(room: Room, playerId: string, count: number): void {
  const player = room.players.get(playerId);
  if (!player) throw new Error("Player not found");

  for (let i = 0; i < count; i++) {
    player.hand.push(generateCard());
  }
}

export function adminReverseDirection(room: Room): void {
  room.direction = room.direction === 1 ? -1 : 1;
}

export function adminSetCurrentPlayer(room: Room, playerId: string): void {
  const playerArray = Array.from(room.players.keys());
  const index = playerArray.indexOf(playerId);

  if (index === -1) throw new Error("Player not found");
  room.currentPlayerIndex = index;
}

export function adminGetAllHands(room: Room): Map<string, Card[]> {
  const hands = new Map<string, Card[]>();
  for (const [playerId, player] of room.players) {
    hands.set(playerId, player.hand);
  }
  return hands;
}
```

#### 4.4: `server.ts` — Admin Routes & Handlers (EXTEND)

```ts
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "insane8admin";

// In fetch handler, BEFORE WebSocket upgrade:
if (url.pathname === "/admin") {
  const password = url.searchParams.get("password");

  if (password !== ADMIN_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response(Bun.file("./public/admin.html"));
}

// In WebSocket message handler, add admin action routing:
case "adminListRooms":
  handleAdminListRooms(ws);
  break;

case "adminWatchRoom":
  handleAdminWatchRoom(ws, msg);
  break;

case "adminTogglePower":
  handleAdminTogglePower(ws, msg);
  break;

case "adminGetAllHands":
  handleAdminGetAllHands(ws);
  break;

case "adminGiveCard":
  handleAdminGiveCard(ws, msg);
  break;

case "adminRemoveCard":
  handleAdminRemoveCard(ws, msg);
  break;

case "adminSetTopCard":
  handleAdminSetTopCard(ws, msg);
  break;

case "adminSkipTurn":
  handleAdminSkipTurn(ws);
  break;

case "adminForceDraw":
  handleAdminForceDraw(ws, msg);
  break;

case "adminReverseDirection":
  handleAdminReverseDirection(ws);
  break;

case "adminSetCurrentPlayer":
  handleAdminSetCurrentPlayer(ws, msg);
  break;

case "adminKickPlayer":
  handleAdminKickPlayer(ws, msg);
  break;

case "adminForceStart":
  handleAdminForceStart(ws);
  break;

case "adminEndGame":
  handleAdminEndGame(ws);
  break;

// Implement each handler:
function handleAdminListRooms(ws: ServerWebSocket<WebSocketData>) {
  const rooms = getAllRooms();
  ws.send(JSON.stringify({
    type: "adminRoomList",
    rooms
  }));
}

function handleAdminWatchRoom(ws: ServerWebSocket<WebSocketData>, msg: IncomingMessage) {
  const adminId = ws.data.playerId!;  // Use playerId as adminId
  const { roomCode } = msg;

  setWatchedRoom(adminId, roomCode);

  // Send room state
  const room = getRoom(roomCode);
  if (room) {
    ws.send(JSON.stringify({
      type: "adminRoomState",
      room: {
        roomCode: room.roomCode,
        players: Array.from(room.players.values()),
        gameStatus: room.gameStatus,
        currentPlayerIndex: room.currentPlayerIndex,
        topCard: room.discardPile[room.discardPile.length - 1],
        direction: room.direction,
        pendingDraws: room.pendingDraws
      }
    }));
  }
}

function handleAdminTogglePower(ws: ServerWebSocket<WebSocketData>, msg: IncomingMessage) {
  const adminId = ws.data.playerId!;
  const { power } = msg;

  const enabled = togglePower(adminId, power);
  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: `Power ${power} ${enabled ? "enabled" : "disabled"}`
  }));
}

function handleAdminGetAllHands(ws: ServerWebSocket<WebSocketData>) {
  const adminId = ws.data.playerId!;

  if (!hasPower(adminId, "seeAllHands")) {
    ws.send(JSON.stringify({
      type: "adminResult",
      success: false,
      message: "Power 'seeAllHands' not enabled"
    }));
    return;
  }

  const roomCode = getWatchedRoom(adminId);
  if (!roomCode) {
    ws.send(JSON.stringify({
      type: "adminResult",
      success: false,
      message: "No room being watched"
    }));
    return;
  }

  const room = getRoom(roomCode);
  if (!room) {
    ws.send(JSON.stringify({
      type: "adminResult",
      success: false,
      message: "Room not found"
    }));
    return;
  }

  const hands = adminGetAllHands(room);
  ws.send(JSON.stringify({
    type: "adminAllHands",
    hands: Object.fromEntries(hands)
  }));
}

// Similar pattern for other admin handlers with power checks
```

### Testing Phase 8

**Admin panel test checklist:**
- [ ] `/admin` returns 401 without password
- [ ] `/admin?password=insane8admin` loads admin panel
- [ ] Room list shows all active rooms
- [ ] Click room → watch panel appears
- [ ] Toggle "See All Hands" → all player hands visible
- [ ] Click × on card → removes from hand
- [ ] Toggle "Manipulate Cards" → give card works
- [ ] Toggle "Control Turns" → skip turn works
- [ ] Force draw 10 → player gets 10 cards
- [ ] Reverse direction → arrow flips in game
- [ ] Toggle "Room Control" → kick player works
- [ ] Force start with 2 players → game begins
- [ ] End game → game status changes to finished

---

## Part 5: iOS Haptics (Optional)

**Goal:** Add haptic feedback for plus-card draws on iPhone.

**Estimated time:** 1 hour

### Implementation

```bash
bun add ios-haptics
```

**In `game-client.ts`:**
```ts
import { haptic } from "ios-haptics";

function handleCardDrawn(cards: Card[], forced: boolean) {
  if (forced && cards.length > 0) {
    triggerDrawHaptic(cards.length);
  }
  // ... existing code to add cards to hand
}

function triggerDrawHaptic(cardCount: number) {
  if (cardCount <= 2) {
    haptic();  // Single pulse for +2
  } else if (cardCount <= 4) {
    haptic.confirm();  // Two pulses for +4
  } else {
    haptic.error();  // Three pulses for +20 or stacks
  }
}
```

---

## Implementation Order Summary

**Recommended sequence:**

1. **Week 1: Core Game (Phase 2)**
   - Day 1-2: `game-logic.ts` (card generation, basic validation)
   - Day 3: `room-manager.ts` + `server.ts` (game state, actions)
   - Day 4: Test basic gameplay (deal, play, draw, win)

2. **Week 2: Special Cards + UI Foundation (Phase 3-4)**
   - Day 1-2: Special card logic (plus-stacking, skip, reverse)
   - Day 3-4: Game board HTML/CSS
   - Day 5: Basic game client rendering

3. **Week 3: Polish UI (Phase 5-6)**
   - Day 1-2: Complete game-client.ts
   - Day 3: Animations and mobile optimization
   - Day 4: Testing and bug fixes

4. **Week 4: Admin Panel (Phase 8)**
   - Day 1: `admin-manager.ts` + room/game admin functions
   - Day 2-3: Server admin handlers
   - Day 4: Test all god mode powers

5. **Optional: iOS Haptics** (30 min - 1 hour)

---

## Success Criteria

**Complete game checklist:**
- [ ] 3-6 players can join a room
- [ ] Host can start game (deals 7 cards each)
- [ ] Players can play valid cards (color/number match)
- [ ] Wild cards prompt for color selection
- [ ] Any +card stacks on any +card (ignore color)
- [ ] Player with no +card draws all pending cards
- [ ] Skip cards skip 2 players
- [ ] Reverse cards flip direction (max 4 stack)
- [ ] Draw button adds random card to hand
- [ ] Player with 0 cards wins, game ends
- [ ] Game board works on mobile (320px width)
- [ ] Cards render with correct colors
- [ ] Playable cards highlighted with gold border
- [ ] Opponents show avatars + card counts
- [ ] Turn indicator shows current player
- [ ] Admin panel accessible with password
- [ ] God mode powers work (see hands, kick, manipulate)
- [ ] All 4 admin power toggles function correctly
- [ ] iOS haptics trigger on forced draws (optional)

---

## Next Steps After Implementation

1. **Deployment:**
   - Follow `docs/guides/DEPLOYMENT-GUIDE.md`
   - Fix WebSocket URL to protocol-aware
   - Set up ngrok tunnel
   - Test cross-device

2. **Real-World Testing:**
   - Play full game with 3+ friends
   - Test plus-stacking with 20+ cards
   - Test skip/reverse in 6-player game
   - Verify mobile touch controls

3. **Bug Fixes & Polish:**
   - Address any gameplay bugs
   - Improve error messages
   - Add loading states
   - Optimize animations

4. **Optional Enhancements:**
   - Sound effects
   - Chat system
   - Spectator mode
   - Game history/stats
   - Custom card backs

---

**You're ready to build!** Start with Part 1 (Core Game Logic) and work through each part sequentially. Each part has clear success criteria to verify before moving on. Good luck! 🎮🚀
