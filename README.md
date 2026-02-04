# Insane Crazy 8

A multiplayer web-based Crazy 8 card game with insane rules. Play with 3-6 friends on your phones!

## Features

- **Insane Rules**: +20 cards, plus-stacking, skip 2 players, reverse chains
- **Real-time Multiplayer**: WebSocket-based instant updates
- **Mobile-Friendly**: Play on any phone browser, no app needed
- **No Setup**: Just share a room code and play

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed (`curl -fsSL https://bun.sh/install | bash`)
- [ngrok](https://ngrok.com) for public URL (optional but recommended)

### Running Locally

1. Start the game server:
```bash
bun server.ts
```

2. In a separate terminal, expose it publicly:
```bash
ngrok http 3000
```

3. Share the ngrok URL with your friends

4. Open the URL on your phones and play!

## Game Rules

### Card Types

- **Number cards (0-7, 9)**: Match by color or number
- **8 (Wild)**: Play anytime, choose new color
- **+2**: Draw 2 cards (stackable)
- **+4**: Draw 4 cards, choose color (stackable)
- **+20**: Draw 20 cards (stackable)
- **Skip**: Skip next 2 players
- **Reverse**: Reverse turn order (max 4 stack)

### Special Rules

- **Plus Stacking**: Any +card can stack on any other +card
- **Reverse Limit**: Only 4 reverses can stack in a row
- **Infinite Deck**: Never run out of cards
- **3-6 Players**: Supports 3 to 6 players per game

## Project Structure

```
crazy-8/
├── server.ts              # Main Bun server
├── game-logic.ts          # Game rules engine
├── room-manager.ts        # Room management
├── public/
│   ├── index.html         # Landing page
│   ├── game.html          # Game UI
│   ├── styles.css         # Styles
│   ├── game-client.ts     # Client logic (TypeScript)
│   └── lobby.ts           # Lobby UI (TypeScript)
├── docs/                  # Documentation
│   ├── OVERVIEW.md        # Overall implementation plan
│   ├── plans/             # Phase-by-phase technical specs
│   ├── guides/            # Learning guides for each phase
│   └── CONTRIBUTING.md    # Git workflow guide
└── README.md              # This file
```

## Development

- **Start here**: [Phase 1 Learning Guide](./docs/guides/PHASE1-GUIDE.md) - Build the core server yourself
- **Technical spec**: [Phase 1 Plan](./docs/plans/PHASE1-PLAN.md) - Detailed architecture
- **Overall design**: [Overview](./docs/OVERVIEW.md) - Complete implementation roadmap
- **Git workflow**: [Contributing](./docs/CONTRIBUTING.md) - Gitflow lite strategy

## Tech Stack

- **Runtime**: Bun.js
- **Language**: TypeScript (Bun-native)
- **Frontend**: TypeScript (compiled to JS via Bun's bundler)
- **Real-time**: Native WebSocket
- **Deployment**: Local + ngrok tunnel

## License

MIT
