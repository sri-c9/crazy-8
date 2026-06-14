# Prod Bug Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 8 confirmed bugs (issues 1–9 from audit, issue 4 confirmed false positive) to make the game production-ready.

**Architecture:** Targeted, minimal fixes — each touches only the exact lines that are wrong. No refactoring. No new abstractions. Server-side fixes in `server.ts`/`game-logic.ts`; client-side fixes in `public/game-client.ts` and `public/index.html`.

**Tech Stack:** Bun + TypeScript (server), vanilla TypeScript (client), no test framework (verify via manual server test steps).

---

## Quick Reference: What We're Fixing

| # | Issue | File | Type |
|---|-------|------|------|
| 1 | Disconnected player can still send play/draw actions | server.ts | Server bug |
| 2 | `handleJoin` silently truncates names instead of rejecting | server.ts | Validation |
| 3 | `handleJoin` uses wrong room code regex | server.ts | Validation |
| 5 | `reverseStackCount` not reset when player draws | game-logic.ts | Game logic |
| 6 | Draw button has no debounce — rapid clicks send multiple requests | game-client.ts | Client bug |
| 7 | Color picker stays open when game ends | game-client.ts | Client bug |
| 8 | `handleRejoin` accepts any `playerId` — no session proof | server.ts + room-manager.ts + client | Security |
| 9 | `playCard()` silently picks random color for wild cards when `chosenColor` missing | game-logic.ts | Game logic |
| 14 | Generic error messages mask real errors in catch blocks | server.ts | Error handling |

> Issue 4 (skip target calculation) was a **false positive** — server and game-logic use the same formula on unchanged state.

---

### Task 1: Fix handleJoin validation (issues 2, 3, 14)

**Files:**
- Modify: `server.ts:435-478`

**What's wrong:**
- Line 435: `validateString(msg.roomCode, "roomCode").toUpperCase()` + inline regex — should use `validateRoomCode()`
- Line 436: `validateString(msg.playerName, "playerName").slice(0, 20)` — should use `validatePlayerName()`
- Lines 440-443: redundant inline regex check, now covered by `validateRoomCode()`
- Lines 471-477: catch sends generic "Failed to join room" instead of `safeErrorMessage(error)`

**Step 1: Make the changes**

In `server.ts`, find the `handleJoin` function. Replace lines 435–443:

```typescript
// BEFORE (lines 435-443):
const roomCode = validateString(msg.roomCode, "roomCode").toUpperCase();
const playerName = validateString(msg.playerName, "playerName").slice(0, 20);
const avatar = validateString(msg.avatar, "avatar");

// 2A-3: Validate room code format
if (!/^[A-Z0-9]{4}$/.test(roomCode)) {
  ws.send(JSON.stringify({ type: "error", message: "Invalid room code" }));
  return;
}
```

```typescript
// AFTER:
const roomCode = validateRoomCode(msg.roomCode);
const playerName = validatePlayerName(msg.playerName);
const avatar = validateString(msg.avatar, "avatar");
```

Then fix the catch block at lines 470-477:

```typescript
// BEFORE:
} catch (error) {
  console.error("Join room error:", error);
  ws.send(
    JSON.stringify({
      type: "error",
      message: "Failed to join room",
    }),
  );
}
```

```typescript
// AFTER:
} catch (error) {
  console.error("Join room error:", error);
  ws.send(
    JSON.stringify({
      type: "error",
      message: safeErrorMessage(error),
    }),
  );
}
```

**Step 2: Also fix handlePlayCard and handleDrawCard catch blocks (issue 14)**

In `handlePlayCard` catch (lines 760-767):

```typescript
// BEFORE:
message: "Invalid play",
// AFTER:
message: safeErrorMessage(error),
```

In `handleDrawCard` catch (lines 806-813):

```typescript
// BEFORE:
message: "Failed to draw card",
// AFTER:
message: safeErrorMessage(error),
```

**Step 3: Verify the server still starts**

```bash
bun server.ts
```

Expected: Server starts on port 3000 with no TypeScript errors.

**Step 4: Commit**

```bash
git add server.ts
git commit -m "fix: use validateRoomCode/validatePlayerName in handleJoin, surface real error messages"
```

---

