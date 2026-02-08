# Phase 1: Core Server & Rooms — Technical Plan

## Goal

Build the Bun HTTP + WebSocket server with room management. Players should be able to create rooms, join via room code, and see each other connect/disconnect in real-time. No game logic yet — just the multiplayer infrastructure.

## Key Design Decision: Bun's Built-in Pub/Sub for Rooms

Bun's WebSocket API has native topic-based pub/sub (similar to Redis Pub/Sub or MQTT). Each room code becomes a topic. When a player joins a room, their WebSocket subscribes to that room's topic. Broadcasting to all players in a room is a single `server.publish(roomCode, data)` call — no need to manually track which WebSockets belong to which rooms.

**Benefits:**
- Simple broadcast: `server.publish("ABXY", message)` sends to all players in room ABXY
- Automatic cleanup: unsubscribe when players leave
- Efficient: Bun handles the fan-out internally

## Files to Create

### 1. `server.ts` — Main Bun server

**Responsibilities:**
- Set up `Bun.serve()` with HTTP fetch handler + WebSocket handler
- Serve static files from `./public` directory using `Bun.file()`
- Upgrade WebSocket connections on `/ws` path
- Attach player metadata to `ws.data` during upgrade
- Route incoming WebSocket messages to room-manager functions
- Handle WebSocket lifecycle: `open`, `message`, `close`

**HTTP Routes:**
- `GET /` → serve `public/index.html`
- `GET /ws` → upgrade to WebSocket
- `GET /<path>` → serve matching file from `public/`
- Fallback → 404 Not Found

**WebSocket Message Routing:**
Parse incoming JSON messages and switch on `action` field:
- `create` → call `createRoom()`, send room code back to sender
- `join` → call `joinRoom()`, subscribe to room topic, broadcast updated player list
- On disconnect/close → call `disconnectPlayer()`, unsubscribe, broadcast updated player list

**Port:** 3000 (configurable via environment variable)

### 2. `room-manager.ts` — Room state management

Pure logic module with no dependencies. Manages in-memory room state.

**Data Structure:**
```ts
// Module-level Map
const rooms = new Map<string, Room>();

// Type definitions
interface PlayerInfo {
  id: string;             // Unique player ID
  name: string;           // Display name
  avatar: string;         // Emoji avatar (e.g., "😎", "🔥", "👻")
  connected: boolean;     // Connection status
}

interface Room {
  roomCode: string;         // 4-character uppercase code (e.g., "ABXY")
  players: Map<string, PlayerInfo>;
  hostId: string;           // Player who created the room
  gameStatus: "waiting";    // Only 'waiting' in Phase 1 (game not started)
  createdAt: number;        // Timestamp for cleanup
}
```

**Exported Functions:**

```ts
export function createRoom(
  playerName: string,
  avatar: string
): { roomCode: string; playerId: string }
```
- Generates unique room code
- Creates room with host player (name + emoji avatar)
- Returns room code and player ID

```ts
export function joinRoom(
  roomCode: string,
  playerName: string,
  avatar: string
): { playerId: string }
```
- Validates: room exists, not full (max 6 players), game not started
- Adds player to room (name + emoji avatar)
- Returns player ID
- Throws error if validation fails

```ts
export function leaveRoom(roomCode: string, playerId: string): void
```
- Removes player from room
- Destroys room if empty
- Transfers host if current host leaves

```ts
export function disconnectPlayer(roomCode: string, playerId: string): void
```
- Marks player as `connected: false`
- Keeps player in room for potential reconnection

```ts
export function reconnectPlayer(roomCode: string, playerId: string): void
```
- Marks player as `connected: true`

```ts
export function getRoom(roomCode: string): Room | undefined
```
- Returns room object or undefined

```ts
export function getRoomPlayerList(roomCode: string): Array<{
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
  isHost: boolean;
}>
```
- Returns sanitized player list for broadcasting
- Includes `isHost` flag for UI highlighting

```ts
function generateRoomCode(): string
```
- Generates random 4-character uppercase code
- Ensures no collision with existing rooms
- Format: `[A-Z]{4}` (e.g., "ABXY", "QWER")

**Room Code Generation Strategy:**
- 4 uppercase letters: 26^4 = 456,976 possible codes
- Check against existing rooms to avoid collisions
- Retry if collision (extremely rare)

