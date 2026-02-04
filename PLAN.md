# Insane Crazy 8 - Implementation & Design Plan

## Project Overview

A multiplayer web-based Crazy 8 card game with insane rules, designed for 3-6 players on mobile devices without requiring app store deployment.

## Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Runtime/Server** | Bun.js | Built-in HTTP + WebSocket support, no dependencies needed |
| **Frontend** | Vanilla HTML/CSS/JS | Zero build step, simple rendering, mobile-optimized |
| **Real-time** | Bun WebSocket API | Native WebSocket support, low latency |
| **State Management** | In-memory (server) | Stateful game rooms stored in Map, no database needed |
| **Deployment** | Local + ngrok | Run on local machine, expose via ngrok tunnel |

## Game Rules (v1)

### Card Types

| Card | Colors | Behavior |
|------|--------|----------|
| **0-7, 9** | Red, Blue, Green, Yellow | Normal cards - match by color or number |
| **8** | Wild (colorless) | Play anytime, picker chooses new color |
| **+2** | Red, Blue, Green, Yellow | Next player draws 2 (unless stacked) |
| **+4** | Wild (colorless) | Next player draws 4, picker chooses color |
| **+20** | Red, Blue, Green, Yellow | Next player draws 20 (unless stacked) |
| **Skip** | Red, Blue, Green, Yellow | Skip next 2 players |
| **Reverse** | Red, Blue, Green, Yellow | Reverse turn order, max 4 stack |

### Special Rules

1. **Plus Stacking**: Any plus card (+2, +4, +20) can stack on any other plus card regardless of color. Draws accumulate until a player can't stack.

2. **Reverse Stacking**: Reverse cards can stack on each other, maximum 4 in a row.

3. **Infinite Draw Pile**: Server generates random valid cards when players draw - no running out.

4. **Player Count**: 3-6 players per game.

5. **Win Condition**: First player to empty their hand wins.

### Admin Features (Future)

- Secret password-protected admin view
- Toggle custom features and rule variants
- Not implemented in v1

## Architecture

### High-Level Flow

```
┌─────────────────┐
│  Player Phones  │
│   (PWA/Web)     │
└────────┬────────┘
         │ WebSocket
         ▼
┌─────────────────┐
│   Bun Server    │
│  (Local + WS)   │
└────────┬────────┘
         │
┌────────▼────────┐
│   Game Rooms    │
│  (in-memory)    │
└─────────────────┘
         │
         ▼
    Public URL
   (ngrok tunnel)
```

### Server Components

**1. HTTP Server**
- Serves static files (HTML, CSS, JS)
- Handles room creation endpoint
- Health check endpoint

**2. WebSocket Server**
- Manages player connections
- Routes messages to appropriate game rooms
- Broadcasts game state updates

**3. Game Room Manager**
- Maintains Map of active game rooms
- Creates/destroys rooms
- Handles player join/leave

**4. Game Logic Engine**
- Validates card plays
- Manages turn order
- Handles special card effects
- Generates random cards for draw pile

### Client Components

**1. Game UI**
- Player's hand (bottom)
- Discard pile (center)
- Draw pile (center)
- Opponent info (top/sides)
- Current turn indicator
- Color selector modal (for wilds)

**2. WebSocket Client**
- Connects to server
- Sends player actions
- Receives state updates
- Handles reconnection

**3. State Renderer**
- Updates DOM based on game state
- Animates card plays
- Shows notifications

## Data Structures

### Game State (Server)

```javascript
{
  roomCode: string,           // 4-character room code
  players: [                  // Array of player objects
    {
      id: string,             // Unique player ID
      name: string,           // Display name
      hand: Card[],           // Cards in hand
      connected: boolean      // Connection status
    }
  ],
  currentPlayerIndex: number, // Index in players array
  direction: 1 | -1,          // 1 = clockwise, -1 = counter
  discardPile: Card[],        // Top card is current play
  gameStatus: 'waiting' | 'playing' | 'finished',
  winner: string | null,      // Player ID of winner
  pendingDraws: number,       // Accumulated draws from stacking
  reverseStackCount: number   // Current reverse stack count
}
```

