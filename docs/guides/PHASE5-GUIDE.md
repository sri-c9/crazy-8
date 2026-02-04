# Phase 5: Learning Guide — Interactivity & Polish

Welcome to Phase 5! You have a beautiful UI, now let's make it fully interactive with robust error handling, reconnection logic, and smooth user experience.

## Before You Start

**Prerequisites:**
- Phase 4 complete (UI built)
- Game board renders properly
- Lobby and waiting room work

**What You'll Build:**
- Complete WebSocket client integration
- Automatic reconnection with exponential backoff
- Toast notifications for errors
- Loading states and spinners
- Optimistic UI updates

---

## Step 1: Toast Notification System

**Goal:** Show user-friendly messages for errors and successes.

### 1.1: Toast HTML & CSS

Add to `index.html`:
```html
<div id="toast-container"></div>
```

<details>
<summary>💡 Hint: Toast styles</summary>

```css
#toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  padding: 12px 20px;
  border-radius: 8px;
  color: white;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  animation: slideDown 0.3s ease;
  min-width: 250px;
  text-align: center;
}

.toast.error { background: #e74c3c; }
.toast.success { background: #2ecc71; }
.toast.info { background: #3498db; }

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```
</details>

### 1.2: Toast Function

<details>
<summary>💡 Hint: showToast function</summary>

```js
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```
</details>

**Test it:**
```js
showToast("Welcome!", "success");
showToast("Error occurred", "error");
showToast("Loading...", "info");
```

---

## Step 2: Loading States

**Goal:** Show spinners during async operations.

### 2.1: Spinner CSS

<details>
<summary>💡 Hint: Spinner styles</summary>

```css
.spinner {
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 0.8s linear infinite;
  display: inline-block;
  margin: 0 auto;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading {
  position: relative;
  pointer-events: none;
  opacity: 0.6;
}

.loading::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 0.8s linear infinite;
}
```
</details>

### 2.2: Loading Helper Functions

```js
function setLoading(elementId, isLoading) {
  const element = document.getElementById(elementId);
  if (isLoading) {
    element.classList.add("loading");
    element.disabled = true;
  } else {
    element.classList.remove("loading");
    element.disabled = false;
  }
}
```

**Usage:**
```js
setLoading("draw-btn", true);  // Show spinner
setTimeout(() => setLoading("draw-btn", false), 1000);  // Hide after 1s
```

---

## Step 3: Enhanced Error Handling

**Goal:** Map server errors to user-friendly messages.

### 3.1: Error Message Mapping

<details>
<summary>💡 Hint: Error handler</summary>

```js
const ERROR_MESSAGES = {
  "NOT_YOUR_TURN": "It's not your turn yet!",
  "INVALID_CARD": "That card can't be played right now",
  "ROOM_NOT_FOUND": "Room doesn't exist. Check the code?",
  "ROOM_FULL": "Room is full (max 6 players)",
  "GAME_STARTED": "Game already started",
  "MIN_PLAYERS": "Need at least 3 players to start"
};

function handleError(error) {
  const message = ERROR_MESSAGES[error.code] || error.message || "Something went wrong";
  showToast(message, "error");
}
```
</details>

### 3.2: Update Server Errors

In `server.js`, send error codes:

```js
ws.send(JSON.stringify({
  type: "error",
  code: "NOT_YOUR_TURN",
  message: "Wait for your turn"
}));
```

---

## Step 4: Reconnection Logic

**Goal:** Automatically reconnect when connection drops.

### 4.1: Connection State Management

<details>
<summary>💡 Hint: Reconnection system</summary>

```js
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectTimeout = null;

function connect() {
  ws = new WebSocket("ws://localhost:3000/ws");

  ws.onopen = () => {
    console.log("Connected");
    reconnectAttempts = 0;
    hideReconnectOverlay();

    // Resume session if reconnecting
    const playerId = sessionStorage.getItem("playerId");
    const roomCode = sessionStorage.getItem("roomCode");

    if (playerId && roomCode) {
      ws.send(JSON.stringify({
        action: "reconnect",
        playerId,
        roomCode
      }));
    }
  };

  ws.onclose = () => {
    console.log("Disconnected");
    showReconnectOverlay();
    attemptReconnect();
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onmessage = handleMessage;
}

function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    showToast("Connection lost. Please refresh.", "error");
    return;
  }

  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 16000);
  reconnectAttempts++;

  reconnectTimeout = setTimeout(() => {
    console.log(`Reconnecting... (attempt ${reconnectAttempts})`);
    connect();
  }, delay);
}
```
</details>

