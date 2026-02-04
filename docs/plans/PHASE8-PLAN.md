# Phase 8: Admin Panel & Advanced Features — Technical Plan

**STATUS: TENTATIVE** — This plan will be refined when Phase 8 begins.

## Goal

Add an admin panel for game configuration: feature toggles, custom rule adjustments, room management tools, and debug utilities. Accessed via secret password route. Optional enhancements like spectator mode, chat, and analytics dashboard.

## Depends On

- **Phase 7 Complete:** Deployment, testing, stable production version

## Files to Create/Modify

### 1. Admin Authentication & Route

**Secret Password Route:**

```js
// In server.js
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "insane8admin";

// Add HTTP route
if (req.url.startsWith('/admin')) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const password = url.searchParams.get('password');

  if (password !== ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  return new Response(Bun.file('./public/admin.html'));
}
```

**Access URL:**
```
https://abc123.ngrok.io/admin?password=insane8admin
```

**Security Note:**
- This is a lightweight protection (not production-grade auth)
- Sufficient for private games among friends
- Don't expose ADMIN_PASSWORD in public repos (use `.env`)

### 2. `public/admin.html` — Admin Panel UI (NEW)

**Features:**

1. **Active Rooms Dashboard:**
   - List all active rooms (code, player count, status)
   - Click to view room details
   - Kick player button
   - End game button
   - Delete room button

2. **Feature Toggles:**
   - Enable/disable plus-stacking
   - Enable/disable reverse limit
   - Adjust skip behavior (1 player vs. 2 players)
   - Enable/disable wild cards
   - Adjust max room size (3-10 players)

3. **Rule Customization:**
   - Starting hand size (default: 7, range: 3-10)
   - Plus-card values (+2, +4, +20 → adjustable)
   - Reverse stack limit (default: 4, range: 2-10)
   - Skip count (default: 2, range: 1-5)

4. **Metrics & Analytics:**
   - Total rooms created (session)
   - Total games played (session)
   - Active players count
   - Average game duration
   - Most played card type
   - Error rate

5. **Debug Tools:**
   - Force reconnect all players in room
   - Simulate disconnect
   - Reset game state
   - View raw room data (JSON)

**UI Structure:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Panel - Insane Crazy 8</title>
  <link rel="stylesheet" href="admin-styles.css">
</head>
<body>
  <div id="admin-panel">
    <h1>🔧 Admin Panel</h1>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active" data-tab="rooms">Rooms</button>
      <button class="tab" data-tab="settings">Settings</button>
      <button class="tab" data-tab="metrics">Metrics</button>
      <button class="tab" data-tab="debug">Debug</button>
    </div>

    <!-- Rooms Tab -->
    <div id="rooms-tab" class="tab-content active">
      <h2>Active Rooms</h2>
      <div id="rooms-list">
        <!-- Dynamically populated -->
        <div class="room-card">
          <div class="room-header">
            <span class="room-code">ABXY</span>
            <span class="room-status playing">Playing</span>
          </div>
          <div class="room-players">
            <p>Players: Alice (😎), Bob (🔥), Charlie (👻)</p>
          </div>
          <div class="room-actions">
            <button class="view-details">View Details</button>
            <button class="end-game">End Game</button>
            <button class="delete-room">Delete Room</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Settings Tab -->
    <div id="settings-tab" class="tab-content">
      <h2>Game Settings</h2>
      <form id="settings-form">
        <label>
          <input type="checkbox" id="plus-stacking" checked>
          Enable Plus-Stacking
        </label>

        <label>
          <input type="checkbox" id="reverse-limit" checked>
          Reverse Stack Limit
        </label>

        <label>
          Skip Count:
          <input type="number" id="skip-count" min="1" max="5" value="2">
        </label>

        <label>
          Starting Hand Size:
          <input type="number" id="hand-size" min="3" max="10" value="7">
        </label>

        <label>
          Max Room Size:
          <input type="number" id="max-room-size" min="3" max="10" value="6">
        </label>

        <button type="submit">Save Settings</button>
      </form>
    </div>

    <!-- Metrics Tab -->
    <div id="metrics-tab" class="tab-content">
      <h2>Metrics</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <h3>Total Rooms</h3>
          <p class="metric-value" id="total-rooms">42</p>
        </div>
        <div class="metric-card">
          <h3>Active Players</h3>
          <p class="metric-value" id="active-players">18</p>
        </div>
        <div class="metric-card">
          <h3>Games Played</h3>
          <p class="metric-value" id="games-played">35</p>
        </div>
        <div class="metric-card">
          <h3>Error Rate</h3>
          <p class="metric-value" id="error-rate">2.3%</p>
        </div>
      </div>
    </div>

    <!-- Debug Tab -->
    <div id="debug-tab" class="tab-content">
      <h2>Debug Tools</h2>
      <div class="debug-actions">
        <button id="log-all-rooms">Log All Rooms</button>
        <button id="clear-metrics">Clear Metrics</button>
        <button id="simulate-disconnect">Simulate Disconnect</button>
      </div>

      <h3>Raw Room Data</h3>
      <textarea id="room-json" rows="20" readonly></textarea>
    </div>
  </div>

  <script src="admin-client.js"></script>
