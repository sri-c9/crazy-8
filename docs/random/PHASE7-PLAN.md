# Phase 7: Deployment & Testing — Technical Plan

**STATUS: TENTATIVE** — This plan will be refined when Phase 7 begins.

## Goal

Prepare the game for real-world use: set up ngrok for public access, test on multiple devices, optimize performance, fix bugs discovered during testing, and document deployment process.

## Depends On

- **Phase 6 Complete:** Animations, mobile UX, all core features implemented

## Tasks

### 1. ngrok Setup & Configuration

**Install ngrok:**

```bash
# macOS (Homebrew)
brew install ngrok

# Or download from ngrok.com
```

**Configure ngrok:**

```bash
# Sign up at ngrok.com for auth token (free tier)
ngrok config add-authtoken YOUR_AUTH_TOKEN

# Start tunnel
ngrok http 3000
```

**Custom Domain (Optional, ngrok Pro):**

```bash
ngrok http --domain=crazy8.ngrok.app 3000
```

**Create startup script:**

`start-server.sh`:
```bash
#!/bin/bash

# Start Bun server in background
bun dev &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Start ngrok tunnel
ngrok http 3000

# On exit, kill server
trap "kill $SERVER_PID" EXIT
```

Make executable:
```bash
chmod +x start-server.sh
```

**Usage:**
```bash
./start-server.sh
```

**Share ngrok URL:**
- Copy URL from ngrok terminal output (e.g., `https://abc123.ngrok.io`)
- Share with friends on mobile devices
- No firewall/port forwarding needed

### 2. Multi-Device Testing

**Test Matrix:**

| Device | Browser | Screen Size | OS Version |
|--------|---------|-------------|------------|
| iPhone 12 | Safari | 390×844 | iOS 17+ |
| iPhone SE | Safari | 375×667 | iOS 16+ |
| Pixel 6 | Chrome | 412×915 | Android 13+ |
| iPad | Safari | 768×1024 | iPadOS 17+ |
| Desktop | Chrome | 1920×1080 | macOS/Windows |

**Testing Scenarios:**

1. **3-player game (minimum):**
   - Device 1: iPhone (host)
   - Device 2: Android (player 2)
   - Device 3: iPad (player 3)
   - Start game, play full round, verify winner

2. **6-player game (maximum):**
   - All 6 devices join same room via ngrok URL
   - Test turn order with 6 players
   - Verify opponent display (horizontal scroll)

3. **Mixed network conditions:**
   - Device on WiFi + device on LTE
   - Simulate slow 3G (DevTools throttling on one device)
   - Verify reconnection works across networks

4. **Edge cases:**
   - Host leaves mid-game → verify host transfer
   - All players disconnect → verify room cleanup
   - Rejoin after disconnect → verify state sync
   - Server restart → verify graceful error

### 3. Performance Optimization

**Measure Performance:**

```bash
# Run Lighthouse audit (in Chrome DevTools)
# Target scores:
# - Performance: 90+
# - Accessibility: 95+
# - Best Practices: 90+
# - SEO: 80+
```

**Optimization Checklist:**

- [ ] Minify CSS (using a build step or manually remove comments/whitespace)
- [ ] Compress images (avatars, card backgrounds if any)
- [ ] Use WebP format for images
- [ ] Enable gzip/brotli compression in Bun server
- [ ] Lazy-load sound files (only when settings enabled)
- [ ] Remove console.log statements in production
- [ ] Add service worker for caching static assets (optional)

**Bun Server Compression:**

```ts
// In server.ts
Bun.serve({
  fetch(req: Request, server: Server): Response {
    // ... existing logic

    // Add compression headers
    const headers: Record<string, string> = {
      "Content-Encoding": "gzip"  // Bun auto-compresses if client supports
    };

    return new Response(content, { headers });
  }
});
```

**WebSocket Message Size:**

- Game state messages can get large with 6 players
- Optimize by sending only changed fields (delta updates)
- Example: Instead of full state, send `{ type: "cardPlayed", playerId, cardIndex, topCard }`

### 4. Bug Fixes from Testing

**Common Issues to Watch For:**

- **Race conditions:**
  - Two players play card simultaneously
  - Server processes in order, second player gets error
  - Client needs to handle gracefully (rollback optimistic update)

- **State desync:**
  - Client and server states diverge
  - Add periodic state validation (every 10 seconds)
  - If mismatch detected, request full state from server

- **Memory leaks:**
  - Long-running game (30+ minutes)
  - Check for leaked event listeners
  - Profile with DevTools Memory tab

- **Reconnection edge cases:**
  - Reconnect during special card resolution (+card stack)
  - Reconnect as current player (your turn)
  - Handle by sending latest state + "it's your turn" notification

**Automated Testing (Optional):**

Create test scripts for server logic:

`test/room-manager.test.ts`:
```ts
import { createRoom, joinRoom, leaveRoom } from '../room-manager.ts';

// Test room creation
const { roomCode, playerId } = createRoom("Alice", "😎");
console.assert(roomCode.length === 4, "Room code should be 4 chars");

// Test joining
const { playerId: p2 } = joinRoom(roomCode, "Bob", "🔥");
console.assert(p2, "Player should join successfully");

// Test max players
try {
  for (let i = 0; i < 6; i++) {
    joinRoom(roomCode, `Player${i}`, "🎯");
  }
  console.assert(false, "Should reject 7th player");
} catch (e) {
  console.log("✓ Max player limit enforced");
}

console.log("All tests passed!");
```