### 4.2: Reconnect Overlay

Add to HTML:
```html
<div id="reconnect-overlay" style="display:none">
  <div class="overlay-content">
    <div class="spinner"></div>
    <p>Reconnecting...</p>
  </div>
</div>
```

<details>
<summary>💡 Hint: Overlay functions</summary>

```js
function showReconnectOverlay() {
  document.getElementById("reconnect-overlay").style.display = "flex";
}

function hideReconnectOverlay() {
  document.getElementById("reconnect-overlay").style.display = "none";
}
```
</details>

### 4.3: Session Persistence

Save player info to resume on reconnect:

```js
// When room created/joined:
sessionStorage.setItem("playerId", msg.playerId);
sessionStorage.setItem("roomCode", msg.roomCode);

// When leaving room:
sessionStorage.removeItem("playerId");
sessionStorage.removeItem("roomCode");
```

---

## Step 5: Optimistic UI Updates

**Goal:** Update UI immediately, rollback if server rejects.

### 5.1: Optimistic Card Play

<details>
<summary>💡 Hint: Optimistic update pattern</summary>

```js
let pendingAction = null;

function playCardOptimistic(cardIndex, chosenColor) {
  const hand = getCurrentHand();
  const card = hand[cardIndex];

  // Save current state for rollback
  pendingAction = {
    type: "play",
    card: card,
    handCopy: [...hand]
  };

  // Optimistically remove from hand
  hand.splice(cardIndex, 1);
  renderHand(hand);

  // Send to server
  ws.send(JSON.stringify({
    action: "play",
    cardIndex,
    chosenColor
  }));

  // Timeout rollback if no response in 5s
  setTimeout(() => {
    if (pendingAction) {
      rollbackOptimisticUpdate();
      showToast("Request timed out", "error");
    }
  }, 5000);
}

function rollbackOptimisticUpdate() {
  if (!pendingAction) return;

  // Restore previous state
  if (pendingAction.type === "play") {
    renderHand(pendingAction.handCopy);
  }

  pendingAction = null;
}

// On successful server response:
function onPlaySuccess() {
  pendingAction = null; // Clear pending action
}

// On server error:
function onPlayError(error) {
  rollbackOptimisticUpdate();
  handleError(error);
}
```
</details>

---

## Step 6: Connection Status Indicator

**Goal:** Show connection state in UI.

### 6.1: Status Dot HTML

Add to game header:
```html
<span id="connection-status" class="status-dot connected"></span>
```

### 6.2: Status Styles

```css
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  margin-left: 8px;
}

.status-dot.connected { background: #2ecc71; }
.status-dot.connecting { background: #f1c40f; }
.status-dot.disconnected { background: #e74c3c; }
```

### 6.3: Update Status

```js
function updateConnectionStatus(status) {
  const dot = document.getElementById("connection-status");
  dot.className = `status-dot ${status}`;
}

// In WebSocket handlers:
ws.onopen = () => {
  updateConnectionStatus("connected");
  // ...
};

ws.onclose = () => {
  updateConnectionStatus("disconnected");
  // ...
};

// During reconnect:
function attemptReconnect() {
  updateConnectionStatus("connecting");
  // ...
}
```

---

## Step 7: Complete Game Client

**Goal:** Wire up all interactions.

### 7.1: Card Click Handler

<details>
<summary>💡 Hint: Card interaction</summary>

```js
function onCardClick(cardIndex, card) {
  // Check if it's your turn
  if (gameState.currentPlayerId !== myPlayerId) {
    showToast("Not your turn!", "error");
    return;
  }

  // Wild card needs color choice
  if (card.type === "wild") {
    showColorPicker(cardIndex);
    return;
  }

  // Play card
  setLoading("hand-cards", true);
  playCardOptimistic(cardIndex);
}

function showColorPicker(cardIndex) {
  // Show modal with color buttons
  const modal = document.getElementById("color-picker-modal");
  modal.style.display = "flex";

  document.querySelectorAll(".color-choice").forEach(btn => {
    btn.onclick = () => {
      const color = btn.dataset.color;
      modal.style.display = "none";
      playCardOptimistic(cardIndex, color);
    };
  });
}
```
</details>