### 3. `public/index.html` — Landing Page (Minimal Placeholder)

A functional placeholder for testing. Will be replaced with proper UI in Phase 4.

**UI Elements:**
- Text input: Player name
- Emoji avatar picker: Grid of emoji options to choose from
- Button: "Create Room"
- Text input: Room code
- Button: "Join Room"
- Status div: Shows connection state, room info, player list with avatars

**JavaScript (inline):**
- Connect to WebSocket on page load
- Send `create` or `join` message on button click
- Display received messages in status div
- Update player list when broadcast received

**Styling:** Minimal inline styles for basic readability

_Note: Frontend UI implementation will be handled by Claude Code. This placeholder allows backend testing._

### 4. `public/styles.css` — Minimal Styles (Placeholder)

Basic styles:
- Mobile viewport meta tag in HTML
- Centered layout
- Readable fonts and spacing
- Button styling

Will be replaced in Phase 4 with proper mobile-optimized design.

## WebSocket Message Protocol

### Client → Server

**Create Room:**
```json
{
  "action": "create",
  "playerName": "Alice",
  "avatar": "😎"
}
```

**Join Room:**
```json
{
  "action": "join",
  "roomCode": "ABXY",
  "playerName": "Bob",
  "avatar": "🔥"
}
```

### Server → Client (Direct Messages)

**Room Created:**
```json
{
  "type": "roomCreated",
  "roomCode": "ABXY",
  "playerId": "p_abc123"
}
```

**Joined Room:**
```json
{
  "type": "joined",
  "roomCode": "ABXY",
  "playerId": "p_def456"
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Room not found"
}
```

### Server → Room (Broadcast via Pub/Sub Topic)

**Player List Update:**
```json
{
  "type": "playerList",
  "players": [
    { "id": "p_abc123", "name": "Alice", "avatar": "😎", "connected": true, "isHost": true },
    { "id": "p_def456", "name": "Bob", "avatar": "🔥", "connected": true, "isHost": false }
  ]
}
```

## WebSocket Data Attachment

When upgrading a WebSocket connection, attach metadata to `ws.data`:

```ts
interface WebSocketData {
  playerId: string | null;
  playerName: string | null;
  avatar: string | null;
  roomCode: string | null;
}

server.upgrade(req, {
  data: {
    playerId: null,    // Set after create/join succeeds
    playerName: null,  // Set after create/join succeeds
    avatar: null,      // Set after create/join succeeds
    roomCode: null     // Set after create/join succeeds
  } as WebSocketData
});
```

After `create` or `join` succeeds:
1. Mutate `ws.data` with actual values
2. Call `ws.subscribe(roomCode)` to join the room's broadcast topic
3. Send direct response to the player
4. Broadcast updated player list to the room

## Understanding Bun's Fetch Handler (Important!)

**TL;DR:** In Bun, the `fetch` handler inside `Bun.serve()` receives ALL incoming HTTP requests (including WebSocket upgrade requests). You check the URL path and either upgrade to WebSocket with `server.upgrade(req)` or return a normal HTTP response. This unified approach lets you handle both static files and WebSocket connections in one place.

### Two Different "fetch" Functions

There are **two different `fetch` functions** that are easy to confuse:

#### 1. Global `fetch()` — Making Outbound Requests (Standard Web API)
```ts
// Call external APIs (YOU are the client)
const response = await fetch("https://api.example.com/data");
```
- **1 parameter:** `fetch(url)` or `fetch(request)`
- **Purpose:** Make HTTP requests TO other servers
- **Used:** Inside your handlers when you need external data

#### 2. Bun's `fetch` Handler — Handling Inbound Requests (Bun-specific)
```ts
// Define how your server handles incoming requests
Bun.serve({
  fetch(req, server) {  // <-- THIS is Bun's handler
    return new Response("Hello");
  }
});
```
- **2 parameters:** `fetch(req: Request, server: Server)`
- **Purpose:** Handle HTTP requests coming TO your server
- **Used:** Inside `Bun.serve()` config (defined once at top level)

### Why WebSocket Upgrade Happens in the Fetch Handler

WebSocket connections start as HTTP requests with special headers (`Upgrade: websocket`). In Bun's architecture:

