# Phase 6: Learning Guide — Admin Panel "God Mode"

Welcome to Phase 6! You've built a fully working Insane Crazy 8 game. Now it's time to give yourself superpowers. You'll build an admin panel that lets you watch any room and manipulate the game in real-time — like a god mode cheat menu.

## Before You Start

**Prerequisites:**
- Phases 1-5 complete (server, game logic, special cards, reconnection all working)
- Server running with full gameplay tested
- Understanding of WebSocket message routing from Phase 1

**What You'll Build:**
- Admin authentication (password-protected route)
- God mode power system (4 categories, all togglable, all OFF by default)
- Admin state manager
- Server-side handlers for all admin actions
- Room manager and game logic extensions for admin manipulation

**Key Concept:**
The admin connects via a separate `/admin` page on your laptop while players play on their phones. You can watch any room and toggle superpowers on/off. No power is enabled by default — you activate only what you need.

**God Mode Powers:**

| Power | What It Does | Default |
|-------|-------------|---------|
| **See All Hands** | View every player's cards in real-time | OFF |
| **Manipulate Cards** | Give/remove cards, change top discard card | OFF |
| **Control Turns** | Skip turns, force draws, reverse direction, set current player | OFF |
| **Room Control** | Kick players, end game, force-start with <3 players | OFF |

---

## Step 1: Build the Admin Manager

**Goal:** Create a pure TypeScript module that manages admin state and god mode powers.

### What You'll Learn
- Typed configuration objects
- Power validation patterns
- State management for admin sessions

### Your Task

Create `admin-manager.ts` in the project root.

### 1.1: Define God Mode Types

Think about what you need to track:
- Which powers are enabled (4 booleans)
- Which room the admin is watching
- Whether the connection is an admin

```ts
// Start with these interfaces:

interface GodModePowers {
  seeAllHands: boolean;
  manipulateCards: boolean;
  controlTurns: boolean;
  roomControl: boolean;
}

type PowerName = keyof GodModePowers;
```

<details>
<summary>💡 Hint: Full AdminState interface</summary>

```ts
interface AdminState {
  isAdmin: boolean;
  watchingRoom: string | null;
  powers: GodModePowers;
}
```
</details>

### 1.2: `createAdminState()`

Write a function that returns a fresh admin state with all powers OFF:

<details>
<summary>💡 Hint: createAdminState implementation</summary>

```ts
export function createAdminState(): AdminState {
  return {
    isAdmin: true,
    watchingRoom: null,
    powers: {
      seeAllHands: false,
      manipulateCards: false,
      controlTurns: false,
      roomControl: false
    }
  };
}
```
</details>

### 1.3: `togglePower(state, powerName)`

Write a function that flips a power on/off and returns the new value:

<details>
<summary>💡 Hint: togglePower implementation</summary>

```ts
export function togglePower(state: AdminState, power: PowerName): boolean {
  state.powers[power] = !state.powers[power];
  return state.powers[power];
}
```
</details>

### 1.4: `hasPower(state, powerName)`

Write a validation helper that checks if a specific power is enabled:

<details>
<summary>💡 Hint: hasPower implementation</summary>

```ts
export function hasPower(state: AdminState, power: PowerName): boolean {
  return state.powers[power] === true;
}
```
</details>

### 1.5: `validateAdminAction(state, requiredPower)`

Write a function that throws an error if:
- The connection isn't admin
- The required power isn't enabled
- The admin isn't watching a room (for room-specific actions)

<details>
<summary>💡 Hint: validateAdminAction implementation</summary>

```ts
export function validateAdminAction(
  state: AdminState,
  requiredPower: PowerName,
  requiresRoom: boolean = true
): void {
  if (!state.isAdmin) {
    throw new Error("Not an admin");
  }

  if (!state.powers[requiredPower]) {
    throw new Error(`Power "${requiredPower}" is not enabled`);
  }

  if (requiresRoom && !state.watchingRoom) {
    throw new Error("Not watching a room");
  }
}
```
</details>

### 1.6: `setWatchingRoom(state, roomCode)` and `clearWatchingRoom(state)`

<details>
<summary>💡 Hint: Room watching functions</summary>

```ts
export function setWatchingRoom(state: AdminState, roomCode: string): void {
  state.watchingRoom = roomCode;
}

export function clearWatchingRoom(state: AdminState): void {
  state.watchingRoom = null;
}
```
</details>

### 1.7: Export Everything

