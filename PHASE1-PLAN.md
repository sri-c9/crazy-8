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

### 1. `server.js` — Main Bun server

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
- On disconnect/close → call `leaveRoom()`, unsubscribe, broadcast updated player list

**Port:** 3000 (configurable via environment variable)

### 2. `room-manager.js` — Room state management

Pure logic module with no dependencies. Manages in-memory room state.

**Data Structure:**
```js
// Module-level Map
const rooms = new Map(); // Map<roomCode, Room>

// Room object structure
{
  roomCode: string,         // 4-character uppercase code (e.g., "ABXY")
  players: Map<string, {    // Map<playerId, PlayerInfo>
    id: string,             // Unique player ID
    name: string,           // Display name
    connected: boolean      // Connection status
  }>,
  hostId: string,           // Player who created the room
  gameStatus: 'waiting',    // Only 'waiting' in Phase 1 (game not started)
  createdAt: number         // Timestamp for cleanup
}
```

**Exported Functions:**

- `createRoom(playerName: string) → { roomCode: string, playerId: string }`
  - Generates unique room code
  - Creates room with host player
  - Returns room code and player ID

- `joinRoom(roomCode: string, playerName: string) → { playerId: string }`
  - Validates: room exists, not full (max 6 players), game not started
  - Adds player to room
  - Returns player ID
  - Throws error if validation fails

- `leaveRoom(roomCode: string, playerId: string) → void`
  - Removes player from room
  - Destroys room if empty
  - Transfers host if current host leaves

- `disconnectPlayer(roomCode: string, playerId: string) → void`
  - Marks player as `connected: false`
  - Keeps player in room for potential reconnection

- `reconnectPlayer(roomCode: string, playerId: string) → void`
  - Marks player as `connected: true`

- `getRoom(roomCode: string) → Room | undefined`
  - Returns room object or undefined

- `getRoomPlayerList(roomCode: string) → Array<{ id, name, connected, isHost }>`
  - Returns sanitized player list for broadcasting
  - Includes `isHost` flag for UI highlighting

- `generateRoomCode() → string`
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
- Button: "Create Room"
- Text input: Room code
- Button: "Join Room"
- Status div: Shows connection state, room info, player list

**JavaScript (inline):**
- Connect to WebSocket on page load
- Send `create` or `join` message on button click
- Display received messages in status div
- Update player list when broadcast received

**Styling:** Minimal inline styles for basic readability

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
  "playerName": "Alice"
}
```

**Join Room:**
```json
{
  "action": "join",
  "roomCode": "ABXY",
  "playerName": "Bob"
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
    { "id": "p_abc123", "name": "Alice", "connected": true, "isHost": true },
    { "id": "p_def456", "name": "Bob", "connected": true, "isHost": false }
  ]
}
```

## WebSocket Data Attachment

When upgrading a WebSocket connection, attach metadata to `ws.data`:

```js
server.upgrade(req, {
  data: {
    playerId: null,    // Set after create/join succeeds
    playerName: null,  // Set after create/join succeeds
    roomCode: null     // Set after create/join succeeds
  }
});
```

After `create` or `join` succeeds:
1. Mutate `ws.data` with actual values
2. Call `ws.subscribe(roomCode)` to join the room's broadcast topic
3. Send direct response to the player
4. Broadcast updated player list to the room

## Implementation Order

1. **`room-manager.js`** first
   - Pure logic, no dependencies
   - Can be tested in isolation with console logs
   - Write helper function `generateRoomCode()` first
   - Then implement create/join/leave functions

2. **`server.js`** second
   - Import room-manager
   - Set up basic HTTP server with static file serving
   - Add WebSocket upgrade logic
   - Wire up message handlers

3. **`public/index.html`** + **`public/styles.css`** last
   - Simple test UI
   - Just enough to verify server works

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

Add console.log statements in server.js to trace:
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

These come in later phases. Phase 1 is purely the multiplayer infrastructure.
