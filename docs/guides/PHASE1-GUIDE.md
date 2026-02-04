# Phase 1: Learning Guide — Build It Yourself

Welcome! This guide will walk you through building the core server and room management system. Instead of copying code, you'll learn by building each piece step by step. I'll explain the concepts, give you hints, and let you write the code.

## Before You Start

**Prerequisites:**
- Bun installed (`bun --version` to check)
- Code editor open in `/Users/sri/projects/web-apps/crazy-8`
- Basic TypeScript knowledge (functions, objects, async/await, interfaces, type annotations)

**Learning Approach:**
- Read each step completely before coding
- Try to write the code yourself first
- If stuck, check the hints
- Still stuck? Ask me for help
- Test each checkpoint before moving on

## Step 1: Build the Room Manager (No Server Yet)

**Goal:** Create a pure TypeScript module that manages game rooms in memory.

### What You'll Learn
- How to use `Map` for efficient key-value storage
- Generating unique random codes
- TypeScript interfaces and type annotations
- Module exports in ES6

### Your Task

Create `room-manager.ts` in the project root. This file will export functions to create, join, and leave rooms.

**Start with the data structure:**

Think about what you need to track:
- A collection of rooms (use `Map<roomCode, Room>`)
- Each room has: code, players, host, status
- Each player has: id, name, emoji avatar, connection status

<details>
<summary>💡 Hint: Room data structure</summary>

```ts
// At the top of the file
interface PlayerInfo {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
}

interface Room {
  roomCode: string;
  players: Map<string, PlayerInfo>;
  hostId: string;
  gameStatus: "waiting" | "playing" | "finished";
  createdAt: number;
}

const rooms = new Map<string, Room>();
```
</details>

**Now implement these functions one by one:**

### 1.1: `generateRoomCode()`

Write a function that:
- Generates 4 random uppercase letters
- Checks if that code already exists in `rooms`
- If it exists, try again (recursion or loop)
- Returns the unique code

<details>
<summary>💡 Hint: Random letter generation</summary>

```ts
// Get a random letter A-Z
const randomLetter = (): string => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters[Math.floor(Math.random() * letters.length)];
};
```
</details>

<details>
<summary>💡 Hint: Checking for collisions</summary>

```ts
function generateRoomCode(): string {
  let code: string;
  do {
    code = /* generate 4 random letters */;
  } while (rooms.has(code)); // Keep trying if code exists
  return code;
}
```
</details>

**Test it:** Add a temporary console.log at the bottom of the file:
```ts
console.log(generateRoomCode()); // Should print something like "QWER"
```
Run: `bun room-manager.ts`

### 1.2: `createRoom(playerName, avatar)`

Write a function that:
- Generates a room code
- Creates a player ID (e.g., `"p_" + random string`)
- Creates a new room object
- Adds the host player to the room (with name and emoji avatar)
- Stores the room in the `rooms` Map
- Returns `{ roomCode, playerId }`

<details>
<summary>💡 Hint: Generating player IDs</summary>

```ts
const generatePlayerId = (): string => {
  return "p_" + Math.random().toString(36).substring(2, 9);
};
```
</details>

<details>
<summary>💡 Hint: Room structure</summary>

```ts
const room: Room = {
  roomCode: code,
  players: new Map<string, PlayerInfo>(),
  hostId: playerId,
  gameStatus: "waiting",
  createdAt: Date.now()
};

room.players.set(playerId, {
  id: playerId,
  name: playerName,
  avatar: avatar,
  connected: true
});

rooms.set(roomCode, room);
```
</details>

**Test it:**
```ts
const result = createRoom("Alice", "😎");
console.log(result); // { roomCode: "ABXY", playerId: "p_abc123" }
console.log(rooms.get(result.roomCode)); // Should show the room object with avatar
```

### 1.3: `joinRoom(roomCode, playerName, avatar)`

Write a function that:
- Checks if the room exists (throw error if not)
- Checks if the room is full (max 6 players, throw error if full)
- Checks if game has started (throw error if `gameStatus !== "waiting"`)
- Generates a player ID
- Adds the player to the room's players Map (with name and emoji avatar)
- Returns `{ playerId }`

<details>
<summary>💡 Hint: Validation pattern</summary>

```ts
export function joinRoom(roomCode: string, playerName: string, avatar: string): { playerId: string } {
  const room = rooms.get(roomCode);

  if (!room) {
    throw new Error("Room not found");
  }

  if (room.players.size >= 6) {
    throw new Error("Room is full");
  }

  if (room.gameStatus !== "waiting") {
    throw new Error("Game already started");
  }

  // Generate player ID and add to room
  // ...
}
```
</details>

**Test it:**
```ts
const room1 = createRoom("Alice", "😎");
const player2 = joinRoom(room1.roomCode, "Bob", "🔥");
console.log(rooms.get(room1.roomCode).players.size); // Should be 2
```