### Task 2: Add connected-player guard to handlePlayCard and handleDrawCard (issue 1)

**Files:**
- Modify: `server.ts:663-668` (handlePlayCard), `server.ts:780-793` (handleDrawCard)

**What's wrong:** A player whose `connected` flag is `false` (disconnected but WebSocket briefly still open) can send play/draw actions. The check for `player` existence doesn't check `player.connected`.

**Step 1: Fix handlePlayCard**

Find lines 663-667 in `handlePlayCard`:
```typescript
const player = room.players.get(playerId);
if (!player) {
  ws.send(JSON.stringify({ type: "error", message: "Player not found" }));
  return;
}
```

Replace with:
```typescript
const player = room.players.get(playerId);
if (!player) {
  ws.send(JSON.stringify({ type: "error", message: "Player not found" }));
  return;
}

if (!player.connected) {
  ws.send(JSON.stringify({ type: "error", message: "You are disconnected" }));
  return;
}
```

**Step 2: Fix handleDrawCard**

`handleDrawCard` currently doesn't retrieve the player at all. After the `room.status` check (line ~790), add:

```typescript
// Check game status
if (room.status !== GameStatus.playing) {
  ws.send(JSON.stringify({ type: "error", message: "Game is not in progress" }));
  return;
}

// ADD THESE LINES:
const player = room.players.get(playerId);
if (!player) {
  ws.send(JSON.stringify({ type: "error", message: "Player not found" }));
  return;
}
if (!player.connected) {
  ws.send(JSON.stringify({ type: "error", message: "You are disconnected" }));
  return;
}
```

**Step 3: Add "You are disconnected" to safePatterns in safeErrorMessage**

Find `safePatterns` array (lines 80-87) and add:

```typescript
"You are disconnected",
```

**Step 4: Verify server starts**

```bash
bun server.ts
```

Expected: No TypeScript errors.

**Step 5: Commit**

```bash
git add server.ts
git commit -m "fix: reject play/draw actions from disconnected players"
```

---

### Task 3: Reset reverseStackCount on draw (issue 5)

**Files:**
- Modify: `game-logic.ts:386-387`

**What's wrong:** When a player draws a card, `reverseStackCount` is not reset. A player playing reverse, then the next player drawing, then a third player playing reverse would see `reverseStackCount = 1` instead of `0`, meaning they have one less reverse available to stack.

**Step 1: Fix drawCard()**

In `game-logic.ts`, find these lines in `drawCard()`:

```typescript
// Advance turn after drawing
advanceTurn(room);
```

Replace with:

```typescript
// Reset reverse stack on draw (drawing counts as breaking the chain)
room.reverseStackCount = 0;

// Advance turn after drawing
advanceTurn(room);
```

**Step 2: Verify server starts**

```bash
bun server.ts
```

**Step 3: Commit**

```bash
git add game-logic.ts
git commit -m "fix: reset reverseStackCount when a player draws a card"
```

---

### Task 4: Enforce chosenColor in playCard() for wild cards (issue 9)

**Files:**
- Modify: `game-logic.ts:331-337`

**What's wrong:** `playCard()` uses `chosenColor || randomColor()` as a fallback, which means if the server somehow calls it without a color (or if the validation is bypassed), the game silently picks a random color. The client doesn't know the chosen color, causing UI desync.

**Step 1: Fix the wild card color assignment**

Find lines 331-337 in `game-logic.ts`:

```typescript
// Update lastPlayedColor for all card types
if (card.type === "wild" || card.type === "plus4" || card.type === "plus20") {
  // Wild-type cards: use chosenColor, fall back to random (defense-in-depth)
  room.lastPlayedColor = chosenColor || randomColor();
} else if ("color" in card) {
  room.lastPlayedColor = card.color;
}
```

Replace with:

```typescript
// Update lastPlayedColor for all card types
if (card.type === "wild" || card.type === "plus4" || card.type === "plus20") {
  if (!chosenColor) {
    throw new Error("Must choose a color");
  }
  room.lastPlayedColor = chosenColor;
} else if ("color" in card) {
  room.lastPlayedColor = card.color;
}
```

Note: `"Must choose a color"` is already in `safePatterns` in `server.ts` so the error will propagate to the client correctly.

**Step 2: Verify server starts**

