# Phase 5: Interactivity & Polish — Technical Plan

**STATUS: TENTATIVE** — This plan will be refined when Phase 5 begins.

## Goal

Wire up complete WebSocket client logic, add real-time state synchronization, improve UX with loading states, error handling, reconnection logic, and smooth interactions. Make the game feel responsive and reliable.

## Depends On

- **Phase 4 Complete:** Basic UI layout, game board, lobby screen

## Files to Modify

### 1. `public/game-client.ts` — Enhanced WebSocket Client (MODIFY)

**Note:** Frontend features (optimistic UI, toasts, loading states) will be handled by Claude Code.

**New Features:**

- **Automatic reconnection:**
  - Detect WebSocket disconnection
  - Show "Reconnecting..." overlay
  - Attempt reconnect with exponential backoff
  - Resume game state on reconnect
  - Handle stale state (server restarted, room gone)

- **Optimistic UI updates:**
  - Immediately update UI when you play a card (don't wait for server)
  - Rollback if server rejects (show error + restore previous state)
  - Reduces perceived latency

- **Loading states:**
  - Show spinner when drawing card
  - Disable play buttons while waiting for server response
  - Show "Waiting for server..." during high latency

- **Error handling:**
  - Display error messages in toast notifications (top of screen)
  - Auto-dismiss after 3 seconds
  - Specific messages: "Not your turn", "Invalid card", "Connection lost", etc.

**Key Functions to Add:**
```ts
function reconnect(): void
function showToast(message: string, type: "error" | "success" | "info"): void
function enableInteraction(): void
function disableInteraction(): void
function validateLocalState(): boolean
```

### 2. `public/lobby.ts` — Enhanced Lobby Client (MODIFY)

**Note:** Frontend features (animations, clipboard) will be handled by Claude Code.

**New Features:**

- **Room code validation:**
  - Auto-uppercase input (ABXY, not abxy)
  - Validate 4-character format before sending
  - Show error if invalid

- **Connection status indicator:**
  - Green dot: connected
  - Yellow dot: connecting
  - Red dot: disconnected
  - Display in top-right corner

- **Player join/leave animations:**
  - Fade in when player joins
  - Fade out when player leaves
  - Brief toast: "Alice joined" / "Bob left"

- **Copy room code button:**
  - Click to copy room code to clipboard
  - Show "Copied!" feedback

**Key Functions to Add:**
```ts
function copyRoomCode(): void
function validateRoomCodeInput(code: string): boolean
function updateConnectionStatus(status: "connected" | "connecting" | "disconnected"): void
```

### 3. `server.ts` — Enhanced Error Responses (MODIFY)

**Improved Error Messages:**

Current errors are generic ("Room not found"). Provide specific codes:

```json
{
  "type": "error",
  "code": "ROOM_NOT_FOUND",
  "message": "Room code ABXY does not exist"
}
```

```json
{
  "type": "error",
  "code": "NOT_YOUR_TURN",
  "message": "Wait for your turn"
}
```

```json
{
  "type": "error",
  "code": "INVALID_CARD",
  "message": "Card doesn't match color or number"
}
```

**Client can map codes to user-friendly messages:**
- `ROOM_NOT_FOUND` → "Room doesn't exist. Check the code?"
- `NOT_YOUR_TURN` → "It's not your turn yet"
- `INVALID_CARD` → "That card can't be played right now"

### 4. `public/styles.css` — Loading & Toast Styles (MODIFY)

**Note:** Frontend styling will be handled by Claude Code.

**New Components:**

```css
/* Toast Notifications */
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  z-index: 1000;
  animation: slideDown 0.3s ease;
}

.toast.error { background: #e74c3c; color: white; }
.toast.success { background: #2ecc71; color: white; }
.toast.info { background: #3498db; color: white; }

/* Loading Spinner */
.spinner {
  border: 3px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 0.8s linear infinite;
}

/* Reconnecting Overlay */
#reconnect-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* Connection Status Dot */
.connection-status {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}

.connection-status.connected { background: #2ecc71; }
.connection-status.connecting { background: #f1c40f; }
.connection-status.disconnected { background: #e74c3c; }
```

### 5. Reconnection Logic (NEW)

**WebSocket Reconnection Strategy:**

1. **Detect disconnect:**
   - `ws.onclose` event fires
   - Show "Reconnecting..." overlay

2. **Exponential backoff:**
   - Retry after 1s, 2s, 4s, 8s, 16s (max 16s)
   - Max 10 attempts
   - After 10 failures, show "Connection lost" with manual retry button

3. **Resume state:**
   - On reconnect, send `{ action: "reconnect", playerId, roomCode }`
   - Server sends latest game state
   - Client re-renders from state

4. **Handle edge cases:**
   - Server restarted (room gone) → Show "Room no longer exists" + redirect to lobby
   - Player kicked → Show "Removed from room" + redirect to lobby

**Implementation in `game-client.ts`:**

**Note:** Frontend reconnection logic will be handled by Claude Code.

```ts
let reconnectAttempts: number = 0;
const maxReconnectAttempts: number = 10;

function reconnect(): void {
  if (reconnectAttempts >= maxReconnectAttempts) {
    showReconnectFailure();
    return;
  }

  const delay: number = Math.min(1000 * Math.pow(2, reconnectAttempts), 16000);
  reconnectAttempts++;

  setTimeout(() => {
    connectWebSocket();
  }, delay);
}

ws.onclose = (): void => {
  showReconnectingOverlay();
  reconnect();
};

ws.onopen = (): void => {
  reconnectAttempts = 0;
  hideReconnectingOverlay();
  // Send reconnect action if returning to active game
  if (sessionStorage.playerId && sessionStorage.roomCode) {
    ws.send(JSON.stringify({
      action: "reconnect",
      playerId: sessionStorage.playerId,
      roomCode: sessionStorage.roomCode
    }));
  }
};
```

### 6. `game-logic.ts` — Reconnection Support (MODIFY)

**New Function:**

- `reconnectPlayer(roomCode: string, playerId: string): GameState`
  - Mark player as `connected: true`
  - Return current game state for client sync
  - Broadcast to room that player reconnected

**Server Message Handler:**

```ts
case "reconnect":
  const state: GameState = gameLogic.reconnectPlayer(data.roomCode, data.playerId);
  ws.send(JSON.stringify({ type: "state", gameState: state, yourPlayerId: data.playerId }));
  server.publish(data.roomCode, JSON.stringify({
    type: "playerReconnected",
    playerId: data.playerId,
    playerName: ws.data.playerName
  }));
  break;
```

## Testing & Verification

### Manual Testing Steps

1. **Reconnection:**
   - Start game on mobile
   - Turn off WiFi for 5 seconds
   - Turn WiFi back on
   - Verify reconnection overlay appears → disappears
   - Verify game state resumes correctly

2. **Toast notifications:**
   - Try to play out of turn → see error toast
   - Play invalid card → see error toast
   - Successfully play card → see success toast (optional)

3. **Loading states:**
   - Click draw card
   - Verify spinner appears on draw pile
   - Verify card appears in hand after draw

4. **Optimistic UI:**
   - Play a card (fast connection)
   - Verify card immediately moves to discard (before server responds)
   - Simulate slow network (DevTools throttling)
   - Verify rollback if server rejects

5. **Copy room code:**
   - Click copy button in lobby
   - Paste into another app
   - Verify room code copied correctly

6. **Connection status indicator:**
   - Lobby screen shows green dot
   - Disconnect internet → yellow dot (reconnecting)
   - After 10 failed attempts → red dot (disconnected)

### Edge Cases to Test

- Server restart mid-game (room lost) → redirect to lobby
- Multiple tabs open with same player → second tab kicked
- WiFi connection drops during card play
- Slow 3G network (use DevTools throttling)

## Success Criteria

- ✅ Automatic reconnection works (exponential backoff)
- ✅ Reconnection overlay shown during disconnect
- ✅ Toast notifications for errors and successes
- ✅ Loading spinners during async operations
- ✅ Optimistic UI updates (immediate card play)
- ✅ Copy room code to clipboard works
- ✅ Connection status indicator accurate (green/yellow/red)
- ✅ Error messages user-friendly and specific
- ✅ Game state syncs correctly after reconnect
- ✅ Stale state handled gracefully (redirect to lobby)

## What's NOT in Phase 5

- CSS animations (card slide, flip)
- Sound effects
- Advanced gestures (swipe to play)
- Turn timer
- Chat system
- Spectator mode

These are future enhancements. Phase 5 focuses on making the core interaction robust and responsive.