### 1.4: `leaveRoom(roomCode, playerId)`

Write a function that:
- Gets the room
- Removes the player from room.players
- If the room is now empty, delete it from the `rooms` Map
- If the host left and players remain, assign new host (first remaining player)

<details>
<summary>💡 Hint: Transferring host</summary>

```ts
if (playerId === room.hostId && room.players.size > 0) {
  // Get the first remaining player
  const newHostId = room.players.keys().next().value;
  room.hostId = newHostId;
}
```
</details>

### 1.5: `getRoomPlayerList(roomCode)`

Write a function that:
- Gets the room
- Converts the players Map to an array
- Adds an `isHost` flag to each player
- Returns the array

<details>
<summary>💡 Hint: Map to array with transformation</summary>

```ts
interface PlayerListItem extends PlayerInfo {
  isHost: boolean;
}

export function getRoomPlayerList(roomCode: string): PlayerListItem[] {
  const room = rooms.get(roomCode);
  if (!room) return [];

  return Array.from(room.players.values()).map(player => ({
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    connected: player.connected,
    isHost: player.id === room.hostId
  }));
}
```
</details>

### 1.6: Export all functions

At the bottom of `room-manager.ts`, export everything:

```ts
export {
  createRoom,
  joinRoom,
  leaveRoom,
  disconnectPlayer,
  reconnectPlayer,
  getRoom,
  getRoomPlayerList
};
```

**Checkpoint 1:** Test your room manager thoroughly:
```ts
// At bottom of file (temporary):
const r1 = createRoom("Alice", "😎");
console.log("Created:", r1);

const p2 = joinRoom(r1.roomCode, "Bob", "🔥");
console.log("Joined:", p2);

console.log("Players:", getRoomPlayerList(r1.roomCode));
```

Run: `bun room-manager.ts`

Expected output: Room created, Bob joins, player list shows both.

---

## Step 2: Build the HTTP + WebSocket Server

**Goal:** Create the Bun server that serves static files and handles WebSocket connections.

### What You'll Learn
- How `Bun.serve()` works
- Serving static files with `Bun.file()`
- WebSocket upgrade pattern
- Topic-based pub/sub

### Your Task

Create `server.ts` in the project root.

### 2.1: Basic HTTP Server (No WebSocket Yet)

Start with just HTTP file serving:

```ts
interface ServerType {
  port: number;
}

const server = Bun.serve({
  port: 3000,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // TODO: Determine file path
    // TODO: Serve the file with Bun.file()
    // TODO: Handle 404
  }
});

console.log(`Server running on http://localhost:${server.port}`);
```

**Your task:** Fill in the `fetch` handler to:
- Map `/` to `public/index.html`
- Map other paths to `public/<path>`
- Check if file exists with `await file.exists()`
- Return `new Response(file)` if exists
- Return 404 if not

<details>
<summary>💡 Hint: File serving pattern</summary>

```ts
let filePath = "./public" + url.pathname;
if (url.pathname === "/") {
  filePath = "./public/index.html";
}

const file = Bun.file(filePath);
if (await file.exists()) {
  return new Response(file);
}

return new Response("Not Found", { status: 404 });
```
</details>

**Test it:** Create a simple `public/index.html`:
```html
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>It works!</h1></body>
</html>
```

Run `bun server.ts` and visit `http://localhost:3000`

### 2.2: Add WebSocket Upgrade

Now add WebSocket support. The pattern is:
- Check if the path is `/ws`
- Call `server.upgrade(req, { data })`
- If upgrade succeeds, return `undefined`
- If fails, return error response

Update your `fetch` handler:

```ts
interface WebSocketData {
  playerId: string | null;
  playerName: string | null;
  avatar: string | null;
  roomCode: string | null;
}

async fetch(req: Request, server: ServerType): Promise<Response | undefined> {
  const url = new URL(req.url);

  // WebSocket upgrade
  if (url.pathname === "/ws") {
    const success = server.upgrade(req, {
      data: {
        playerId: null,
        playerName: null,
        avatar: null,
        roomCode: null
      } as WebSocketData
    });

    if (success) return undefined;
    return new Response("WebSocket upgrade failed", { status: 500 });
  }

  // ... rest of file serving code
}
```

### 2.3: Add WebSocket Handlers

Add a `websocket` object to the `Bun.serve()` config:

```ts
import type { ServerWebSocket } from "bun";

const server = Bun.serve({
  port: 3000,

  fetch(req: Request, server: ServerType): Promise<Response | undefined> { /* ... */ },

  websocket: {
    open(ws: ServerWebSocket<WebSocketData>) {
      console.log("WebSocket connected");
    },

    message(ws: ServerWebSocket<WebSocketData>, message: string) {
      console.log("Received:", message);
      // TODO: Parse JSON and route to handlers
    },

    close(ws: ServerWebSocket<WebSocketData>) {
      console.log("WebSocket closed");
      // TODO: Handle disconnect
    }
  }
});
```