```bash
bun server.ts
```

**Step 3: Commit**

```bash
git add game-logic.ts
git commit -m "fix: throw in playCard() if wild card played without chosenColor"
```

---

### Task 5: Add draw button debounce (issue 6)

**Files:**
- Modify: `public/game-client.ts:564-571`, `public/game-client.ts:219-222`

**What's wrong:** `drawCards()` has no guard against rapid clicks. Multiple draw requests can be sent before the server responds. `isPlayPending` is used for card plays but not for draws.

**Step 1: Guard drawCards() with isPlayPending**

Find `drawCards()` in `game-client.ts`:

```typescript
// Draw card
function drawCards() {
  if (!ws) return;
  if (gameOver) return; // Don't allow interactions after game over

  safeSend({
    action: "draw",
  });
}
```

Replace with:

```typescript
// Draw card
function drawCards() {
  if (!ws) return;
  if (gameOver) return; // Don't allow interactions after game over
  if (isPlayPending) return; // Prevent double-draw

  isPlayPending = true;
  safeSend({
    action: "draw",
  });
}
```

**Step 2: Disable draw button when isPlayPending**

Find the draw button disabled logic in `renderGameState()`:

```typescript
drawBtn.disabled = !isYourTurn;
```

Replace with:

```typescript
drawBtn.disabled = !isYourTurn || isPlayPending;
```

**Step 3: Build and verify**

```bash
bun run build
```

Expected: No TypeScript errors.

**Step 4: Commit**

```bash
git add public/game-client.ts
git commit -m "fix: prevent duplicate draw requests with isPlayPending guard"
```

---

### Task 6: Close color picker when game ends (issue 7)

**Files:**
- Modify: `public/game-client.ts:672-677`

**What's wrong:** If a player opens the color picker for a wild card and the game ends at that moment (another player wins), the color picker overlay stays visible on top of the game-over modal.

**Step 1: Add hideColorPicker() call**

Find `showGameOver()`:

```typescript
// Show game over
function showGameOver(winnerName: string) {
  gameOver = true; // Lock the game board
  document.getElementById("winnerName")!.textContent = winnerName;
  document.getElementById("gameOver")!.classList.remove("hidden");
}
```

Replace with:

```typescript
// Show game over
function showGameOver(winnerName: string) {
  gameOver = true; // Lock the game board
  hideColorPicker(); // Dismiss any open wild card color picker
  document.getElementById("winnerName")!.textContent = winnerName;
  document.getElementById("gameOver")!.classList.remove("hidden");
}
```

**Step 2: Build and verify**

```bash
bun run build
```

**Step 3: Commit**

```bash
git add public/game-client.ts
git commit -m "fix: close color picker when game ends"
```

---

### Task 7: Add session tokens to rejoin (issue 8)

**Files:**
- Modify: `room-manager.ts` — add `sessionToken` to Player, return it from createRoom/joinRoom
- Modify: `server.ts` — send token in responses, validate in handleRejoin
- Modify: `public/index.html` — store token in sessionStorage
- Modify: `public/game-client.ts` — send token with rejoin

**What's wrong:** `handleRejoin` accepts any `playerId` without proof the client originally owned it. While player IDs are pseudo-random (7 base-36 chars, ~78 billion possibilities) and hard to guess, they should be paired with an unforgeable secret.

**Step 1: Add sessionToken to Player in room-manager.ts**

Find the `Player` interface:

```typescript
interface Player {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
  hand: Card[];
}
```

Replace with:

```typescript
interface Player {
  id: string;
  sessionToken: string;
  name: string;
  avatar: string;
  connected: boolean;
  hand: Card[];
}
```

**Step 2: Generate and return sessionToken in createRoom()**

Find `createRoom()` in room-manager.ts. The `hostPlayer` object:

```typescript
let hostId = generatePlayerId();

const hostPlayer: Player = {
  id: hostId,
  name: playerName,
  avatar: avatar,
  connected: true,
  hand: [],
};
```

Replace with:

```typescript
let hostId = generatePlayerId();
const hostToken = crypto.randomUUID();

const hostPlayer: Player = {
  id: hostId,
  sessionToken: hostToken,
  name: playerName,
  avatar: avatar,
  connected: true,
  hand: [],
};
```

