# Phase 4: Basic UI — Technical Plan

**STATUS: TENTATIVE** — This plan will be refined when Phase 4 begins.

## Goal

Replace the minimal placeholder UI with a proper game interface: lobby screen with emoji avatar selection, game board layout, hand rendering, discard/draw piles, opponent info display. No animations yet — just clean, functional layout optimized for mobile screens.

## Depends On

- **Phase 1 Complete:** Room management, player list
- **Phase 2 Complete:** Game logic, card play
- **Phase 3 Complete:** Special cards (for displaying +card stacks, etc.)

## Files to Create/Modify

### 1. `public/index.html` — Lobby Screen (REPLACE)

**New Structure:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Insane Crazy 8</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- Lobby Screen (shown before game starts) -->
  <div id="lobby-screen">
    <h1>🎮 Insane Crazy 8</h1>

    <!-- Player Setup -->
    <div id="player-setup">
      <input type="text" id="player-name" placeholder="Your name" maxlength="12">

      <!-- Emoji Avatar Grid -->
      <div id="avatar-picker">
        <button class="avatar-option" data-emoji="😎">😎</button>
        <button class="avatar-option" data-emoji="🔥">🔥</button>
        <button class="avatar-option" data-emoji="👻">👻</button>
        <button class="avatar-option" data-emoji="🎯">🎯</button>
        <button class="avatar-option" data-emoji="🚀">🚀</button>
        <button class="avatar-option" data-emoji="⚡">⚡</button>
        <button class="avatar-option" data-emoji="🌟">🌟</button>
        <button class="avatar-option" data-emoji="🎨">🎨</button>
        <button class="avatar-option" data-emoji="🎭">🎭</button>
        <button class="avatar-option" data-emoji="🎪">🎪</button>
        <button class="avatar-option" data-emoji="🎲">🎲</button>
        <button class="avatar-option" data-emoji="🃏">🃏</button>
      </div>

      <button id="create-room-btn">Create Room</button>

      <div class="divider">OR</div>

      <input type="text" id="room-code-input" placeholder="Room code (ABXY)" maxlength="4">
      <button id="join-room-btn">Join Room</button>
    </div>

    <!-- Waiting Room (shown after joining) -->
    <div id="waiting-room" style="display: none;">
      <h2>Room: <span id="room-code-display"></span></h2>
      <p>Share this code with friends!</p>

      <div id="player-list">
        <!-- Dynamically populated player cards -->
      </div>

      <button id="start-game-btn" style="display: none;">Start Game</button>
      <p id="waiting-message">Waiting for host to start...</p>

      <button id="leave-room-btn">Leave Room</button>
    </div>
  </div>

  <script src="lobby.js"></script>