1. **Client initiates connection** → HTTP request to `/ws`
2. **Your `fetch` handler receives it** → Check if `url.pathname === "/ws"`
3. **Call `server.upgrade(req)`** → Convert HTTP connection to WebSocket
4. **Return `undefined`** → Signal "this is now a WebSocket, not HTTP"
5. **Future messages** → Go to `websocket.message()` handler

**Example:**
```ts
Bun.serve({
  port: 3000,

  // ALL requests come here first (HTTP + WebSocket upgrades)
  fetch(req, server) {
    const url = new URL(req.url);

    // Route 1: WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, {
        data: { playerId: null, roomCode: null }
      });
      if (upgraded) return undefined;  // Upgrade successful
      return new Response("Upgrade failed", { status: 500 });
    }

    // Route 2: Static file serving
    if (url.pathname === "/") {
      return new Response(Bun.file("./public/index.html"));
    }

    // Route 3: 404
    return new Response("Not Found", { status: 404 });
  },

  // After upgrade, WebSocket events come here
  websocket: {
    open(ws) {
      console.log("WebSocket connected");
    },
    message(ws, message) {
      console.log("Received:", message);
    },
    close(ws) {
      console.log("WebSocket closed");
    }
  }
});
```

### Where Each Function Goes

| What | Where | When Used |
|------|-------|-----------|
| `Bun.serve({ ... })` | Top level of `server.ts` | Once (server setup) |
| `fetch(req, server)` handler | Inside `Bun.serve()` | Every incoming request |
| `await fetch("https://...")` | Inside handlers (optional) | When calling external APIs |

### The `server` Parameter

The second parameter `server` is **only available in Bun's fetch handler** and provides server-specific operations:
- `server.upgrade(req)` — Convert HTTP to WebSocket
- `server.publish(topic, data)` — Broadcast to WebSocket topic subscribers
- `server.requestIP(req)` — Get client IP address

This is why Bun's signature is `fetch(req, server)` instead of just `fetch(req)` like the global API.

## Implementation Order

### 1. **`room-manager.ts`** first
Pure logic, no dependencies — can be tested in isolation with console logs.

**Steps:**
1. Write type definitions (`PlayerInfo`, `Room`, `WebSocketData`)
2. Write helper function `generateRoomCode()` (4 random uppercase letters)
3. Implement `createRoom()` — creates room, adds host player, returns `{ roomCode, playerId }`
4. Implement `joinRoom()` — validates room exists/not full, adds player, returns `{ playerId }`
5. Implement `leaveRoom()` — removes player, destroys room if empty, transfers host
6. Implement `disconnectPlayer()` and `reconnectPlayer()` — toggle `connected` flag
7. Implement `getRoom()` and `getRoomPlayerList()` — data accessors

**Test:** Run `bun room-manager.ts` with test code at the bottom to verify room creation/joining.

### 2. **`server.ts`** second
Wire up HTTP server, WebSocket infrastructure, and room-manager integration.

**Step 2.1: Import room-manager**
```ts
import { createRoom, joinRoom, leaveRoom, disconnectPlayer, getRoomPlayerList } from "./room-manager";
```

**Step 2.2: Set up basic HTTP server with static file serving**
```ts
Bun.serve({
  port: 3000,
  fetch(req, server) {
    const url = new URL(req.url);

    // Serve index.html for root
    if (url.pathname === "/") {
      return new Response(Bun.file("./public/index.html"));
    }

    // Serve other static files
    const file = Bun.file(`./public${url.pathname}`);
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  }
});
```

**Step 2.3: Add WebSocket upgrade logic**

Add WebSocket upgrade check in the `fetch` handler (BEFORE static file serving):
```ts
fetch(req, server) {
  const url = new URL(req.url);

  // WebSocket upgrade (add this first!)
  if (url.pathname === "/ws") {
    const upgraded = server.upgrade(req, {
      data: {
        playerId: null,
        playerName: null,
        avatar: null,
        roomCode: null
      }
    });

    if (upgraded) return undefined;  // Upgrade successful
    return new Response("WebSocket upgrade failed", { status: 500 });
  }

  // ... rest of HTTP routing
}
```