```ts
export {
  createAdminState,
  togglePower,
  hasPower,
  validateAdminAction,
  setWatchingRoom,
  clearWatchingRoom
};

// Also export types for use in server.ts
export type { AdminState, GodModePowers, PowerName };
```

**Checkpoint 1:** Test your admin manager:
```ts
// At bottom of file (temporary):
const admin = createAdminState();
console.log("Initial powers:", admin.powers); // All false

togglePower(admin, "seeAllHands");
console.log("After toggle:", admin.powers.seeAllHands); // true

console.log("Has power?", hasPower(admin, "seeAllHands")); // true
console.log("Has manipulate?", hasPower(admin, "manipulateCards")); // false

setWatchingRoom(admin, "ABXY");
console.log("Watching:", admin.watchingRoom); // "ABXY"

// Should NOT throw:
validateAdminAction(admin, "seeAllHands");
console.log("Validation passed!");

// Should throw:
try {
  validateAdminAction(admin, "manipulateCards");
} catch (e) {
  console.log("Correctly blocked:", (e as Error).message);
}
```

Run: `bun admin-manager.ts`

---

## Step 2: Add Admin Route to Server

**Goal:** Serve the admin page with password protection.

### 2.1: Add Admin Password Config

At the top of `server.ts`:

```ts
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "insane8admin";
```

### 2.2: Add Admin HTTP Route

In your `fetch` handler, **before** the static file serving code, add the admin route:

<details>
<summary>💡 Hint: Admin route implementation</summary>

```ts
async fetch(req: Request, server): Promise<Response | undefined> {
  const url = new URL(req.url);

  // Admin page (password protected)
  if (url.pathname === "/admin") {
    const password = url.searchParams.get("password");

    if (password !== ADMIN_PASSWORD) {
      return new Response("Unauthorized", { status: 401 });
    }

    const file = Bun.file("./public/admin.html");
    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Admin page not found", { status: 404 });
  }

  // WebSocket upgrade (update to support admin flag)
  if (url.pathname === "/ws") {
    const isAdmin = url.searchParams.get("admin") === "true";

    const success = server.upgrade(req, {
      data: {
        playerId: null,
        playerName: null,
        avatar: null,
        roomCode: null,
        isAdmin: isAdmin,
        adminState: isAdmin ? createAdminState() : null
      } as WebSocketData
    });

    if (success) return undefined;
    return new Response("WebSocket upgrade failed", { status: 500 });
  }

  // ... rest of static file serving
}
```
</details>

### 2.3: Update WebSocketData Interface

Add admin fields to your WebSocket data:

```ts
import { AdminState, createAdminState } from "./admin-manager.ts";

interface WebSocketData {
  playerId: string | null;
  playerName: string | null;
  avatar: string | null;
  roomCode: string | null;
  isAdmin: boolean;
  adminState: AdminState | null;
}
```

