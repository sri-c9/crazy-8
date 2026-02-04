# Phase 4: Learning Guide — Building the UI

Welcome to Phase 4! Time to replace the ugly test UI with a proper mobile-optimized interface. You'll build a real lobby screen, game board, and card display system.

## Before You Start

**Prerequisites:**
- Phase 3 complete (game logic fully working)
- Special cards functioning
- Basic test UI working

**What You'll Build:**
- Lobby screen with emoji avatar picker
- Waiting room with player cards
- Game board layout (mobile-first)
- Card rendering with colors
- Responsive layout

**Design Principle:**
Mobile-first! Everything must work on a 375px wide screen (iPhone).

---

## Step 1: Rebuild the Lobby Screen

**Goal:** Create a polished landing page.

### 1.1: Clean HTML Structure

Replace `public/index.html` with a clean structure:

<details>
<summary>💡 Hint: Lobby HTML skeleton</summary>

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
  <div id="app">
    <!-- Lobby Screen -->
    <div id="lobby-screen" class="screen active">
      <h1>🎮 Insane Crazy 8</h1>

      <div class="card-ui">
        <input type="text" id="player-name" placeholder="Your name" maxlength="12">

        <div id="avatar-picker" class="avatar-grid"></div>

        <button id="create-btn" class="btn-primary">Create Room</button>

        <div class="divider">OR</div>

        <input type="text" id="room-code" placeholder="ABCD" maxlength="4">
        <button id="join-btn" class="btn-primary">Join Room</button>
      </div>
    </div>

    <!-- Waiting Room -->
    <div id="waiting-screen" class="screen">
      <h2>Room: <span id="room-code-display"></span></h2>
      <button id="copy-code-btn" class="btn-small">Copy Code</button>

      <div id="player-cards"></div>

      <button id="start-btn" class="btn-primary" style="display:none">Start Game</button>
      <p id="waiting-msg">Waiting for host...</p>

      <button id="leave-btn" class="btn-secondary">Leave Room</button>
    </div>

    <!-- Game Screen (Phase 5) -->
    <div id="game-screen" class="screen">
      <!-- Will build later -->
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```
</details>

### 1.2: Avatar Grid

Build the avatar picker with 12 emoji options:

<details>
<summary>💡 Hint: Avatar picker JavaScript</summary>

```js
// In app.js
const AVATARS = ["😎", "🔥", "👻", "🎯", "🚀", "⚡", "🌟", "🎨", "🎭", "🎪", "🎲", "🃏"];
let selectedAvatar = AVATARS[0];

function initAvatarPicker() {
  const picker = document.getElementById("avatar-picker");

  AVATARS.forEach(emoji => {
    const option = document.createElement("div");
    option.className = "avatar-option";
    option.textContent = emoji;

    if (emoji === selectedAvatar) {
      option.classList.add("selected");
    }

    option.onclick = () => {
      selectedAvatar = emoji;
      document.querySelectorAll(".avatar-option").forEach(el =>
        el.classList.remove("selected")
      );
      option.classList.add("selected");
    };

    picker.appendChild(option);
  });
}

initAvatarPicker();
```
</details>

---

## Step 2: Style the Lobby

**Goal:** Make it look good on mobile.

### 2.1: Create `public/styles.css`

Build mobile-first styles:

<details>
<summary>💡 Hint: Base styles</summary>

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
  color: #333;
}

#app {
  max-width: 500px;
  margin: 0 auto;
}

.screen {
  display: none;
}

.screen.active {
  display: block;
}

h1 {
  text-align: center;
  color: white;
  margin-bottom: 30px;
  font-size: 32px;
}

.card-ui {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}
```
</details>

### 2.2: Style Inputs and Buttons

<details>
<summary>💡 Hint: Form styles</summary>

```css
input[type="text"] {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 12px;
  transition: border-color 0.3s;
}

input[type="text"]:focus {
  outline: none;
  border-color: #667eea;
}

.btn-primary {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  font-weight: bold;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 12px;
  transition: transform 0.2s;
}

.btn-primary:active {
  transform: scale(0.98);
}

.divider {
  text-align: center;
  color: #999;
  margin: 20px 0;
  position: relative;
}

.divider::before,
.divider::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background: #ddd;
}

.divider::before { left: 0; }
.divider::after { right: 0; }
```
</details>