And the return:

```typescript
// BEFORE:
return { roomCode: roomCode, playerId: hostId };

// AFTER:
return { roomCode: roomCode, playerId: hostId, sessionToken: hostToken };
```

**Step 3: Generate and return sessionToken in joinRoom()**

Find `joinRoom()`. The player object creation:

```typescript
let playerId = generatePlayerId();
let player: Player = {
  id: playerId,
  name: playerName,
  avatar: avatar,
  connected: true,
  hand: [],
};

room.players.set(playerId, player);
return { playerId: playerId };
```

Replace with:

```typescript
let playerId = generatePlayerId();
const sessionToken = crypto.randomUUID();
let player: Player = {
  id: playerId,
  sessionToken,
  name: playerName,
  avatar: avatar,
  connected: true,
  hand: [],
};

room.players.set(playerId, player);
return { playerId, sessionToken };
```

**Step 4: Update createRoom/joinRoom export types in server.ts**

The `createRoom()` call in `handleCreate` (~line 395):

```typescript
const { roomCode, playerId } = createRoom(playerName, avatar);
```

```typescript
const { roomCode, playerId, sessionToken } = createRoom(playerName, avatar);
```

And the `roomCreated` response, find it and add the token:

```typescript
ws.send(
  JSON.stringify({
    type: "roomCreated",
    roomCode: roomCode,
    playerId: playerId,
    sessionToken: sessionToken,
  }),
);
```

The `joinRoom()` call in `handleJoin` (~line 445):

```typescript
const { playerId } = joinRoom(roomCode, playerName, avatar);
```

```typescript
const { playerId, sessionToken } = joinRoom(roomCode, playerName, avatar);
```

And the `joined` response, find it and add:

```typescript
ws.send(
  JSON.stringify({
    type: "joined",
    roomCode: roomCode,
    playerId: playerId,
    sessionToken: sessionToken,
  }),
);
```

**Step 5: Validate sessionToken in handleRejoin**

Add `sessionToken` to the `IncomingMessage` interface at the top of server.ts:

```typescript
interface IncomingMessage {
  action: string;
  playerName?: string;
  avatar?: string;
  roomCode?: string;
  playerId?: string;
  sessionToken?: string;  // ADD THIS
  cardIndex?: number;
  chosenColor?: CardColor;
}
```

In `handleRejoin`, after the `reconnectPlayer` call and player retrieval (around line 512-516):

```typescript
const player = room.players.get(playerId);
if (!player) {
  ws.send(JSON.stringify({ type: "error", message: "Player not found" }));
  return;
}
```

Add token validation:

```typescript
const player = room.players.get(playerId);
if (!player) {
  ws.send(JSON.stringify({ type: "error", message: "Player not found" }));
  return;
}

// Validate session token to prevent impersonation
const token = typeof msg.sessionToken === "string" ? msg.sessionToken : "";
if (player.sessionToken !== token) {
  ws.send(JSON.stringify({ type: "error", message: "Invalid session" }));
  return;
}
```

Also add `"Invalid session"` to the `safePatterns` array in `safeErrorMessage`.

**Step 6: Store sessionToken in client (index.html)**

Find `saveSession()` in `public/index.html`:

```javascript
function saveSession(roomCode, playerId, playerName, avatar) {
  sessionStorage.setItem('crazy8_roomCode', roomCode);
  sessionStorage.setItem('crazy8_playerId', playerId);
  sessionStorage.setItem('crazy8_playerName', playerName);
  sessionStorage.setItem('crazy8_avatar', avatar);
}
```

Replace with:

```javascript
function saveSession(roomCode, playerId, playerName, avatar, sessionToken) {
  sessionStorage.setItem('crazy8_roomCode', roomCode);
  sessionStorage.setItem('crazy8_playerId', playerId);
  sessionStorage.setItem('crazy8_playerName', playerName);
  sessionStorage.setItem('crazy8_avatar', avatar);
  sessionStorage.setItem('crazy8_sessionToken', sessionToken || '');
}
```

Find `clearSession()`:

```javascript
function clearSession() {
  sessionStorage.removeItem('crazy8_roomCode');
  sessionStorage.removeItem('crazy8_playerId');
  sessionStorage.removeItem('crazy8_playerName');
  sessionStorage.removeItem('crazy8_avatar');
}
```