Run tests:
```bash
bun test/room-manager.test.ts
```

### 5. Documentation

**Create `README.md` (if not exists):**

```markdown
# Insane Crazy 8

Real-time multiplayer card game built with Bun.js. Play with friends on mobile!

## Quick Start

1. Install Bun: `curl -fsSL https://bun.sh/install | bash`
2. Run server: `bun dev`
3. Expose publicly: `ngrok http 3000`
4. Share ngrok URL with friends
5. Create a room and play!

## Features

- 3-6 players
- Real-time WebSocket sync
- Mobile-optimized
- "Insane" rules: plus-stacking, skip 2, reverse limit
- Works on phone browsers (no app needed)

## Game Rules

[Link to rules doc or inline explanation]

## Deployment

See `docs/DEPLOYMENT.md`

## Development

See `docs/PHASE*.md` for technical details
```

**Create `docs/DEPLOYMENT.md`:**

```markdown
# Deployment Guide

## Local Deployment (ngrok)

1. Start server: `bun dev`
2. Start ngrok: `ngrok http 3000`
3. Share URL: `https://abc123.ngrok.io`

## Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: `development` or `production`

## Troubleshooting

### ngrok tunnel not working
- Check auth token: `ngrok config check`
- Verify server running on port 3000: `curl http://localhost:3000`

### Players can't connect
- Ensure ngrok URL is HTTPS (not HTTP)
- Check firewall not blocking ngrok

### Game state not syncing
- Open DevTools console for WebSocket errors
- Verify server logs for connection issues
```

### 6. Monitoring & Logging

**Add Server Logging:**

```ts
// In server.ts
interface Logger {
  info: (msg: string) => void;
  error: (msg: string) => void;
  debug: (msg: string) => void;
}

const log: Logger = {
  info: (msg: string): void => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg: string): void => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  debug: (msg: string): void => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${msg}`);
    }
  }
};

// Usage
log.info(`Room created: ${roomCode}`);
log.error(`Failed to join room: ${error.message}`);
log.debug(`Current rooms: ${rooms.size}`);
```

**Track Metrics:**

- Active rooms count
- Player count
- Average game duration
- Error rate
- Reconnection rate

Store in memory for session (no database needed):

```ts
interface Metrics {
  roomsCreated: number;
  gamesPlayed: number;
  totalPlayers: number;
  errors: number;
}

const metrics: Metrics = {
  roomsCreated: 0,
  gamesPlayed: 0,
  totalPlayers: 0,
  errors: 0
};

// Increment on events
metrics.roomsCreated++;

// Expose at /metrics endpoint (optional)
if (req.url === '/metrics') {
  return new Response(JSON.stringify(metrics), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## Testing Checklist

### Functional Testing

- [ ] Create room on iPhone → join from Android
- [ ] Play full game with 3 players (all mobile devices)
- [ ] Play full game with 6 players
- [ ] Test all special cards (+2, +4, +20, skip, reverse, wild)
- [ ] Stack +cards across 4 players (20+ cards)
- [ ] Hit reverse limit (4 in a row)
- [ ] Win with final card played
- [ ] Win with final card drawn
- [ ] Disconnect/reconnect mid-game
- [ ] Host leaves → verify host transfer
- [ ] Leave room → verify player list updates
- [ ] Invalid actions show correct errors

### UI/UX Testing

- [ ] All buttons touch-friendly (44px min)
- [ ] Cards readable on small screen (iPhone SE)
- [ ] Landscape mode works
- [ ] Animations smooth (60fps)
- [ ] Haptic feedback on card play (iOS/Android)
- [ ] Sound effects play (if enabled)
- [ ] Toast notifications appear/dismiss correctly
- [ ] Loading states show during delays
- [ ] Error messages clear and helpful

### Performance Testing

- [ ] Lighthouse score 90+ (performance)
- [ ] No memory leaks after 30-minute game
- [ ] Reconnection under 2 seconds
- [ ] Card play latency under 200ms
- [ ] Page load under 2 seconds (on 3G)

### Cross-Browser Testing

- [ ] Safari iOS (latest)
- [ ] Chrome Android (latest)
- [ ] Safari iPad (latest)
- [ ] Chrome Desktop (latest)
- [ ] Firefox Desktop (latest, for debugging)

## Success Criteria

- ✅ ngrok tunnel works reliably
- ✅ Mobile devices can join via ngrok URL
- ✅ Game playable on 5+ different devices
- ✅ No critical bugs during 1-hour playtest
- ✅ Performance targets met (60fps, <2s load)
- ✅ Reconnection works in real-world conditions
- ✅ Documentation complete (README, DEPLOYMENT)
- ✅ Server logs useful errors
- ✅ Metrics tracked for monitoring

## Post-Launch Tasks

- Monitor ngrok logs for errors
- Collect feedback from players
- Fix critical bugs within 24 hours
- Document known issues in GitHub Issues (if applicable)
- Plan Phase 8 (admin panel) based on learnings