### 2.3: Style Avatar Grid

<details>
<summary>💡 Hint: Avatar picker styles</summary>

```css
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}

.avatar-option {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  background: #f5f5f5;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 3px solid transparent;
}

.avatar-option:hover {
  background: #e8e8e8;
}

.avatar-option.selected {
  background: #e3f2fd;
  border-color: #667eea;
  transform: scale(1.1);
}
```
</details>

---

## Step 3: Waiting Room UI

**Goal:** Display players as cards with avatars.

### 3.1: Player Card Layout

When players join, show them as cards:

<details>
<summary>💡 Hint: renderPlayerCards function</summary>

```js
function renderPlayerCards(players) {
  const container = document.getElementById("player-cards");
  container.innerHTML = "";

  players.forEach(player => {
    const card = document.createElement("div");
    card.className = "player-card";

    card.innerHTML = `
      <div class="player-avatar">${player.avatar}</div>
      <div class="player-info">
        <div class="player-name">${player.name}</div>
        <div class="player-badge">
          ${player.isHost ? '<span class="host-badge">Host</span>' : ''}
          ${player.connected ? '<span class="connected">●</span>' : '<span class="disconnected">○</span>'}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}
```
</details>

### 3.2: Style Player Cards

<details>
<summary>💡 Hint: Player card styles</summary>

```css
#player-cards {
  margin: 20px 0;
}

.player-card {
  display: flex;
  align-items: center;
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.player-avatar {
  font-size: 40px;
  margin-right: 16px;
}

.player-info {
  flex: 1;
}

.player-name {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.player-badge {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.host-badge {
  background: #ffd700;
  color: #333;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.connected {
  color: #4caf50;
}

.disconnected {
  color: #999;
}
```
</details>

---

## Step 4: Wire Up Navigation

**Goal:** Switch between screens.

### 4.1: Screen Switching

Create helper to show/hide screens:

```js
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });
  document.getElementById(screenId).classList.add("active");
}
```

### 4.2: Update WebSocket Handlers

<details>
<summary>💡 Hint: Navigation logic</summary>

```js
// After room created
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case "roomCreated":
      showScreen("waiting-screen");
      document.getElementById("room-code-display").textContent = msg.roomCode;
      myPlayerId = msg.playerId;
      break;

    case "joined":
      showScreen("waiting-screen");
      document.getElementById("room-code-display").textContent = msg.roomCode;
      myPlayerId = msg.playerId;
      break;

    case "playerList":
      renderPlayerCards(msg.players);

      // Show start button if host
      const isHost = msg.players.find(p => p.id === myPlayerId)?.isHost;
      if (isHost && msg.players.length >= 3) {
        document.getElementById("start-btn").style.display = "block";
        document.getElementById("waiting-msg").style.display = "none";
      }
      break;

    case "gameStarted":
      showScreen("game-screen");
      break;
  }
};
```
</details>

### 4.3: Copy Room Code Button

<details>
<summary>💡 Hint: Copy to clipboard</summary>

```js
document.getElementById("copy-code-btn").onclick = () => {
  const code = document.getElementById("room-code-display").textContent;
  navigator.clipboard.writeText(code);

  // Show feedback
  const btn = document.getElementById("copy-code-btn");
  const originalText = btn.textContent;
  btn.textContent = "Copied!";
  setTimeout(() => {
    btn.textContent = originalText;
  }, 2000);
};
```
</details>

---

## Step 5: Game Board Structure (Basic)

**Goal:** Create the layout for gameplay (no functionality yet).

### 5.1: Game Screen HTML

Add to `index.html` inside `#game-screen`:

```html
<div id="game-screen" class="screen">
  <div class="game-header">
    <span id="room-badge"></span>
    <span id="turn-indicator"></span>
  </div>

  <div id="opponents-area"></div>

  <div id="center-area">
    <div id="draw-pile">
      <div class="card-back">🎴</div>
      <button id="draw-btn" class="game-btn">Draw</button>
    </div>

    <div id="discard-pile">
      <div id="top-card"></div>
    </div>
  </div>

  <div id="pending-alert" style="display:none"></div>

  <div id="your-hand">
    <div class="hand-label">Your Cards</div>
    <div id="hand-cards"></div>
  </div>
</div>
```

### 5.2: Game Board Styles