Replace with:

```javascript
function clearSession() {
  sessionStorage.removeItem('crazy8_roomCode');
  sessionStorage.removeItem('crazy8_playerId');
  sessionStorage.removeItem('crazy8_playerName');
  sessionStorage.removeItem('crazy8_sessionToken');
  sessionStorage.removeItem('crazy8_avatar');
}
```

Find `getSavedSession()`:

```javascript
function getSavedSession() {
  const roomCode = sessionStorage.getItem('crazy8_roomCode');
  const playerId = sessionStorage.getItem('crazy8_playerId');
  const playerName = sessionStorage.getItem('crazy8_playerName');
  const avatar = sessionStorage.getItem('crazy8_avatar');
  if (roomCode && playerId && playerName && avatar) {
    return { roomCode, playerId, playerName, avatar };
  }
```

Replace with:

```javascript
function getSavedSession() {
  const roomCode = sessionStorage.getItem('crazy8_roomCode');
  const playerId = sessionStorage.getItem('crazy8_playerId');
  const playerName = sessionStorage.getItem('crazy8_playerName');
  const avatar = sessionStorage.getItem('crazy8_avatar');
  const sessionToken = sessionStorage.getItem('crazy8_sessionToken') || '';
  if (roomCode && playerId && playerName && avatar) {
    return { roomCode, playerId, playerName, avatar, sessionToken };
  }
```

Now find where `saveSession` is called. It's called in two places in the WebSocket message handler:

1. On `roomCreated`:
```javascript
case "roomCreated":
  currentRoomCode = data.roomCode;
  currentPlayerId = data.playerId;
  saveSession(data.roomCode, data.playerId, playerName, selectedAvatar);
```
Replace the saveSession call:
```javascript
saveSession(data.roomCode, data.playerId, playerName, selectedAvatar, data.sessionToken);
```

2. On `joined`:
```javascript
case "joined":
  currentRoomCode = data.roomCode;
  currentPlayerId = data.playerId;
  saveSession(data.roomCode, data.playerId, playerName, selectedAvatar);
```
Replace:
```javascript
saveSession(data.roomCode, data.playerId, playerName, selectedAvatar, data.sessionToken);
```

**Step 7: Send sessionToken in game-client.ts rejoin**

Find the WebSocket `onopen` handler in `game-client.ts`:

```typescript
ws.onopen = () => {
  console.log("Connected to game");
  reconnectAttempts = 0;
  hideLoading();

  // Identify ourselves to the server
  ws!.send(JSON.stringify({
    action: "rejoin",
    roomCode: roomCode,
    playerId: yourPlayerId,
  }));
};
```

Replace with:

```typescript
ws.onopen = () => {
  console.log("Connected to game");
  reconnectAttempts = 0;
  hideLoading();

  // Identify ourselves to the server
  const sessionToken = sessionStorage.getItem("crazy8_sessionToken") || "";
  ws!.send(JSON.stringify({
    action: "rejoin",
    roomCode: roomCode,
    playerId: yourPlayerId,
    sessionToken,
  }));
};
```

**Step 8: Verify TypeScript compiles clean**

```bash
bun run build
```

Expected: No errors.

**Step 9: Manual smoke test**

1. Start server: `bun server.ts`
2. Open browser at `http://localhost:3000`
3. Create a room — should work
4. Join the room from another tab — should work
5. Open browser DevTools → Network, find the WebSocket frames
6. Verify `roomCreated` and `joined` messages include `sessionToken`
7. Verify `rejoin` message sent on connect includes `sessionToken`

**Step 10: Commit**

```bash
git add room-manager.ts server.ts public/index.html public/game-client.ts
git commit -m "fix: add session tokens to prevent rejoin impersonation"
```

---

## Final Verification

After all tasks are done:

```bash
bun run build
bun server.ts
```

Open two browser tabs, create a room, join it, start the game. Verify:
- [ ] Cards can be played normally
- [ ] Draw button works once per turn
- [ ] Wild cards require color selection
- [ ] Game-over modal appears cleanly (no color picker behind it)
- [ ] Disconnecting and reconnecting rejoins correctly with the session token