</body>
</html>
```

### 3. `server.js` — Admin WebSocket Endpoints (MODIFY)

**New WebSocket Actions:**

```js
// Admin-only actions
case "adminListRooms":
  if (!isAdmin(ws)) return sendError("Unauthorized");
  const rooms = room-manager.getAllRooms();
  ws.send(JSON.stringify({ type: "roomsList", rooms }));
  break;

case "adminKickPlayer":
  if (!isAdmin(ws)) return sendError("Unauthorized");
  const { roomCode, playerId } = data;
  room-manager.kickPlayer(roomCode, playerId);
  server.publish(roomCode, JSON.stringify({
    type: "playerKicked",
    playerId,
    reason: "Removed by admin"
  }));
  break;

case "adminEndGame":
  if (!isAdmin(ws)) return sendError("Unauthorized");
  room-manager.endGame(data.roomCode);
  server.publish(data.roomCode, JSON.stringify({
    type: "gameEnded",
    reason: "Ended by admin"
  }));
  break;

case "adminDeleteRoom":
  if (!isAdmin(ws)) return sendError("Unauthorized");
  room-manager.deleteRoom(data.roomCode);
  break;

case "adminUpdateSettings":
  if (!isAdmin(ws)) return sendError("Unauthorized");
  gameSettings.update(data.settings);
  ws.send(JSON.stringify({ type: "settingsUpdated" }));
  break;
```

**Admin Auth Check:**

```js
function isAdmin(ws) {
  return ws.data.isAdmin === true;
}

// Set on WebSocket upgrade from /admin page
server.upgrade(req, {
  data: {
    isAdmin: req.url.includes('/admin'),
    // ... other fields
  }
});
```

### 4. `game-settings.js` — Configurable Rules (NEW)

**Centralized Settings Object:**

```js
const settings = {
  plusStacking: true,
  reverseLimitEnabled: true,
  reverseStackMax: 4,
  skipCount: 2,
  startingHandSize: 7,
  maxRoomSize: 6,
  wildCardsEnabled: true
};

export function getSettings() {
  return { ...settings };  // Return copy
}

export function updateSettings(newSettings) {
  Object.assign(settings, newSettings);
  console.log("Settings updated:", settings);
}

export function resetToDefaults() {
  settings.plusStacking = true;
  settings.reverseLimitEnabled = true;
  settings.reverseStackMax = 4;
  settings.skipCount = 2;
  settings.startingHandSize = 7;
  settings.maxRoomSize = 6;
  settings.wildCardsEnabled = true;
}
```

**Use in `game-logic.js`:**

```js
import { getSettings } from './game-settings.js';

function startGame(room) {
  const settings = getSettings();
  const handSize = settings.startingHandSize;

  // Deal cards based on settings
  room.players.forEach(player => {
    player.hand = Array(handSize).fill(null).map(() => generateCard());
  });
}

function canPlayCard(card, topCard, room) {
  const settings = getSettings();

  if (room.pendingDraws > 0 && !settings.plusStacking) {
    return isPlusCard(card);  // Must play +card if stacking disabled
  }

  // ... rest of logic
}
```

### 5. `public/admin-client.js` — Admin Client Logic (NEW)

**Responsibilities:**

- Connect to WebSocket with admin flag
- Fetch and display room list
- Handle settings form submission
- Display metrics (poll every 5 seconds)
- Debug actions (log rooms, clear metrics, etc.)

**Key Functions:**

```js
function fetchRooms() {
  ws.send(JSON.stringify({ action: "adminListRooms" }));
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "roomsList") {
    renderRoomsList(data.rooms);
  }

  if (data.type === "metrics") {
    updateMetricsDisplay(data.metrics);
  }
};