<details>
<summary>💡 Hint: Game board layout</summary>

```css
#game-screen {
  background: #2c3e50;
  border-radius: 16px;
  padding: 16px;
  min-height: 80vh;
}

.game-header {
  display: flex;
  justify-content: space-between;
  color: white;
  margin-bottom: 16px;
}

#opponents-area {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 12px 0;
  margin-bottom: 16px;
}

#center-area {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin: 30px 0;
}

.pile {
  text-align: center;
}

.card-back {
  width: 80px;
  height: 120px;
  background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  margin-bottom: 8px;
}

#your-hand {
  background: rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 16px;
  margin-top: 20px;
}

.hand-label {
  color: white;
  margin-bottom: 12px;
  font-weight: bold;
}

#hand-cards {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0;
}
```
</details>

---

## Step 6: Card Rendering

**Goal:** Render cards with proper colors.

### 6.1: Card Component Styles

<details>
<summary>💡 Hint: Card styles</summary>

```css
.card {
  min-width: 60px;
  height: 90px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;
}

.card:hover {
  transform: translateY(-4px);
}

.card:active {
  transform: translateY(0);
}

.card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card.playable {
  border: 3px solid gold;
  box-shadow: 0 0 12px gold;
}

/* Card colors */
.card.red { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; }
.card.blue { background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; }
.card.green { background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); color: white; }
.card.yellow { background: linear-gradient(135deg, #f1c40f 0%, #f39c12 100%); color: #333; }

.card.wild {
  background: linear-gradient(45deg, #e74c3c 0%, #3498db 25%, #2ecc71 50%, #f1c40f 75%, #e74c3c 100%);
  color: white;
  text-shadow: 0 0 4px rgba(0,0,0,0.5);
}

.card.special {
  background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
  color: white;
}
```
</details>

### 6.2: Card Rendering Function

<details>
<summary>💡 Hint: renderCard function</summary>

```js
function renderCard(card, isPlayable = false) {
  const cardEl = document.createElement("div");
  cardEl.className = "card";

  // Add color class
  if (card.type === "wild") {
    cardEl.classList.add("wild");
  } else if (card.type === "plus4" || card.type === "plus20") {
    cardEl.classList.add("special");
  } else if (card.color) {
    cardEl.classList.add(card.color);
  }

  // Playable highlight
  if (isPlayable) {
    cardEl.classList.add("playable");
  } else {
    cardEl.classList.add("disabled");
  }

  // Card text
  if (card.type === "number") {
    cardEl.textContent = card.value;
  } else if (card.type === "wild") {
    cardEl.textContent = "🎨";
  } else if (card.type === "plus2") {
    cardEl.textContent = "+2";
  } else if (card.type === "plus4") {
    cardEl.textContent = "+4";
  } else if (card.type === "plus20") {
    cardEl.textContent = "+20";
  } else if (card.type === "skip") {
    cardEl.textContent = "⏭";
  } else if (card.type === "reverse") {
    cardEl.textContent = "🔄";
  }

  return cardEl;
}
```
</details>

---

## Checkpoint: Test the UI

**What to Test:**

1. **Lobby:**
   - Avatar picker (click different emojis)
   - Create room → transitions to waiting screen
   - Room code displayed

2. **Waiting Room:**
   - Player cards show avatars
   - Host badge visible
   - Copy button works

3. **Game Board (structure only):**
   - Layout looks good on mobile
   - Cards render with colors
   - Draw pile and discard pile positioned correctly

**Mobile Testing:**
- Open DevTools
- Toggle device toolbar
- Test at 375px width (iPhone)
- Test at 320px width (iPhone SE)

---

## What You Built

- ✅ Polished lobby screen
- ✅ Emoji avatar picker (grid layout)
- ✅ Waiting room with player cards
- ✅ Copy room code functionality
- ✅ Game board layout (mobile-first)
- ✅ Card rendering with colors
- ✅ Responsive design (320px+)

## Next Steps

Phase 5 will add:
- WebSocket client integration
- Real-time game state updates
- Card play interactions
- Error handling and loading states

Questions:
- Why use CSS Grid for avatars?
- How does the gradient background work?
- What's the benefit of mobile-first design?
- How do card classes work (red, blue, playable)?

Ready for Phase 5? Or want to add more polish (animations, better colors, etc.)?