</body>
</html>
```

**Lobby Behavior:**
- Avatar picker: click to select (highlight selected)
- Create/Join buttons validate name and avatar selected
- Waiting room shows player list with avatars
- Host sees "Start Game" button (min 3 players)

### 2. `public/game.html` — Game Board (NEW)

**New Structure:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Insane Crazy 8 - Game</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="game-screen">
    <!-- Top Bar: Room Info -->
    <div id="top-bar">
      <span id="room-code-badge">ABXY</span>
      <span id="turn-indicator">Alice's turn</span>
    </div>

    <!-- Opponents Area (scrollable horizontally on mobile) -->
    <div id="opponents-area">
      <div class="opponent-card">
        <div class="opponent-avatar">😎</div>
        <div class="opponent-name">Alice</div>
        <div class="opponent-card-count">7 cards</div>
      </div>
      <!-- Repeat for each opponent -->
    </div>

    <!-- Center Area: Discard/Draw Piles -->
    <div id="center-area">
      <div id="draw-pile" class="pile">
        <div class="card-back">🎴</div>
        <button id="draw-btn">Draw</button>
      </div>

      <div id="discard-pile" class="pile">
        <div id="top-card" class="card red">
          <span class="card-value">5</span>
        </div>
      </div>
    </div>

    <!-- Pending Draws Alert (if any) -->
    <div id="pending-alert" style="display: none;">
      ⚠️ <span id="pending-count">+8</span> cards pending!
    </div>

    <!-- Your Hand (bottom of screen) -->
    <div id="your-hand">
      <div class="hand-label">Your cards:</div>
      <div id="hand-cards">
        <!-- Dynamically populated card elements -->
        <div class="card blue playable" data-index="0">
          <span class="card-value">3</span>
        </div>
        <!-- ... -->
      </div>
    </div>

    <!-- Color Picker Modal (for wild cards) -->
    <div id="color-picker-modal" style="display: none;">
      <div class="modal-content">
        <h3>Choose a color:</h3>
        <button class="color-choice red" data-color="red">Red</button>
        <button class="color-choice blue" data-color="blue">Blue</button>
        <button class="color-choice green" data-color="green">Green</button>
        <button class="color-choice yellow" data-color="yellow">Yellow</button>
      </div>
    </div>

    <!-- Game Over Screen (overlay) -->
    <div id="game-over-screen" style="display: none;">
      <div class="overlay-content">
        <h2>🎉 <span id="winner-name"></span> wins!</h2>
        <button id="new-game-btn">New Game</button>
        <button id="back-to-lobby-btn">Back to Lobby</button>
      </div>
    </div>
  </div>

  <script src="game-client.js"></script>
</body>
</html>
```

**Game Board Behavior:**
- Opponents displayed horizontally at top
- Center shows draw pile (left) and discard pile (right)
- Your hand at bottom (horizontally scrollable)
- Cards in hand have `.playable` class if valid to play
- Clicking card triggers play action (or color picker for wild)
- Turn indicator highlights current player

### 3. `public/styles.css` — Complete Redesign (REPLACE)

**Design Principles:**
- Mobile-first (320px min width)
- Touch-friendly buttons (min 44px tap targets)
- Card size: 60px × 90px (readable on phone)
- Color-coded cards (red/blue/green/yellow backgrounds)
- High contrast for readability

**Key Styles:**

```css
/* Card Rendering */
.card {
  width: 60px;
  height: 90px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  cursor: pointer;
  transition: transform 0.1s;
}

.card.red { background: #e74c3c; color: white; }
.card.blue { background: #3498db; color: white; }
.card.green { background: #2ecc71; color: white; }
.card.yellow { background: #f1c40f; color: black; }
.card.wild { background: linear-gradient(45deg, #e74c3c, #3498db, #2ecc71, #f1c40f); }

.card.playable {
  border: 3px solid gold;
  transform: translateY(-5px);
}

/* Hand Layout */
#hand-cards {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 10px;
}

/* Opponent Cards */
.opponent-card {
  display: inline-block;
  text-align: center;
  padding: 10px;
}

.opponent-avatar {
  font-size: 40px;
}

/* Modal */
#color-picker-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-choice {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  font-size: 20px;
  margin: 10px;
}
```

### 4. `public/lobby.js` — Lobby Client Logic (NEW)

**Responsibilities:**
- Connect to WebSocket (`/ws`)
- Handle avatar selection
- Send create/join actions
- Display player list in waiting room
- Navigate to `game.html` when game starts

**Key Functions:**
- `selectAvatar(emoji)` — Highlight selected avatar
- `createRoom()` — Send `{ action: "create", playerName, avatar }`
- `joinRoom(code)` — Send `{ action: "join", roomCode, playerName, avatar }`
- `updatePlayerList(players)` — Render player cards with avatars
- `onGameStarted()` — Redirect to `game.html` with roomCode in URL params

### 5. `public/game-client.js` — Game Client Logic (NEW)

**Responsibilities:**
- Connect to WebSocket (resume session via URL params)
- Render game state (opponents, discard pile, your hand)
- Handle card play interactions
- Show color picker modal for wild cards
- Send play/draw actions
- Display game over screen