### Card Object

```javascript
{
  type: '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'9'|'8'|'+2'|'+4'|'+20'|'skip'|'reverse',
  color: 'red'|'blue'|'green'|'yellow'|null  // null for wilds
}
```

### WebSocket Messages

**Client → Server**
```javascript
// Join room
{ action: 'join', roomCode: string, playerName: string }

// Play card
{ action: 'play', cardIndex: number, chosenColor?: string }

// Draw card
{ action: 'draw' }

// Create room
{ action: 'create', playerName: string }
```

**Server → Client**
```javascript
// Game state update
{
  type: 'state',
  gameState: GameState,
  yourPlayerId: string
}

// Error
{ type: 'error', message: string }

// Room created
{ type: 'roomCreated', roomCode: string }
```

## File Structure

```
crazy-8/
├── server.js              # Bun server (HTTP + WebSocket)
├── game-logic.js          # Game rules and validation
├── room-manager.js        # Room creation and management
├── public/
│   ├── index.html         # Landing page (join/create)
│   ├── game.html          # Game UI
│   ├── styles.css         # Mobile-optimized styles
│   ├── game-client.js     # WebSocket client + rendering
│   └── cards/             # Card images (optional)
├── PLAN.md                # This file
└── README.md              # Setup instructions
```

## Implementation Phases

### Phase 1: Core Server & Rooms
- [ ] Set up Bun HTTP server
- [ ] Implement WebSocket handler
- [ ] Create room manager (create/join/leave)
- [ ] Basic game state structure
- [ ] Room code generation

### Phase 2: Game Logic
- [ ] Card generation logic
- [ ] Turn order management
- [ ] Card play validation
- [ ] Normal card rules (match color/number)
- [ ] Wild card (8) logic
- [ ] Draw card logic

### Phase 3: Special Cards
- [ ] Plus card stacking (+2, +4, +20)
- [ ] Skip logic (skip 2 players)
- [ ] Reverse logic with stack limit
- [ ] Win condition detection

### Phase 4: Basic UI
- [ ] Landing page (create/join room)
- [ ] Game board layout
- [ ] Player hand display
- [ ] Discard/draw pile UI
- [ ] Turn indicator
- [ ] Opponent card counts

### Phase 5: Interactivity
- [ ] WebSocket client connection
- [ ] Play card interaction
- [ ] Draw card interaction
- [ ] Color picker for wilds
- [ ] Real-time state updates
- [ ] Game start/end screens

### Phase 6: Polish & UX
- [ ] CSS animations (card plays)
- [ ] Mobile-responsive layout
- [ ] Touch-friendly card selection
- [ ] Loading states
- [ ] Error handling and messages
- [ ] Reconnection logic

### Phase 7: Deployment
- [ ] ngrok setup instructions
- [ ] Testing with multiple devices
- [ ] Performance optimization
- [ ] Bug fixes

### Phase 8: Admin (Future)
- [ ] Password-protected admin route
- [ ] Feature toggle UI
- [ ] Custom rule configurations

## UI Design Considerations

### Mobile-First Layout

**Portrait Orientation (Primary)**
```
┌─────────────────────┐
│   Opponent 1  [3]   │  ← Card count
│   Opponent 2  [5]   │
├─────────────────────┤
│                     │
│    ┌──┐    ┌──┐    │  ← Draw & Discard
│    │? │    │8♠│    │
│    └──┘    └──┘    │
│                     │
│   Current: Alice    │  ← Turn indicator
├─────────────────────┤
│ ┌─┐┌─┐┌─┐┌─┐┌─┐   │  ← Your hand
│ │3││7││+││8││R│   │
│ │♥││♦││2││ ││ │   │
│ └─┘└─┘└─┘└─┘└─┘   │
└─────────────────────┘
```