### 7.2: Draw Card Handler

```js
document.getElementById("draw-btn").onclick = () => {
  if (gameState.currentPlayerId !== myPlayerId) {
    showToast("Not your turn!", "error");
    return;
  }

  setLoading("draw-btn", true);

  ws.send(JSON.stringify({ action: "draw" }));
};
```

### 7.3: Game State Renderer

<details>
<summary>💡 Hint: Full state rendering</summary>

```js
let gameState = null;
let myPlayerId = null;

function handleMessage(event) {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case "state":
      gameState = msg.gameState;
      myPlayerId = msg.yourPlayerId;
      renderGameState();
      setLoading("hand-cards", false);
      setLoading("draw-btn", false);
      onPlaySuccess(); // Clear optimistic update
      break;

    case "error":
      setLoading("hand-cards", false);
      setLoading("draw-btn", false);
      onPlayError(msg);
      break;

    case "cardDrawn":
      showToast(`Drew ${msg.cards.length} card(s)`, "info");
      break;

    // ... other cases
  }
}

function renderGameState() {
  if (!gameState) return;

  // Turn indicator
  const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
  const isYourTurn = gameState.currentPlayerId === myPlayerId;

  document.getElementById("turn-indicator").textContent =
    isYourTurn ? "YOUR TURN" : `${currentPlayer.name}'s turn`;

  // Top card
  const topCardEl = document.getElementById("top-card");
  topCardEl.innerHTML = "";
  topCardEl.appendChild(renderCard(gameState.topCard));

  // Pending draws alert
  const alertEl = document.getElementById("pending-alert");
  if (gameState.pendingDraws > 0) {
    alertEl.style.display = "block";
    alertEl.textContent = `⚠️ +${gameState.pendingDraws} cards pending!`;
  } else {
    alertEl.style.display = "none";
  }

  // Your hand
  const you = gameState.players.find(p => p.id === myPlayerId);
  if (you && you.hand) {
    renderHand(you.hand);
  }

  // Opponents
  renderOpponents(gameState.players.filter(p => p.id !== myPlayerId));

  // Winner
  if (gameState.winner) {
    const winner = gameState.players.find(p => p.id === gameState.winner);
    showToast(`🎉 ${winner.name} wins!`, "success");
  }
}
```
</details>

---

## Checkpoint: Test Everything

**Scenarios to Test:**

1. **Normal Play:**
   - Create room, join with 2 others, start game
   - Play cards, draw cards
   - Verify smooth interactions

2. **Error Handling:**
   - Try playing out of turn → see error toast
   - Try playing invalid card → see error toast
   - Errors should be user-friendly

3. **Loading States:**
   - Click draw → button shows spinner
   - Click card → hand shows loading overlay
   - Loading clears when response arrives

4. **Reconnection:**
   - Start game
   - Disable network in DevTools
   - See "Reconnecting..." overlay
   - Re-enable network
   - Verify reconnection and game resumes

5. **Optimistic Updates:**
   - Play card on slow network (throttle in DevTools)
   - Card immediately disappears from hand
   - If server rejects, card reappears

---

## What You Built

- ✅ Toast notification system
- ✅ Loading spinners and states
- ✅ User-friendly error messages
- ✅ Automatic reconnection (exponential backoff)
- ✅ Session persistence
- ✅ Optimistic UI updates
- ✅ Connection status indicator
- ✅ Complete game client integration

## Next Steps

Phase 6 will add:
- CSS animations (card slide, flip)
- Haptic feedback
- Sound effects
- Accessibility (ARIA labels, keyboard nav)
- Mobile UX polish

Questions:
- Why use optimistic updates?
- How does exponential backoff work?
- When should errors be shown vs. logged?
- Why persist session in sessionStorage?

Ready for Phase 6 (animations and polish)? Or want to add more features like turn timer, chat, or custom themes?