Add `websocket` config to `Bun.serve()`:
```ts
Bun.serve({
  port: 3000,
  fetch(req, server) { ... },

  websocket: {
    open(ws) {
      console.log("WebSocket opened");
    },

    message(ws, message) {
      console.log("Received:", message);
      // Step 2.4 will implement message routing here
    },

    close(ws) {
      console.log("WebSocket closed");
      // Handle player disconnection
      const { roomCode, playerId } = ws.data;
      if (roomCode && playerId) {
        disconnectPlayer(roomCode, playerId);
        // Broadcast updated player list
        server.publish(roomCode, JSON.stringify({
          type: "playerList",
          players: getRoomPlayerList(roomCode)
        }));
      }
    }
  }
});
```

**Step 2.4: Wire up message handlers**

Implement message routing in `websocket.message()`:
```ts
message(ws, message) {
  const data = JSON.parse(message as string);

  // CREATE room
  if (data.action === "create") {
    const { roomCode, playerId } = createRoom(data.playerName, data.avatar);

    // Attach metadata to WebSocket
    ws.data.playerId = playerId;
    ws.data.playerName = data.playerName;
    ws.data.avatar = data.avatar;
    ws.data.roomCode = roomCode;

    // Subscribe to room topic
    ws.subscribe(roomCode);

    // Send direct response
    ws.send(JSON.stringify({ type: "roomCreated", roomCode, playerId }));

    // Broadcast player list to room
    server.publish(roomCode, JSON.stringify({
      type: "playerList",
      players: getRoomPlayerList(roomCode)
    }));
  }

  // JOIN room (similar structure)
  if (data.action === "join") {
    try {
      const { playerId } = joinRoom(data.roomCode, data.playerName, data.avatar);

      ws.data.playerId = playerId;
      ws.data.playerName = data.playerName;
      ws.data.avatar = data.avatar;
      ws.data.roomCode = data.roomCode;

      ws.subscribe(data.roomCode);

      ws.send(JSON.stringify({ type: "joined", roomCode: data.roomCode, playerId }));

      server.publish(data.roomCode, JSON.stringify({
        type: "playerList",
        players: getRoomPlayerList(data.roomCode)
      }));
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", message: error.message }));
    }
  }
}
```

**Key Pattern:** `ws.subscribe(roomCode)` + `server.publish(roomCode, data)` is how Bun's pub/sub works!

### 3. **`public/index.html`** + **`public/styles.css`** last
Simple test UI (handled by Claude Code) — just enough to verify server works.

**Frontend requirements:**
- Protocol-aware WebSocket connection (see DEPLOYMENT-PLAN.md for details on `ws://` vs `wss://`)
- Input fields for player name, avatar selection, room code
- Buttons for "Create Room" and "Join Room"
- Display area for room code, player list with avatars, connection status

**Note:** For ngrok deployment, the WebSocket URL must be protocol-aware (`wss://` for HTTPS tunnels). See `docs/plans/DEPLOYMENT-PLAN.md` for implementation details.

## Testing & Verification

### Manual Testing Steps

1. **Start the server:**
   ```bash
   bun dev
   ```

2. **Create a room:**
   - Open `http://localhost:3000` in browser tab 1
   - Enter name "Alice"
   - Click "Create Room"
   - Verify room code appears (e.g., "ABXY")

3. **Join the room:**
   - Open `http://localhost:3000` in browser tab 2
   - Enter name "Bob" and room code "ABXY"
   - Click "Join Room"
   - Verify both tabs show updated player list with Alice and Bob

4. **Test disconnection:**
   - Close tab 2
   - Verify tab 1 shows Bob as disconnected

5. **Test error cases:**
   - Try joining nonexistent room → should show error
   - Create room with 6 players, try to add 7th → should reject
   - Leave empty player name → should show error

### Console Debugging

Add console.log statements in server.ts to trace:
- WebSocket connections
- Message routing
- Room creation/join/leave events
- Subscription/unsubscription to topics

## Success Criteria

- ✅ Multiple players can create rooms with unique codes
- ✅ Players can join existing rooms via code
- ✅ All players in a room see real-time player list updates
- ✅ Disconnecting a player marks them as disconnected (not removed)
- ✅ Leaving a room removes the player
- ✅ Empty rooms are cleaned up
- ✅ Error messages are shown for invalid actions
- ✅ Server runs on port 3000 and serves static files

## What's NOT in Phase 1

- Game logic (cards, turns, rules)
- Game start/stop
- Actual game UI
- Card rendering
- Reconnection persistence across server restarts
- Player authentication

These are documented separately in archived plans (`docs/random/`). Phase 1 is purely the multiplayer infrastructure.