**Your task in `message` handler:**
1. Parse the JSON message
2. Switch on `message.action`
3. Handle `create` and `join` actions
4. Send responses back

<details>
<summary>💡 Hint: Message routing structure</summary>

```ts
interface IncomingMessage {
  action: string;
  playerName?: string;
  avatar?: string;
  roomCode?: string;
}

message(ws: ServerWebSocket<WebSocketData>, message: string) {
  try {
    const msg = JSON.parse(message) as IncomingMessage;

    switch (msg.action) {
      case "create":
        handleCreate(ws, msg);
        break;
      case "join":
        handleJoin(ws, msg);
        break;
      default:
        ws.send(JSON.stringify({ type: "error", message: "Unknown action" }));
    }
  } catch (error) {
    ws.send(JSON.stringify({ type: "error", message: (error as Error).message }));
  }
}
```
</details>

### 2.4: Implement `handleCreate`

Write a function that:
- Calls `createRoom(playerName)` from room-manager
- Updates `ws.data` with the player info
- Subscribes to the room topic: `ws.subscribe(roomCode)`
- Sends `roomCreated` message back to the client
- Broadcasts player list to the room

<details>
<summary>💡 Hint: handleCreate implementation</summary>

```ts
import { createRoom, getRoomPlayerList } from "./room-manager.ts";

function handleCreate(ws: ServerWebSocket<WebSocketData>, msg: IncomingMessage) {
  const { roomCode, playerId } = createRoom(msg.playerName!, msg.avatar!);

  // Update WebSocket data
  ws.data.playerId = playerId;
  ws.data.playerName = msg.playerName!;
  ws.data.avatar = msg.avatar!;
  ws.data.roomCode = roomCode;

  // Subscribe to room topic
  ws.subscribe(roomCode);

  // Send direct response
  ws.send(JSON.stringify({
    type: "roomCreated",
    roomCode,
    playerId
  }));

  // Broadcast player list to room
  server.publish(roomCode, JSON.stringify({
    type: "playerList",
    players: getRoomPlayerList(roomCode)
  }));
}
```
</details>

### 2.5: Implement `handleJoin`

Similar pattern to `handleCreate`:
- Call `joinRoom(roomCode, playerName)`
- Update `ws.data`
- Subscribe to room
- Send `joined` response
- Broadcast updated player list

**Try writing this yourself!** Use `handleCreate` as a reference.

### 2.6: Handle Disconnect

In the `close` handler:
- Check if `ws.data.roomCode` exists
- Call `leaveRoom(roomCode, playerId)`
- Unsubscribe from room
- Broadcast updated player list

<details>
<summary>💡 Hint: close handler</summary>

```ts
close(ws: ServerWebSocket<WebSocketData>) {
  if (ws.data.roomCode && ws.data.playerId) {
    leaveRoom(ws.data.roomCode, ws.data.playerId);
    ws.unsubscribe(ws.data.roomCode);

    server.publish(ws.data.roomCode, JSON.stringify({
      type: "playerList",
      players: getRoomPlayerList(ws.data.roomCode)
    }));
  }
}
```
</details>

**Checkpoint 2:** Test with browser DevTools:
```js
// In browser console:
const ws = new WebSocket("ws://localhost:3000/ws");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.send(JSON.stringify({ action: "create", playerName: "Alice", avatar: "😎" }));
```

---

## Step 3: Test UI

**Note:** Claude Code will build a test UI for you in `public/index.html` with avatar picker, room creation/joining, and player list display. You can test the WebSocket server functionality using browser DevTools as shown in Checkpoint 2 above.

---

## Final Checkpoint: Full Test

Test all scenarios:

1. ✅ Create room → see room code
2. ✅ Join room from second tab → both see player list
3. ✅ Close second tab → first tab sees player gone
4. ✅ Try joining nonexistent room → see error
5. ✅ Create room with 6 players, try 7th → rejected

---

## What You Built

Congratulations! You've built:
- ✅ In-memory room management system with TypeScript interfaces
- ✅ Bun HTTP server with static file serving
- ✅ WebSocket server with pub/sub topics
- ✅ Room creation and joining flow
- ✅ Real-time player list updates
- ✅ Type-safe server handlers

## Next Steps

Phase 2 will add:
- Game initialization (dealing cards)
- Turn management
- Card play validation
- Basic game rules

But first, make sure you understand everything you built. Ask me questions about:
- Why we use `Map` instead of `Object`
- How pub/sub topics work
- What `ws.data` is for
- When to use `ws.send()` vs `server.publish()`

Ready to move on? Or want to experiment with Phase 1 more?
