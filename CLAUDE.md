# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Insane Crazy 8 is a real-time multiplayer card game built with Bun.js and TypeScript. Players create or join rooms via 4-character codes, pick emoji avatars, and play a variant of Crazy 8s with custom rules (plus-stacking, +20 cards, etc). The game runs locally and uses ngrok for sharing with friends on mobile.

## Development Commands

```bash
# Run server (production mode)
bun start

# Run server with auto-reload on file changes (development)
bun dev

# Expose server publicly (separate terminal)
ngrok http 3000

# Build frontend (TypeScript → JavaScript for browsers)
bun run build

# Test individual modules
bun room-manager.ts  # Test room management logic
```

## Architecture

### Real-time Communication: Bun's Pub/Sub Pattern

The core multiplayer infrastructure uses **Bun's native WebSocket pub/sub topics**. This is the most important architectural decision:

- Each room code (e.g., "ABXY") is a pub/sub topic
- Players subscribe to their room's topic via `ws.subscribe(roomCode)`
- Broadcasting to all players in a room: `server.publish(roomCode, message)`
- No manual WebSocket connection tracking needed — Bun handles fan-out

**Key implication:** When adding features that broadcast state to a room, always use `server.publish(roomCode, data)` rather than iterating over connections.

### Server Components

**`server.ts`** — Single Bun HTTP/WebSocket server
- Serves static files from `public/` using `Bun.file()`
- Upgrades WebSocket connections at `/ws`
- Attaches player metadata to `ws.data` during upgrade (playerId, playerName, avatar, roomCode)
- Routes incoming messages based on `action` field to room-manager functions
- WebSocket handlers: `open`, `message`, `close`

**`room-manager.ts`** — Pure state management (no I/O)
- In-memory `Map<roomCode, Room>` storing all active rooms
- Room contains `Map<playerId, PlayerInfo>` for O(1) player lookups
- Generates 4-character uppercase room codes with collision avoidance
- Exports: `createRoom()`, `joinRoom()`, `leaveRoom()`, `getRoomPlayerList()`, etc.
- **Design principle:** All validation happens here (room exists, not full, game not started)

**`game-logic.ts`** (Phase 2+) — Game rules engine
- Card validation (match color/number, wild cards)
- Turn order management with direction tracking
- Plus-card stacking logic (any +card stacks on any +card)
- Reverse stacking with 4-card limit
- Win condition detection

### Client Architecture

**Frontend:** TypeScript (no framework)
- `public/index.html` — Landing page with room creation/join, emoji avatar picker
- `public/game.html` — Game board
- `public/game-client.ts` — WebSocket client + DOM updates
- `public/lobby.ts` — Lobby/waiting room UI

**Why TypeScript with no framework?** The UI is simple (card game), and TypeScript provides type safety without framework complexity. Bun's bundler compiles `.ts` to browser-compatible `.js`.

**Note:** Frontend UI implementation (Phases 4, 6) is handled by Claude Code following the architectural patterns established in the plans.

### WebSocket Message Protocol

**Client → Server:**
```ts
interface CreateAction {
  action: "create";
  playerName: string;
  avatar: string;
}

interface JoinAction {
  action: "join";
  roomCode: string;
  playerName: string;
  avatar: string;
}

interface PlayAction {
  action: "play";
  cardIndex: number;
  chosenColor?: "red" | "blue" | "green" | "yellow";
}

interface DrawAction {
  action: "draw";
}

type ClientMessage = CreateAction | JoinAction | PlayAction | DrawAction;
```

**Server → Client (direct):**
```ts
interface RoomCreatedMessage {
  type: "roomCreated";
  roomCode: string;
  playerId: string;
}

interface JoinedMessage {
  type: "joined";
  roomCode: string;
  playerId: string;
}

interface ErrorMessage {
  type: "error";
  message: string;
}
```

**Server → Room (broadcast via pub/sub):**
```ts
interface PlayerListMessage {
  type: "playerList";
  players: Array<{
    id: string;
    name: string;
    avatar: string;
    connected: boolean;
    isHost: boolean;
  }>;
}

interface StateMessage {
  type: "state";
  gameState: GameState;
  yourPlayerId: string;
}
```

### State Management

**Room state** (server-side, in-memory):
```ts
interface PlayerInfo {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
}

interface Card {
  color: "red" | "blue" | "green" | "yellow" | "wild";
  value: number | "Skip" | "Reverse" | "+2" | "+4" | "+20";
}

interface Room {
  roomCode: string;
  players: Map<string, PlayerInfo>;
  hostId: string;
  gameStatus: "waiting" | "playing" | "finished";
  // Game state fields added in Phase 2+
  currentPlayerIndex?: number;
  direction?: 1 | -1;
  discardPile?: Card[];
  pendingDraws?: number;
  reverseStackCount?: number;
}
```

**Player metadata** (attached to WebSocket via `ws.data`):
```ts
interface WebSocketData {
  playerId: string;
  playerName: string;
  avatar: string;
  roomCode: string;
}
```

## Git Workflow (Gitflow Lite)

Use a three-tier branching strategy:

```
main (production-ready)
  ↑
develop (integration)
  ↑
feature/* or bugfix/* (active work)
```

**Never commit directly to `main` or `develop`.** Always work on `feature/*` or `bugfix/*` branches, merge to `develop` for testing, then to `main` for release.

## Game Rules (for context when implementing logic)

**"Insane" rules:**
- **Plus stacking:** Any +card (+2, +4, +20) can deflect to the next player by playing ANY +card, regardless of color
- **Reverse limit:** Max 4 reverse cards can stack in a row
- **Skip behavior:** Skip cards skip the next 2 players (not 1)
- **Infinite deck:** Server generates random cards on draw — no reshuffling needed
- **Card types:** Standard 0-7, 9 (normal), 8 (wild), +2/+4/+20 (draw), Skip, Reverse

## Implementation Phases

**Phase 1:** Core server & rooms — WebSocket infrastructure, room creation/joining, player list broadcasting
**Phase 2:** Game logic — Card dealing, turn management, basic card play validation
**Phase 3:** Special cards — Plus-stacking, Skip, Reverse logic
**Phase 4:** UI polish — Mobile-optimized game board, animations (Claude Code)
**Phase 5:** Error handling & reconnection
**Phase 6:** Animations & mobile UX (Claude Code)
**Phase 7:** Game settings & variations
**Phase 8:** Admin panel

See `docs/OVERVIEW.md` for full roadmap and `docs/plans/PHASE1-PLAN.md` through `PHASE8-PLAN.md` for detailed phase plans.

## Key Design Constraints

- **Mobile-first:** Everything must work on phone browsers (no iOS app)
- **Local deployment:** Designed to run on developer's laptop + ngrok (not cloud-hosted)
- **TypeScript everywhere:** Bun runs `.ts` files natively on the server; frontend TypeScript is compiled to JavaScript via Bun's bundler
- **No database:** All state is in-memory (rooms disappear on server restart)
- **3-6 players:** Room size is capped at 6, minimum 3 to start a game