**Key Functions:**
- `renderGameState(state, yourPlayerId)` — Update entire UI from state
- `renderHand(cards, topCard, pendingDraws)` — Render cards with `.playable` class
- `renderOpponents(players, currentPlayerId)` — Show opponents with turn indicator
- `playCard(index, chosenColor)` — Send `{ action: "play", cardIndex, chosenColor }`
- `drawCard()` — Send `{ action: "draw" }`
- `showColorPicker(cardIndex)` — Modal for wild card color selection
- `onGameOver(winner)` — Display game over overlay

## Navigation Flow

```
index.html (lobby)
  ↓ create/join room
Waiting room (same page, show/hide divs)
  ↓ host starts game
game.html?room=ABXY (redirect with room code)
  ↓ game ends
game.html (show overlay with "Back to Lobby" button)
  ↓ click button
index.html (reset state)
```

**Session Management:**
- Store `playerId` and `roomCode` in `sessionStorage` when joining
- Reconnect to same room if page refreshed
- Clear session on "Leave Room" or "Back to Lobby"

## Implementation Order

1. **`public/styles.css` — Core styles**
   - Card rendering (colors, sizes)
   - Layout structure (flexbox)
   - Mobile breakpoints

2. **`public/index.html` + `lobby.js` — Lobby screen**
   - Avatar picker
   - Room creation/joining
   - Waiting room with player list

3. **`public/game.html` — Game board structure**
   - HTML skeleton with placeholder content

4. **`public/game-client.js` — Game rendering**
   - State rendering logic
   - Hand rendering with playable highlighting
   - Opponent display

5. **Game interaction handlers**
   - Card click → play action
   - Draw button → draw action
   - Color picker modal for wild cards

6. **Game over overlay**
   - Winner announcement
   - Navigation back to lobby

## Testing & Verification

### Manual Testing Steps

1. **Lobby screen:**
   - Open on mobile browser (or DevTools mobile view)
   - Select avatar (verify highlight)
   - Create room (verify room code shown)
   - Join from second device (verify player list updates)

2. **Game board layout:**
   - Start game (verify redirect to game.html)
   - Check opponents displayed at top
   - Check your hand at bottom (horizontally scrollable)
   - Check discard pile shows top card with correct color

3. **Card playability:**
   - Verify only valid cards have gold border
   - Play a valid card (verify it moves to discard)
   - Try clicking unplayable card (should do nothing)

4. **Wild card color picker:**
   - Play a wild (8) card
   - Verify modal appears
   - Choose color (verify game continues with chosen color)

5. **Special card indicators:**
   - Play +2 card
   - Verify pending draws alert appears
   - Next player draws cards (verify alert disappears)

6. **Responsive layout:**
   - Test on 320px width (iPhone SE)
   - Test on 375px width (iPhone 12)
   - Test on 768px width (iPad)
   - Verify no horizontal scroll (except hand cards)

### Visual Polish Checklist

- Card colors match standard Crazy 8 scheme (red/blue/green/yellow)
- Emoji avatars large and readable
- Touch targets minimum 44px
- Current player clearly indicated
- Playable cards stand out (gold border + lifted)
- Room code easy to read and copy

## Success Criteria

- ✅ Lobby screen works on mobile (avatar selection, room creation)
- ✅ Waiting room shows all players with avatars
- ✅ Game board renders on mobile without horizontal scroll
- ✅ Cards are touch-friendly (60px × 90px)
- ✅ Playable cards visually distinct (gold border)
- ✅ Color picker modal works for wild cards
- ✅ Opponent info displayed clearly at top
- ✅ Pending draws alert appears when +cards stacked
- ✅ Game over screen shows winner
- ✅ Navigation flow works (lobby → game → lobby)

## What's NOT in Phase 4

- Animations (card flip, slide, etc.)
- Sound effects
- Loading spinners
- Smooth transitions
- Advanced touch gestures (swipe, drag)
- Offline detection
- Reconnection UI

These come in Phase 5-6. Phase 4 focuses on clean, functional layout.
