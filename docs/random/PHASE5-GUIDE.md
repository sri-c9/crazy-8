# Phase 5: Backend Polish — Error Handling & Reconnection

This phase focuses on backend improvements for robust error handling and player reconnection. Frontend interactivity and UI polish is handled by Claude Code.

## Before You Start

**Prerequisites:**
- Phase 4 complete (UI structure understood)
- Backend game logic working (Phases 1-3)
- Understanding of WebSocket lifecycle

**What You'll Build:**
- Error code system for user-friendly messages
- Player reconnection handler in server
- Session resume logic in room-manager

---

## Step 1: Error Code Mapping in Server

**Goal:** Send structured error codes instead of raw error messages.

### 1.1: Define Error Codes in `server.ts`

```ts
const ERROR_CODES = {
  NOT_YOUR_TURN: "NOT_YOUR_TURN",
  INVALID_CARD: "INVALID_CARD",
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_FULL: "ROOM_FULL",
  GAME_STARTED: "GAME_STARTED",
  MIN_PLAYERS: "MIN_PLAYERS",
  NOT_HOST: "NOT_HOST",
  NOT_IN_ROOM: "NOT_IN_ROOM"
} as const;

type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
```

### 1.2: Update Error Handlers

Modify all catch blocks to send error codes:

```ts
function handleCreate(ws: ServerWebSocket<WebSocketData>, msg: IncomingMessage) {
  try {
    // ... existing logic
  } catch (error) {
    const errorMessage = (error as Error).message;
    let errorCode: ErrorCode = "ROOM_NOT_FOUND"; // default

    // Map error messages to codes
    if (errorMessage.includes("Room is full")) {
      errorCode = ERROR_CODES.ROOM_FULL;
    } else if (errorMessage.includes("Not your turn")) {
      errorCode = ERROR_CODES.NOT_YOUR_TURN;
    } else if (errorMessage.includes("doesn't match")) {
      errorCode = ERROR_CODES.INVALID_CARD;
    } else if (errorMessage.includes("Game already started")) {
      errorCode = ERROR_CODES.GAME_STARTED;
    } else if (errorMessage.includes("Need at least")) {
      errorCode = ERROR_CODES.MIN_PLAYERS;
    } else if (errorMessage.includes("Only host")) {
      errorCode = ERROR_CODES.NOT_HOST;
    } else if (errorMessage.includes("Not in a room")) {
      errorCode = ERROR_CODES.NOT_IN_ROOM;
    }

    ws.send(JSON.stringify({
      type: "error",
      code: errorCode,
      message: errorMessage
    }));
  }
}
```

**Better approach:** Create a helper function:

```ts
function sendError(ws: ServerWebSocket<WebSocketData>, error: Error) {
  const message = error.message;
  let code: ErrorCode = "ROOM_NOT_FOUND";

  if (message.includes("full")) code = ERROR_CODES.ROOM_FULL;
  else if (message.includes("turn")) code = ERROR_CODES.NOT_YOUR_TURN;
  else if (message.includes("match")) code = ERROR_CODES.INVALID_CARD;
  else if (message.includes("started")) code = ERROR_CODES.GAME_STARTED;
  else if (message.includes("3 players")) code = ERROR_CODES.MIN_PLAYERS;
  else if (message.includes("host")) code = ERROR_CODES.NOT_HOST;
  else if (message.includes("Not in")) code = ERROR_CODES.NOT_IN_ROOM;

  ws.send(JSON.stringify({ type: "error", code, message }));
}

// Usage:
try {
  // ... logic
} catch (error) {
  sendError(ws, error as Error);
}
```

---

## Step 2: Reconnection Handler in Server

**Goal:** Allow players to reconnect to their room after disconnect.

### 2.1: Add Reconnection Message Handler

In `server.ts`, add a new case to the message router:

```ts
interface IncomingMessage {
  action: string;
  playerName?: string;
  avatar?: string;
  roomCode?: string;
  cardIndex?: number;
  chosenColor?: CardColor;
  playerId?: string; // For reconnection
}

// In message handler:
case "reconnect":
  handleReconnect(ws, msg);
  break;
```

### 2.2: Implement `handleReconnect`

```ts
function handleReconnect(ws: ServerWebSocket<WebSocketData>, msg: IncomingMessage) {
  try {
    if (!msg.playerId || !msg.roomCode) {
      throw new Error("Missing playerId or roomCode");
    }

    const success = reconnectPlayer(msg.roomCode, msg.playerId);

    if (!success) {
      throw new Error("Could not reconnect - room may have ended");
    }

    // Get player info from room
    const room = getRoom(msg.roomCode);
    if (!room) {
      throw new Error("Room not found");
    }

    const player = room.players.get(msg.playerId);
    if (!player) {
      throw new Error("Player not in room");
    }

    // Update WebSocket data
    ws.data.playerId = msg.playerId;
    ws.data.playerName = player.name;
    ws.data.avatar = player.avatar;
    ws.data.roomCode = msg.roomCode;

    // Subscribe to room topic
    ws.subscribe(msg.roomCode);

    // Send reconnection success
    ws.send(JSON.stringify({
      type: "reconnected",
      roomCode: msg.roomCode,
      playerId: msg.playerId
    }));

    // Broadcast updated player list
    server.publish(msg.roomCode, JSON.stringify({
      type: "playerList",
      players: getRoomPlayerList(msg.roomCode)
    }));

    // If game in progress, send game state
    if (room.gameStatus === "playing") {
      broadcastGameState(msg.roomCode);
    }
  } catch (error) {
    sendError(ws, error as Error);
  }
}
```

---

## Step 3: Reconnection Logic in Room Manager

**Goal:** Track disconnected players and allow reconnection.

### 3.1: Add `disconnectPlayer` Function