function renderRoomsList(rooms) {
  const container = document.getElementById('rooms-list');
  container.innerHTML = rooms.map(room => `
    <div class="room-card">
      <div class="room-header">
        <span class="room-code">${room.roomCode}</span>
        <span class="room-status ${room.gameStatus}">${room.gameStatus}</span>
      </div>
      <div class="room-players">
        <p>Players: ${room.players.map(p => `${p.name} (${p.avatar})`).join(', ')}</p>
      </div>
      <div class="room-actions">
        <button onclick="endGame('${room.roomCode}')">End Game</button>
        <button onclick="deleteRoom('${room.roomCode}')">Delete Room</button>
      </div>
    </div>
  `).join('');
}

function endGame(roomCode) {
  if (confirm(`End game in room ${roomCode}?`)) {
    ws.send(JSON.stringify({ action: "adminEndGame", roomCode }));
  }
}
```

## Optional Features (Time Permitting)

### 1. Spectator Mode

**Concept:**
- Allow non-players to join room as spectators
- View game state in real-time (all cards visible)
- No interaction (read-only)

**Implementation:**

- Add `spectators` array to room object
- Join action with `role: "spectator"`
- Broadcast full state to spectators (including all hands)
- Display spectator count in UI

### 2. Chat System

**Simple text chat in game screen:**

```js
// WebSocket message
{ action: "chat", message: "Good game!" }

// Broadcast to room
{ type: "chat", playerId: "p_abc", playerName: "Alice", message: "Good game!" }
```

**UI:**
- Chat toggle button (bottom-right)
- Slide-up panel with message history
- Input field + send button
- Auto-scroll to latest message

### 3. Turn Timer

**Add countdown timer per turn:**

- 30-second timer starts when turn begins
- Visual countdown in UI (circular progress bar)
- Auto-draw if time expires
- Broadcast time remaining to all players

**Implementation:**

```js
// In game-logic.js
function startTurn(room, playerId) {
  room.turnStartTime = Date.now();
  room.turnDuration = 30000;  // 30 seconds

  // Check timer every second
  const interval = setInterval(() => {
    const elapsed = Date.now() - room.turnStartTime;
    const remaining = room.turnDuration - elapsed;

    if (remaining <= 0) {
      clearInterval(interval);
      autoDrawCard(room, playerId);  // Force draw
    }
  }, 1000);
}
```

### 4. Game History & Replay

**Record game events for replay:**

```js
const gameHistory = {
  roomCode: "ABXY",
  players: [...],
  events: [
    { type: "gameStarted", timestamp: 1234567890 },
    { type: "cardPlayed", playerId: "p_abc", card: {...}, timestamp: 1234567891 },
    { type: "cardDrawn", playerId: "p_def", timestamp: 1234567892 },
    // ...
  ]
};
```

**Admin panel feature:**
- View past games (stored in memory for session)
- Replay game step-by-step
- Export to JSON for sharing

## Testing & Verification

### Manual Testing Steps

1. **Access admin panel:**
   - Navigate to `/admin?password=insane8admin`
   - Verify auth required (try wrong password)

2. **Room management:**
   - Create 3 test rooms
   - View room list in admin panel
   - End game in one room → verify players notified
   - Delete room → verify players kicked

3. **Settings adjustment:**
   - Change skip count to 3
   - Start new game
   - Play skip card → verify skips 3 players

4. **Metrics tracking:**
   - Play multiple games
   - Check metrics tab for accurate counts
   - Clear metrics → verify reset

5. **Debug tools:**
   - Log all rooms → check console output
   - View raw JSON → verify data structure

## Success Criteria

- ✅ Admin panel accessible via password route
- ✅ Room list displays all active rooms
- ✅ Settings can be changed and applied to new games
- ✅ Metrics tracked accurately
- ✅ Debug tools functional
- ✅ Kick/end/delete actions work
- ✅ Admin actions require authentication
- ✅ UI clean and usable on desktop

## Future Enhancements (Beyond Phase 8)

- User accounts (save stats across sessions)
- Leaderboards (win rate, games played)
- Custom card backs/themes
- Tournament mode (bracket system)
- Achievements (play 100 games, win with 1 card left, etc.)
- Push notifications (when it's your turn)
- Progressive Web App (full offline support)
- Cloud deployment (DigitalOcean, Fly.io, Railway)
- Database persistence (Redis, SQLite)

Phase 8 completes the core feature set. Further development depends on user feedback and demand.