**Checkpoint 2:** Test the admin route:
1. Run `bun server.ts`
2. Visit `http://localhost:3000/admin` → should get "Unauthorized"
3. Visit `http://localhost:3000/admin?password=insane8admin` → should see admin page (or 404 if not created yet, that's fine)

---

## Step 3: Add Admin WebSocket Handlers

**Goal:** Route admin messages to handler functions.

### 3.1: Admin Message Router

In your `message` handler, add admin action routing **before** the regular action switch:

<details>
<summary>💡 Hint: Admin message routing</summary>

```ts
message(ws: ServerWebSocket<WebSocketData>, message: string) {
  try {
    const msg = JSON.parse(message);

    // Route admin actions
    if (msg.action && msg.action.startsWith("admin")) {
      if (!ws.data.isAdmin || !ws.data.adminState) {
        ws.send(JSON.stringify({ type: "error", message: "Not an admin" }));
        return;
      }
      handleAdminAction(ws, msg);
      return;
    }

    // ... existing player action routing (create, join, play, draw, etc.)
  } catch (error) {
    ws.send(JSON.stringify({ type: "error", message: (error as Error).message }));
  }
}
```
</details>

### 3.2: Implement `handleAdminAction`

Create a function that switches on the admin action:

<details>
<summary>💡 Hint: handleAdminAction structure</summary>

```ts
function handleAdminAction(ws: ServerWebSocket<WebSocketData>, msg: any) {
  const adminState = ws.data.adminState!;

  try {
    switch (msg.action) {
      case "adminListRooms":
        handleAdminListRooms(ws);
        break;

      case "adminWatchRoom":
        handleAdminWatchRoom(ws, adminState, msg.roomCode);
        break;

      case "adminUnwatchRoom":
        handleAdminUnwatchRoom(ws, adminState);
        break;

      case "adminTogglePower":
        handleAdminTogglePower(ws, adminState, msg.power);
        break;

      case "adminGetAllHands":
        handleAdminGetAllHands(ws, adminState);
        break;

      case "adminGiveCard":
        handleAdminGiveCard(ws, adminState, msg);
        break;

      case "adminRemoveCard":
        handleAdminRemoveCard(ws, adminState, msg);
        break;

      case "adminSetTopCard":
        handleAdminSetTopCard(ws, adminState, msg);
        break;

      case "adminSkipTurn":
        handleAdminSkipTurn(ws, adminState);
        break;

      case "adminForceDraw":
        handleAdminForceDraw(ws, adminState, msg);
        break;

      case "adminReverseDirection":
        handleAdminReverseDirection(ws, adminState);
        break;

      case "adminSetCurrentPlayer":
        handleAdminSetCurrentPlayer(ws, adminState, msg);
        break;

      case "adminKickPlayer":
        handleAdminKickPlayer(ws, adminState, msg);
        break;

      case "adminEndGame":
        handleAdminEndGame(ws, adminState);
        break;

      case "adminForceStart":
        handleAdminForceStart(ws, adminState);
        break;

      default:
        ws.send(JSON.stringify({ type: "error", message: "Unknown admin action" }));
    }
  } catch (error) {
    ws.send(JSON.stringify({
      type: "adminResult",
      success: false,
      message: (error as Error).message
    }));
  }
}
```
</details>

### 3.3: Implement Basic Admin Handlers

Start with the simple ones:

**`handleAdminListRooms`** — Returns all active rooms:

<details>
<summary>💡 Hint: handleAdminListRooms</summary>

```ts
import { getAllRooms } from "./room-manager.ts";

function handleAdminListRooms(ws: ServerWebSocket<WebSocketData>) {
  const rooms = getAllRooms();

  const roomList = rooms.map(room => ({
    roomCode: room.roomCode,
    playerCount: room.players.size,
    gameStatus: room.gameStatus,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      connected: p.connected
    }))
  }));

  ws.send(JSON.stringify({
    type: "adminRoomList",
    rooms: roomList
  }));
}
```
</details>

**`handleAdminWatchRoom`** — Start watching a specific room:

<details>
<summary>💡 Hint: handleAdminWatchRoom</summary>

```ts
function handleAdminWatchRoom(
  ws: ServerWebSocket<WebSocketData>,
  adminState: AdminState,
  roomCode: string
) {
  const room = getRoom(roomCode);
  if (!room) {
    throw new Error("Room not found");
  }

  // Unwatch previous room if any
  if (adminState.watchingRoom) {
    ws.unsubscribe("admin_" + adminState.watchingRoom);
  }

  setWatchingRoom(adminState, roomCode);

  // Subscribe to room updates (admin-prefixed topic)
  ws.subscribe("admin_" + roomCode);

  // Send current room state
  sendAdminRoomState(ws, room);

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: `Now watching room ${roomCode}`
  }));
}
```
</details>

**`handleAdminUnwatchRoom`** — Stop watching:

<details>
<summary>💡 Hint: handleAdminUnwatchRoom</summary>

```ts
function handleAdminUnwatchRoom(
  ws: ServerWebSocket<WebSocketData>,
  adminState: AdminState
) {
  if (adminState.watchingRoom) {
    ws.unsubscribe("admin_" + adminState.watchingRoom);
  }
  clearWatchingRoom(adminState);

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: "Stopped watching room"
  }));
}
```
</details>

**`handleAdminTogglePower`** — Toggle a god mode power:

<details>
<summary>💡 Hint: handleAdminTogglePower</summary>

```ts
function handleAdminTogglePower(
  ws: ServerWebSocket<WebSocketData>,
  adminState: AdminState,
  power: string
) {
  const validPowers: PowerName[] = ["seeAllHands", "manipulateCards", "controlTurns", "roomControl"];

  if (!validPowers.includes(power as PowerName)) {
    throw new Error(`Invalid power: ${power}`);
  }

  const newValue = togglePower(adminState, power as PowerName);

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: `${power} is now ${newValue ? "ON" : "OFF"}`
  }));

  // If seeAllHands was just turned on, send hands immediately
  if (power === "seeAllHands" && newValue && adminState.watchingRoom) {
    sendAdminAllHands(ws, adminState.watchingRoom);
  }
}
```
</details>

### 3.4: Helper — `sendAdminRoomState`

Create a helper that sends the full room state to the admin:

<details>
<summary>💡 Hint: sendAdminRoomState</summary>

```ts
function sendAdminRoomState(ws: ServerWebSocket<WebSocketData>, room: Room) {
  const topCard = room.discardPile.length > 0
    ? room.discardPile[room.discardPile.length - 1]
    : null;

  const currentPlayerId = room.gameStatus === "playing"
    ? getCurrentPlayer(room)
    : null;

  ws.send(JSON.stringify({
    type: "adminRoomState",
    room: {
      roomCode: room.roomCode,
      gameStatus: room.gameStatus,
      direction: room.direction,
      pendingDraws: room.pendingDraws,
      reverseStackCount: room.reverseStackCount,
      currentPlayerId,
      topCard,
      lastPlayedColor: room.lastPlayedColor,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        connected: p.connected,
        cardCount: room.playerHands.get(p.id)?.length || 0,
        isHost: p.id === room.hostId
      }))
    }
  }));
}
```
</details>

### 3.5: Helper — `sendAdminAllHands`

Sends every player's actual cards to the admin:

<details>
<summary>💡 Hint: sendAdminAllHands</summary>

```ts
function sendAdminAllHands(ws: ServerWebSocket<WebSocketData>, roomCode: string) {
  const room = getRoom(roomCode);
  if (!room) return;

  const hands: Record<string, Card[]> = {};

  for (const [playerId, hand] of room.playerHands) {
    hands[playerId] = hand;
  }

  ws.send(JSON.stringify({
    type: "adminAllHands",
    hands
  }));
}
```
</details>

**Checkpoint 3:** Test admin WebSocket in browser DevTools:
```js
const ws = new WebSocket("ws://localhost:3000/ws?admin=true");
ws.onmessage = (e) => console.log(JSON.parse(e.data));

// Wait for connection...
ws.send(JSON.stringify({ action: "adminListRooms" }));
// Should get { type: "adminRoomList", rooms: [...] }

ws.send(JSON.stringify({ action: "adminTogglePower", power: "seeAllHands" }));
// Should get { type: "adminResult", success: true, message: "seeAllHands is now ON" }
```

---

## Step 4: Room Manager Extensions

**Goal:** Add admin-specific functions to `room-manager.ts`.

### 4.1: `getAllRooms()`

Return all rooms as an array:

<details>
<summary>💡 Hint: getAllRooms</summary>

```ts
export function getAllRooms(): Room[] {
  return Array.from(rooms.values());
}
```
</details>

### 4.2: `kickPlayer(roomCode, playerId)`

Remove a player from a room (admin action):

<details>
<summary>💡 Hint: kickPlayer</summary>

```ts
export function kickPlayer(roomCode: string, playerId: string): void {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Room not found");

  const player = room.players.get(playerId);
  if (!player) throw new Error("Player not in room");

  // Remove player
  room.players.delete(playerId);
  room.playerHands.delete(playerId);

  // If host was kicked, transfer host
  if (playerId === room.hostId && room.players.size > 0) {
    room.hostId = room.players.keys().next().value;
  }

  // If room is empty, delete it
  if (room.players.size === 0) {
    rooms.delete(roomCode);
  }

  // If game is playing and kicked player was current, advance turn
  if (room.gameStatus === "playing") {
    const playerIds = Array.from(room.players.keys());
    if (room.currentPlayerIndex >= playerIds.length) {
      room.currentPlayerIndex = 0;
    }
  }
}
```
</details>

### 4.3: `forceStartGame(roomCode)`

Start a game bypassing the 3-player minimum:

<details>
<summary>💡 Hint: forceStartGame</summary>

```ts
export function forceStartGame(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Room not found");

  if (room.players.size < 1) {
    throw new Error("Need at least 1 player");
  }

  if (room.gameStatus !== "waiting") {
    throw new Error("Game already started");
  }

  // Use startGame from game-logic but bypass player count check
  // Deal cards and set up game state directly
  room.playerHands = new Map();
  for (const playerId of room.players.keys()) {
    const hand: Card[] = [];
    for (let i = 0; i < 7; i++) {
      hand.push(generateCard());
    }
    room.playerHands.set(playerId, hand);
  }

  // Generate initial discard card (not wild)
  let initialCard: Card;
  do {
    initialCard = generateCard();
  } while (initialCard.type === "wild");

  room.discardPile = [initialCard];
  room.lastPlayedColor = "color" in initialCard ? initialCard.color : null;
  room.currentPlayerIndex = 0;
  room.direction = 1;
  room.pendingDraws = 0;
  room.reverseStackCount = 0;
  room.gameStatus = "playing";
}
```
</details>

### 4.4: `endGame(roomCode)`

Force-end a game:

<details>
<summary>💡 Hint: endGame</summary>

```ts
export function endGame(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Room not found");

  room.gameStatus = "finished";
  room.winnerId = undefined; // No winner — admin ended it
}
```
</details>

**Checkpoint 4:** Test room manager extensions:
```ts
// At bottom of room-manager.ts (temporary):
const r = createRoom("Alice", "😎");
joinRoom(r.roomCode, "Bob", "🔥");

console.log("All rooms:", getAllRooms().length); // 1

forceStartGame(r.roomCode);
console.log("Status:", getRoom(r.roomCode)!.gameStatus); // "playing"

endGame(r.roomCode);
console.log("After end:", getRoom(r.roomCode)!.gameStatus); // "finished"
```

Run: `bun room-manager.ts`

---

## Step 5: Game Logic Admin Functions

**Goal:** Add admin manipulation functions to `game-logic.ts`.

### 5.1: `adminGiveCard(room, playerId, card?)`

Give a specific card to a player, or a random one if no card specified:

<details>
<summary>💡 Hint: adminGiveCard</summary>

```ts
export function adminGiveCard(room: Room, playerId: string, card?: Card): Card {
  const hand = room.playerHands.get(playerId);
  if (!hand) throw new Error("Player not in room");

  const newCard = card || generateCard();
  hand.push(newCard);
  return newCard;
}
```
</details>

### 5.2: `adminRemoveCard(room, playerId, cardIndex)`

Remove a specific card from a player's hand:

<details>
<summary>💡 Hint: adminRemoveCard</summary>

```ts
export function adminRemoveCard(room: Room, playerId: string, cardIndex: number): Card {
  const hand = room.playerHands.get(playerId);
  if (!hand) throw new Error("Player not in room");

  if (cardIndex < 0 || cardIndex >= hand.length) {
    throw new Error("Invalid card index");
  }

  const removed = hand.splice(cardIndex, 1)[0];

  // Check win condition
  if (hand.length === 0) {
    room.gameStatus = "finished";
    room.winnerId = playerId;
  }

  return removed;
}
```
</details>

### 5.3: `adminSetTopCard(room, card)`

Replace the top card on the discard pile:

<details>
<summary>💡 Hint: adminSetTopCard</summary>

```ts
export function adminSetTopCard(room: Room, card: Card): void {
  room.discardPile.push(card);

  if (card.type === "wild") {
    room.lastPlayedColor = card.chosenColor || null;
  } else if ("color" in card) {
    room.lastPlayedColor = card.color;
  }
}
```
</details>

### 5.4: `adminSkipTurn(room)`

Skip the current player's turn:

<details>
<summary>💡 Hint: adminSkipTurn</summary>

```ts
export function adminSkipTurn(room: Room): void {
  if (room.gameStatus !== "playing") {
    throw new Error("Game not in progress");
  }

  advanceTurn(room);
}
```
</details>

### 5.5: `adminForceDraw(room, playerId, count)`

Force a player to draw N cards:

<details>
<summary>💡 Hint: adminForceDraw</summary>

```ts
export function adminForceDraw(room: Room, playerId: string, count: number): Card[] {
  const hand = room.playerHands.get(playerId);
  if (!hand) throw new Error("Player not in room");

  const drawnCards: Card[] = [];
  for (let i = 0; i < count; i++) {
    const card = generateCard();
    hand.push(card);
    drawnCards.push(card);
  }

  return drawnCards;
}
```
</details>

### 5.6: `adminReverseDirection(room)`

Flip the turn direction:

<details>
<summary>💡 Hint: adminReverseDirection</summary>

```ts
export function adminReverseDirection(room: Room): void {
  room.direction = (room.direction === 1 ? -1 : 1) as 1 | -1;
}
```
</details>

### 5.7: `adminSetCurrentPlayer(room, playerId)`

Set whose turn it is:

<details>
<summary>💡 Hint: adminSetCurrentPlayer</summary>

```ts
export function adminSetCurrentPlayer(room: Room, playerId: string): void {
  const playerIds = Array.from(room.players.keys());
  const index = playerIds.indexOf(playerId);

  if (index === -1) {
    throw new Error("Player not in room");
  }

  room.currentPlayerIndex = index;
}
```
</details>

**Checkpoint 5:** Test admin game functions:
```ts
// After setting up a game with startGame(mockRoom):

// Give a +20 to Player A
const given = adminGiveCard(mockRoom, "p1", { type: "plus20" });
console.log("Gave:", given); // { type: "plus20" }
console.log("Hand size:", mockRoom.playerHands.get("p1")!.length); // 8

// Force Player B to draw 5
const drawn = adminForceDraw(mockRoom, "p2", 5);
console.log("Drew:", drawn.length); // 5
console.log("B's hand size:", mockRoom.playerHands.get("p2")!.length); // 12

// Reverse direction
console.log("Direction before:", mockRoom.direction); // 1
adminReverseDirection(mockRoom);
console.log("Direction after:", mockRoom.direction); // -1

// Skip turn
const before = getCurrentPlayer(mockRoom);
adminSkipTurn(mockRoom);
const after = getCurrentPlayer(mockRoom);
console.log("Turn moved from", before, "to", after);

// Set current player
adminSetCurrentPlayer(mockRoom, "p3");
console.log("Current:", getCurrentPlayer(mockRoom)); // "p3"
```

Run: `bun game-logic.ts`

---

## Step 6: Wire Admin Actions to Server

**Goal:** Connect the admin handler to room-manager and game-logic functions.

### 6.1: Implement God Mode Action Handlers

Now implement each admin action handler. Each one should:
1. Validate the required power is enabled
2. Get the watched room
3. Call the appropriate function
4. Send updated state back to admin
5. Broadcast game state to players if game changed

**`handleAdminGetAllHands`:**

<details>
<summary>💡 Hint: Implementation</summary>

```ts
function handleAdminGetAllHands(ws: ServerWebSocket<WebSocketData>, adminState: AdminState) {
  validateAdminAction(adminState, "seeAllHands");
  sendAdminAllHands(ws, adminState.watchingRoom!);
}
```
</details>

**`handleAdminGiveCard`:**

<details>
<summary>💡 Hint: Implementation</summary>

```ts
function handleAdminGiveCard(ws: ServerWebSocket<WebSocketData>, adminState: AdminState, msg: any) {
  validateAdminAction(adminState, "manipulateCards");

  const room = getRoom(adminState.watchingRoom!);
  if (!room) throw new Error("Room not found");

  const card = adminGiveCard(room, msg.playerId, msg.card);

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: `Gave card to ${room.players.get(msg.playerId)?.name}`
  }));

  // Update admin view
  sendAdminRoomState(ws, room);
  if (adminState.powers.seeAllHands) {
    sendAdminAllHands(ws, adminState.watchingRoom!);
  }

  // Broadcast to players
  broadcastGameState(adminState.watchingRoom!);
}
```
</details>

**`handleAdminRemoveCard`:**

<details>
<summary>💡 Hint: Implementation</summary>

```ts
function handleAdminRemoveCard(ws: ServerWebSocket<WebSocketData>, adminState: AdminState, msg: any) {
  validateAdminAction(adminState, "manipulateCards");

  const room = getRoom(adminState.watchingRoom!);
  if (!room) throw new Error("Room not found");

  const removed = adminRemoveCard(room, msg.playerId, msg.cardIndex);

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: `Removed card from ${room.players.get(msg.playerId)?.name}`
  }));

  sendAdminRoomState(ws, room);
  if (adminState.powers.seeAllHands) {
    sendAdminAllHands(ws, adminState.watchingRoom!);
  }
  broadcastGameState(adminState.watchingRoom!);
}
```
</details>

**`handleAdminSetTopCard`:**

<details>
<summary>💡 Hint: Implementation</summary>

```ts
function handleAdminSetTopCard(ws: ServerWebSocket<WebSocketData>, adminState: AdminState, msg: any) {
  validateAdminAction(adminState, "manipulateCards");

  const room = getRoom(adminState.watchingRoom!);
  if (!room) throw new Error("Room not found");

  adminSetTopCard(room, msg.card);

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: "Top card changed"
  }));

  sendAdminRoomState(ws, room);
  broadcastGameState(adminState.watchingRoom!);
}
```
</details>

**`handleAdminSkipTurn`:**

<details>
<summary>💡 Hint: Implementation</summary>

```ts
function handleAdminSkipTurn(ws: ServerWebSocket<WebSocketData>, adminState: AdminState) {
  validateAdminAction(adminState, "controlTurns");

  const room = getRoom(adminState.watchingRoom!);
  if (!room) throw new Error("Room not found");

  adminSkipTurn(room);

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: "Turn skipped"
  }));

  sendAdminRoomState(ws, room);
  broadcastGameState(adminState.watchingRoom!);
}
```
</details>

**`handleAdminForceDraw`:**

<details>
<summary>💡 Hint: Implementation</summary>

```ts
function handleAdminForceDraw(ws: ServerWebSocket<WebSocketData>, adminState: AdminState, msg: any) {
  validateAdminAction(adminState, "controlTurns");

  const room = getRoom(adminState.watchingRoom!);
  if (!room) throw new Error("Room not found");

  const count = msg.count || 1;
  const drawn = adminForceDraw(room, msg.playerId, count);

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: `Forced ${room.players.get(msg.playerId)?.name} to draw ${drawn.length} cards`
  }));

  sendAdminRoomState(ws, room);
  if (adminState.powers.seeAllHands) {
    sendAdminAllHands(ws, adminState.watchingRoom!);
  }
  broadcastGameState(adminState.watchingRoom!);
}
```
</details>

**`handleAdminReverseDirection`:**

<details>
<summary>💡 Hint: Implementation</summary>

```ts
function handleAdminReverseDirection(ws: ServerWebSocket<WebSocketData>, adminState: AdminState) {
  validateAdminAction(adminState, "controlTurns");

  const room = getRoom(adminState.watchingRoom!);
  if (!room) throw new Error("Room not found");

  adminReverseDirection(room);

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: `Direction reversed to ${room.direction === 1 ? "clockwise" : "counter-clockwise"}`
  }));

  sendAdminRoomState(ws, room);
  broadcastGameState(adminState.watchingRoom!);
}
```
</details>

**`handleAdminSetCurrentPlayer`:**

<details>
<summary>💡 Hint: Implementation</summary>

```ts
function handleAdminSetCurrentPlayer(ws: ServerWebSocket<WebSocketData>, adminState: AdminState, msg: any) {
  validateAdminAction(adminState, "controlTurns");

  const room = getRoom(adminState.watchingRoom!);
  if (!room) throw new Error("Room not found");

  adminSetCurrentPlayer(room, msg.playerId);

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: `Turn set to ${room.players.get(msg.playerId)?.name}`
  }));

  sendAdminRoomState(ws, room);
  broadcastGameState(adminState.watchingRoom!);
}
```
</details>

**`handleAdminKickPlayer`:**

<details>
<summary>💡 Hint: Implementation</summary>

```ts
function handleAdminKickPlayer(ws: ServerWebSocket<WebSocketData>, adminState: AdminState, msg: any) {
  validateAdminAction(adminState, "roomControl");

  const room = getRoom(adminState.watchingRoom!);
  if (!room) throw new Error("Room not found");

  const playerName = room.players.get(msg.playerId)?.name || "Unknown";
  kickPlayer(adminState.watchingRoom!, msg.playerId);

  // Broadcast kick notification to room
  server.publish(adminState.watchingRoom!, JSON.stringify({
    type: "playerKicked",
    playerId: msg.playerId,
    reason: "Removed by admin"
  }));

  // Broadcast updated player list
  server.publish(adminState.watchingRoom!, JSON.stringify({
    type: "playerList",
    players: getRoomPlayerList(adminState.watchingRoom!)
  }));

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: `Kicked ${playerName}`
  }));

  // Refresh admin room state (room may have been deleted if empty)
  const updatedRoom = getRoom(adminState.watchingRoom!);
  if (updatedRoom) {
    sendAdminRoomState(ws, updatedRoom);
  }
}
```
</details>

**`handleAdminEndGame`:**

<details>
<summary>💡 Hint: Implementation</summary>

```ts
function handleAdminEndGame(ws: ServerWebSocket<WebSocketData>, adminState: AdminState) {
  validateAdminAction(adminState, "roomControl");

  endGame(adminState.watchingRoom!);

  server.publish(adminState.watchingRoom!, JSON.stringify({
    type: "gameEnded",
    reason: "Ended by admin"
  }));

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: "Game ended"
  }));

  const room = getRoom(adminState.watchingRoom!);
  if (room) sendAdminRoomState(ws, room);
}
```
</details>

**`handleAdminForceStart`:**

<details>
<summary>💡 Hint: Implementation</summary>

```ts
function handleAdminForceStart(ws: ServerWebSocket<WebSocketData>, adminState: AdminState) {
  validateAdminAction(adminState, "roomControl");

  forceStartGame(adminState.watchingRoom!);

  server.publish(adminState.watchingRoom!, JSON.stringify({
    type: "gameStarted",
    message: "Game force-started by admin"
  }));

  broadcastGameState(adminState.watchingRoom!);

  ws.send(JSON.stringify({
    type: "adminResult",
    success: true,
    message: "Game force-started"
  }));

  const room = getRoom(adminState.watchingRoom!);
  if (room) sendAdminRoomState(ws, room);
}
```
</details>

### 6.2: Auto-Update Admin on Game Events

When regular game actions happen (player plays card, draws, etc.), send updated state to any watching admin. Add this at the end of your existing `broadcastGameState` function:

<details>
<summary>💡 Hint: Admin notification on game events</summary>

```ts
// At the end of broadcastGameState(roomCode):

// Also publish to admin watchers
server.publish("admin_" + roomCode, JSON.stringify({
  type: "adminGameUpdate",
  roomCode
}));
```

Then in the admin WebSocket `message` handler, when receiving `adminGameUpdate`, the admin client will re-fetch the room state and hands.

Alternatively, you can directly send the state to the admin topic:

```ts
// After broadcasting game state to players, also send admin state
const room = getRoom(roomCode);
if (room) {
  const adminStateMsg = {
    type: "adminRoomState",
    room: {
      roomCode: room.roomCode,
      gameStatus: room.gameStatus,
      direction: room.direction,
      pendingDraws: room.pendingDraws,
      reverseStackCount: room.reverseStackCount,
      currentPlayerId: room.gameStatus === "playing" ? getCurrentPlayer(room) : null,
      topCard: room.discardPile.length > 0 ? room.discardPile[room.discardPile.length - 1] : null,
      lastPlayedColor: room.lastPlayedColor,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        connected: p.connected,
        cardCount: room.playerHands.get(p.id)?.length || 0,
        isHost: p.id === room.hostId
      }))
    }
  };

  server.publish("admin_" + roomCode, JSON.stringify(adminStateMsg));
}
```
</details>

---

## Final Checkpoint: Test Everything

### Test 1: Admin Authentication
1. Visit `http://localhost:3000/admin` → 401 Unauthorized
2. Visit `http://localhost:3000/admin?password=wrong` → 401 Unauthorized
3. Visit `http://localhost:3000/admin?password=insane8admin` → Admin page loads

### Test 2: Room List & Watching
1. Create a room from a regular browser tab
2. In admin panel, click "Refresh Rooms" → see the room
3. Click the room to watch it → see room state

### Test 3: God Mode Powers
Open browser DevTools on the admin page and test each power:

**See All Hands:**
1. Toggle ON
2. Verify you can see every player's cards
3. Toggle OFF → cards hidden again

**Manipulate Cards:**
1. Toggle ON
2. Give a +20 card to a player → verify their hand updates
3. Remove a card → verify it's gone
4. Change top card → verify discard pile updates

**Control Turns:**
1. Toggle ON
2. Skip turn → verify current player changes
3. Force draw 10 cards → verify player's hand grows
4. Reverse direction → verify arrow changes
5. Set current player → verify turn indicator

**Room Control:**
1. Toggle ON
2. Force-start a game with 2 players → game begins
3. Kick a player → player removed, others see updated list
4. End game → game over for all players

### Test 4: Powers Disabled
1. Turn OFF all powers
2. Try each action → should get error "Power X is not enabled"

---

## What You Built

- ✅ Admin state manager with togglable god mode powers
- ✅ Password-protected admin route
- ✅ Admin WebSocket authentication
- ✅ Room watching system
- ✅ See All Hands — view every player's cards
- ✅ Card manipulation — give, remove, change top card
- ✅ Turn control — skip, force draw, reverse, set player
- ✅ Room control — kick, end game, force-start
- ✅ All powers OFF by default
- ✅ Power validation before every action
- ✅ Real-time admin state updates on game events

## Questions for Understanding

- Why keep all powers OFF by default?
- What happens if admin kicks the current player mid-turn?
- How does `validateAdminAction` prevent unauthorized actions?
- Why use a separate `admin_` topic prefix for admin subscriptions?
- What security risks exist with password-in-URL authentication?

---

**You now have god mode over every game.** Use it wisely... or don't. It's your game.