In `room-manager.ts`:

```ts
export function disconnectPlayer(roomCode: string, playerId: string): void {
  const room = rooms.get(roomCode);
  if (!room) return;

  const player = room.players.get(playerId);
  if (!player) return;

  // Mark as disconnected (don't remove)
  player.connected = false;

  console.log(`Player ${playerId} disconnected from ${roomCode}`);
}
```

### 3.2: Add `reconnectPlayer` Function

```ts
export function reconnectPlayer(roomCode: string, playerId: string): boolean {
  const room = rooms.get(roomCode);
  if (!room) return false;

  const player = room.players.get(playerId);
  if (!player) return false;

  // Mark as connected
  player.connected = true;

  console.log(`Player ${playerId} reconnected to ${roomCode}`);
  return true;
}
```

### 3.3: Update `close` Handler in Server

Change the WebSocket `close` handler to disconnect instead of leave:

```ts
close(ws: ServerWebSocket<WebSocketData>) {
  if (ws.data.roomCode && ws.data.playerId) {
    // Disconnect instead of leaving
    disconnectPlayer(ws.data.roomCode, ws.data.playerId);
    ws.unsubscribe(ws.data.roomCode);

    // Broadcast updated player list
    server.publish(ws.data.roomCode, JSON.stringify({
      type: "playerList",
      players: getRoomPlayerList(ws.data.roomCode)
    }));

    console.log(`Player ${ws.data.playerId} disconnected from ${ws.data.roomCode}`);
  }
}
```

### 3.4: Add Cleanup for Abandoned Rooms

Add a periodic cleanup to remove rooms where all players are disconnected:

```ts
// In room-manager.ts

export function cleanupAbandonedRooms(): number {
  let cleaned = 0;

  for (const [roomCode, room] of rooms.entries()) {
    const allDisconnected = Array.from(room.players.values()).every(p => !p.connected);

    if (allDisconnected) {
      rooms.delete(roomCode);
      cleaned++;
      console.log(`Cleaned up abandoned room: ${roomCode}`);
    }
  }

  return cleaned;
}
```

In `server.ts`, run cleanup periodically:

```ts
// Run cleanup every 5 minutes
setInterval(() => {
  const cleaned = cleanupAbandonedRooms();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} abandoned room(s)`);
  }
}, 5 * 60 * 1000);
```

---

## Step 4: Enhanced Game State Validation

**Goal:** Handle edge cases when players disconnect mid-game.

### 4.1: Skip Disconnected Players' Turns

In `game-logic.ts`, update `advanceTurn`:

```ts
export function advanceTurn(room: Room): void {
  const playerCount = room.players.size;
  let attempts = 0;

  do {
    if (room.direction === 1) {
      room.currentPlayerIndex = (room.currentPlayerIndex + 1) % playerCount;
    } else {
      room.currentPlayerIndex = (room.currentPlayerIndex - 1 + playerCount) % playerCount;
    }

    attempts++;

    // Prevent infinite loop if all players disconnected
    if (attempts > playerCount) {
      console.error("All players disconnected, cannot advance turn");
      room.gameStatus = "finished";
      break;
    }

    const currentPlayerId = getCurrentPlayer(room);
    const currentPlayer = room.players.get(currentPlayerId);

    // Continue if player is connected
    if (currentPlayer?.connected) {
      break;
    }

    console.log(`Skipping disconnected player: ${currentPlayerId}`);
  } while (true);
}
```

### 4.2: Handle Reconnection During Turn

When a player reconnects during their turn, they should be notified:

```ts
// In handleReconnect, after broadcasting game state:
if (room.gameStatus === "playing") {
  const currentPlayerId = getCurrentPlayer(room);

  if (currentPlayerId === msg.playerId) {
    ws.send(JSON.stringify({
      type: "yourTurn",
      message: "It's your turn!"
    }));
  }
}
```

---

## Final Checkpoint: Test Reconnection

**Test Scenarios:**

1. **Normal Disconnect/Reconnect:**
   - Player A joins room
   - Player A closes browser tab
   - Player list shows A as disconnected (gray dot)
   - Player A reopens and reconnects
   - Player list shows A as connected

2. **Mid-Game Reconnect:**
   - Start game with 3 players
   - Player B disconnects during game
   - Game skips Player B's turn
   - Player B reconnects
   - Player B receives current game state
   - Game includes Player B in next round

3. **Abandoned Room Cleanup:**
   - Create room with 2 players
   - Both players disconnect
   - Wait 5 minutes
   - Room is deleted from server

4. **Error Code Validation:**
   - Try to join full room → receive `ROOM_FULL` error code
   - Try to play out of turn → receive `NOT_YOUR_TURN` error code
   - Non-host tries to start → receive `NOT_HOST` error code

---

## What You Built

- ✅ Structured error code system for frontend mapping
- ✅ Player reconnection handler (disconnect vs leave)
- ✅ Session resume logic (re-subscribe to room topic)
- ✅ Turn skipping for disconnected players
- ✅ Abandoned room cleanup (periodic task)
- ✅ Enhanced WebSocket lifecycle management
- ✅ Edge case handling (all players disconnected)

## Next Steps

Your backend is now production-ready! Additional enhancements could include:

- Admin panel for viewing active rooms
- Custom game rules (configurable card distribution)
- Game history/statistics
- Rate limiting and spam protection
- Database persistence (rooms survive server restart)

## Questions for Understanding

- Why disconnect players instead of removing them immediately?
- How does the cleanup interval prevent memory leaks?
- What happens if a reconnection fails mid-game?
- Why skip disconnected players' turns instead of pausing?
- How would you handle multiple reconnection attempts?

---

**Congratulations!** You've built a fully functional, real-time multiplayer card game with robust error handling and reconnection support.
