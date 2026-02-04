# Phase 4: UI Reference — Frontend (Claude Code Handles This)

This phase focuses entirely on frontend implementation, which Claude Code handles automatically. The information below is provided as a reference for understanding the expected UI structure and navigation flow.

## Overview

Phase 4 builds a mobile-optimized user interface with three main screens:
1. **Lobby Screen** - Room creation/joining with avatar picker
2. **Waiting Room** - Player list while waiting for game to start
3. **Game Screen** - Active gameplay board

## Navigation Flow

```
Lobby Screen
    ↓
    ├─ Create Room → Waiting Room (as host)
    └─ Join Room → Waiting Room (as player)
        ↓
        Start Game (host only) → Game Screen
```

## Session Management

The frontend should persist player session data to handle reconnection:

```ts
// On room join/create
sessionStorage.setItem("playerId", playerId);
sessionStorage.setItem("roomCode", roomCode);

// On reconnect
const playerId = sessionStorage.getItem("playerId");
const roomCode = sessionStorage.getItem("roomCode");
```

## Expected HTML Structure

### Lobby Screen (`public/index.html`)

- Player name input
- Avatar picker (emoji grid, 12 options)
- "Create Room" button
- Room code input + "Join Room" button

### Waiting Room

- Room code display with copy button
- Player cards showing:
  - Avatar
  - Name
  - Host badge (for host player)
  - Connection status (connected/disconnected)
- "Start Game" button (host only, min 3 players)
- "Leave Room" button

### Game Screen

- Game header:
  - Room code badge
  - Turn indicator
  - Connection status dot
- Opponents area (horizontal scroll)
- Center area:
  - Draw pile (card back + draw button)
  - Discard pile (top card display)
- Pending draws alert (when pendingDraws > 0)
- Your hand:
  - Hand label
  - Scrollable card list
  - Cards highlighted when playable
  - Wild card color picker modal

## WebSocket Message Flow

**Client → Server:**
```ts
{ action: "create", playerName: string, avatar: string }
{ action: "join", roomCode: string, playerName: string, avatar: string }
{ action: "startGame" }
{ action: "play", cardIndex: number, chosenColor?: CardColor }
{ action: "draw" }
```

**Server → Client:**
```ts
{ type: "roomCreated", roomCode: string, playerId: string }
{ type: "joined", roomCode: string, playerId: string }
{ type: "playerList", players: PlayerListItem[] }
{ type: "gameStarted", message: string }
{ type: "state", gameState: GameState, yourPlayerId: string }
{ type: "cardDrawn", cards: Card[], count: number }
{ type: "error", message: string }
```

## Card Rendering

Cards should be rendered with color-coded backgrounds:

- **Red cards**: Red gradient background
- **Blue cards**: Blue gradient background
- **Green cards**: Green gradient background
- **Yellow cards**: Yellow gradient background
- **Wild cards**: Rainbow gradient
- **Special cards (+4, +20)**: Purple gradient

Card text content:
- Number cards: Show number value
- Wild: Show paint palette emoji (🎨)
- +2/+4/+20: Show "+2", "+4", "+20"
- Skip: Show skip emoji (⏭)
- Reverse: Show reverse emoji (🔄)

## Mobile-First Design Principles

- **Max width**: 500px (centered on desktop)
- **Min width**: 320px (iPhone SE)
- **Touch targets**: Minimum 44px for buttons/cards
- **Horizontal scrolling**: For hand cards and opponents
- **Viewport meta tag**: `width=device-width, initial-scale=1.0`

## Key CSS Classes

```css
.screen { display: none; }
.screen.active { display: block; }
.card { /* Card component styles */ }
.card.playable { /* Highlighted when playable */ }
.card.red|blue|green|yellow { /* Color-specific gradients */ }
.player-card { /* Player info card in waiting room */ }
.avatar-option.selected { /* Selected avatar highlight */ }
```

## What Claude Code Builds

Claude Code will create:
- ✅ Complete HTML structure for all three screens
- ✅ Mobile-responsive CSS with gradients and animations
- ✅ WebSocket client connection and message handling
- ✅ Screen navigation logic
- ✅ Card rendering with proper colors and types
- ✅ Avatar picker with selection state
- ✅ Player list rendering
- ✅ Game state rendering (hand, opponents, top card)
- ✅ Wild card color picker modal
- ✅ Session persistence for reconnection

## Questions for Understanding

- Why use a three-screen approach instead of a single page?
- How does the avatar grid layout improve UX on mobile?
- Why store session data in sessionStorage vs localStorage?
- What happens to the UI when connection drops?

## Next Steps

Phase 5 will add backend features for error handling, reconnection, and polish:
- Error code mapping
- Reconnection handler
- Session resume logic