### Color Scheme
- **Red**: #E74C3C
- **Blue**: #3498DB
- **Green**: #2ECC71
- **Yellow**: #F39C12
- **Background**: Dark gradient (#1a1a2e to #16213e)
- **Cards**: White with colored borders/icons

### Interactions
- **Tap card**: Play it (if valid)
- **Invalid play**: Card jiggles, error message
- **Wild cards**: Opens color picker modal
- **Draw pile**: Tap to draw

## Key Technical Challenges

### 1. State Synchronization
**Challenge**: Keeping all clients in sync when cards are played rapidly.

**Solution**: Server is authoritative. All actions go through server validation before broadcasting. Clients render optimistically but rollback on rejection.

### 2. Plus Card Stacking
**Challenge**: Complex logic for accumulating draws across different plus types.

**Solution**: Track `pendingDraws` counter. When plus card played, add to counter and pass turn. When non-plus played or player draws, resolve accumulated total.

### 3. Turn Order with Reverse
**Challenge**: Managing direction changes, especially with reverse stacking.

**Solution**: Track `direction` (1 or -1) and `reverseStackCount`. Each reverse toggles direction. Reset counter when non-reverse played.

### 4. Mobile Performance
**Challenge**: Smooth rendering on lower-end phones.

**Solution**: Minimize DOM manipulation, use CSS transforms for animations, debounce updates, lazy-load card images.

### 5. Reconnection Handling
**Challenge**: Players dropping connection mid-game.

**Solution**: Keep player state for 60 seconds after disconnect. On reconnect with same ID, rejoin game. Mark player as "disconnected" in UI.

## Testing Strategy

### Manual Testing Checklist
- [ ] 3-player game full playthrough
- [ ] 6-player game full playthrough
- [ ] Plus card stacking chains
- [ ] Reverse card stacking (up to 4)
- [ ] Skip card (verify 2 players skipped)
- [ ] Wild card color selection
- [ ] Player disconnect/reconnect
- [ ] Multiple games in different rooms
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

### Edge Cases
- [ ] Last card is a wild - forces next player draw
- [ ] +20 card played - verify 20 cards drawn
- [ ] 4 reverse stack - 5th reverse should be rejected
- [ ] All players except one disconnect
- [ ] Room with invalid code
- [ ] Duplicate player names

## Performance Targets

- **Initial load**: < 2 seconds on 4G
- **Card play latency**: < 100ms round-trip
- **Bundle size**: < 50kb (HTML + CSS + JS)
- **Memory**: < 10MB per game room

## Future Enhancements (Post-v1)

- **Custom card sets**: Add your own special cards
- **Power-ups**: Mid-game abilities
- **Tournaments**: Multi-round scoring
- **Chat**: In-game text chat
- **Emotes**: Quick reactions
- **Game history**: Track wins/losses
- **Spectator mode**: Watch games in progress
- **Sound effects**: Card plays, wins
- **Themes**: Custom UI skins
- **AI opponents**: Single-player mode

## Security Considerations

- **No authentication**: Anyone with room code can join
- **Input validation**: Sanitize player names, validate all moves server-side
- **Rate limiting**: Prevent spam actions from clients
- **Admin password**: Stored as environment variable, not hardcoded
- **XSS prevention**: Escape player names when rendering

## Deployment Steps

1. Install Bun: `curl -fsSL https://bun.sh/install | bash`
2. Clone/create project directory
3. Run server: `bun server.js`
4. In separate terminal: `ngrok http 3000`
5. Share ngrok URL with friends
6. Play!

## Success Criteria

- [ ] 4 people can play a full game on their phones
- [ ] All special cards work as expected
- [ ] UI is clean and responsive on mobile
- [ ] No crashes or disconnects during normal play
- [ ] Friends have fun and want to play again

---

**Document Version**: 1.0
**Last Updated**: 2026-02-03
**Status**: Planning Complete - Ready for Implementation
