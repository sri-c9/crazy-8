# Admin Panel "God Mode" — Delivery Summary

## ✅ What Was Delivered

### 1. Backend Guide (For You to Implement)
**File:** `docs/guides/PHASE6-GUIDE.md`

A complete step-by-step learning guide covering:
- **Step 1:** Admin Manager (`admin-manager.ts`) — God mode state, power toggles, validation
- **Step 2:** Admin Routes in Server (`server.ts`) — Password-protected `/admin` route, WebSocket handlers
- **Step 3:** Room Manager Extensions (`room-manager.ts`) — `getAllRooms()`, `kickPlayer()`, `forceStartGame()`, `endGame()`
- **Step 4:** Game Logic Admin Functions (`game-logic.ts`) — Card manipulation, turn control
- **Step 5:** Wire Admin Actions to Server — Connect all handlers
- **Step 6:** Testing checkpoints for each god mode power

The guide follows the same style as Phases 1-5 with:
- Hints in `<details>` tags
- Checkpoints to test your work
- TypeScript examples
- No frontend implementation required (I built that)

### 2. Frontend (I Built This)
**Files Created:**
- `public/admin.html` — Admin dashboard layout
- `public/admin.css` — Dark theme admin panel styling
- `public/admin-client.ts` — Full WebSocket client + UI rendering

**Features:**
- Password-protected access (`/admin?password=insane8admin`)
- Live room list with auto-refresh (every 5 seconds)
- Room watching system (click a room to watch it)
- 4 god mode power toggles (all OFF by default):
  - **See All Hands** — View every player's cards, remove cards by clicking ×
  - **Manipulate Cards** — Give/remove cards, change top discard card
  - **Control Turns** — Skip turns, force draws, reverse direction, set current player
  - **Room Control** — Kick players, force-start, end game
- Action log showing all admin actions with timestamps
- Real-time updates when players take actions
- Responsive design (works on desktop)

### 3. Build Configuration
**Updated:** `package.json`

Build script now compiles all three client files:
```bash
bun run build
```

Compiles:
- `public/lobby.ts` → `public/dist/lobby.js`
- `public/game-client.ts` → `public/dist/game-client.js`
- `public/admin-client.ts` → `public/dist/admin-client.js`

---

## 🎮 How to Use (After You Implement the Backend)

### Step 1: Implement the Backend
Follow `docs/guides/PHASE6-GUIDE.md` to implement:
1. `admin-manager.ts` (NEW)
2. Modify `server.ts` to add admin route + handlers
3. Extend `room-manager.ts` with admin functions
4. Add admin functions to `game-logic.ts`

### Step 2: Build Frontend
```bash
bun run build
```

This compiles `admin-client.ts` to `public/dist/admin-client.js`.

### Step 3: Start Server
```bash
bun dev
```

### Step 4: Access Admin Panel
1. Open `http://localhost:3000/admin?password=insane8admin` in your browser
2. You should see:
   - Connection status (green dot when connected)
   - Active rooms list
   - God mode power toggles (all OFF)

### Step 5: Watch a Room
1. Create a room from a regular browser tab
2. In admin panel, click the room card to watch it
3. Room info panel appears showing:
   - Room code, status, direction, pending draws
   - Players grid with avatars, names, card counts
   - Current turn indicator

### Step 6: Toggle God Powers
Each power is OFF by default. Click a toggle to enable:

**See All Hands (OFF → ON):**
- Every player's cards appear
- Click the × on any card to remove it from their hand

**Manipulate Cards (OFF → ON):**
- Give Card: Select player → card type → color/value → Give
- Set Top Card: Select card type → color/value → Set

**Control Turns (OFF → ON):**
- Skip Turn: Advance to next player without action
- Reverse Direction: Flip turn order
- Force Draw: Select player → count → Force Draw
- Set Current Player: Select player → Set Turn

**Room Control (OFF → ON):**
- Kick Player: Select player → Kick (with confirmation)
- Force Start Game: Bypass 3-player minimum
- End Game: Immediately end the current game

---

## 🔐 Security

**Password Authentication:**
- Default password: `insane8admin`
- Set via environment variable: `ADMIN_PASSWORD=yoursecret bun dev`
- Password is in URL query param (simple but sufficient for private games)

**NOT production-grade:**
- No session management
- No rate limiting
- No HTTPS required (use ngrok for encrypted tunnel)
- Intended for local/friend groups, not public deployment

---

## 📋 WebSocket Protocol Reference

### Admin → Server Actions
```ts
{ action: "adminListRooms" }
{ action: "adminWatchRoom", roomCode: "ABXY" }
{ action: "adminUnwatchRoom" }
{ action: "adminTogglePower", power: "seeAllHands" }
{ action: "adminGetAllHands" }
{ action: "adminGiveCard", playerId: "p_xxx", card?: Card }
{ action: "adminRemoveCard", playerId: "p_xxx", cardIndex: 0 }
{ action: "adminSetTopCard", card: Card }
{ action: "adminSkipTurn" }
{ action: "adminForceDraw", playerId: "p_xxx", count: 5 }
{ action: "adminReverseDirection" }
{ action: "adminSetCurrentPlayer", playerId: "p_xxx" }
{ action: "adminKickPlayer", playerId: "p_xxx" }
{ action: "adminEndGame" }
{ action: "adminForceStart" }
```

### Server → Admin Responses
```ts
{ type: "adminRoomList", rooms: [...] }
{ type: "adminRoomState", room: {...} }
{ type: "adminAllHands", hands: { "p_xxx": [Card] } }
{ type: "adminResult", success: boolean, message: string }
{ type: "adminGameUpdate", roomCode: string }
```

---

## 🧪 Testing Checklist

After implementing the backend:

### Authentication
- [ ] `/admin` → 401 Unauthorized
- [ ] `/admin?password=wrong` → 401 Unauthorized
- [ ] `/admin?password=insane8admin` → Admin page loads

### Room List
- [ ] Create room from regular browser → appears in admin list
- [ ] Click room → watch panel appears
- [ ] Room code, status, players display correctly

### See All Hands
- [ ] Toggle ON → all players' cards visible
- [ ] Click × on card → card removed from hand
- [ ] Toggle OFF → cards hidden

### Manipulate Cards
- [ ] Give random card → player's hand grows
- [ ] Give specific card (e.g., +20) → correct card added
- [ ] Set top card → discard pile updates

### Control Turns
- [ ] Skip turn → current player changes
- [ ] Force draw 10 → player gets 10 cards
- [ ] Reverse direction → arrow flips
- [ ] Set current player → turn indicator updates

### Room Control
- [ ] Force-start with 2 players → game begins
- [ ] Kick player → player removed, list updates
- [ ] End game → game over for all

### Power Validation
- [ ] Turn OFF all powers
- [ ] Try each action → error "Power X is not enabled"

---

## 📁 File Structure

```
crazy-8/
├── docs/
│   └── guides/
│       └── PHASE6-GUIDE.md        # Your implementation guide ✅
├── public/
│   ├── admin.html                 # Admin dashboard ✅
│   ├── admin.css                  # Admin styling ✅
│   ├── admin-client.ts            # Admin client logic ✅
│   └── dist/
│       └── admin-client.js        # (compiled, gitignored)
├── admin-manager.ts               # TODO: You implement
├── server.ts                      # TODO: Modify for admin
├── room-manager.ts                # TODO: Add admin functions
├── game-logic.ts                  # TODO: Add admin functions
└── package.json                   # ✅ Build script updated
```

---

## 🚀 Next Steps

1. **Read** `docs/guides/PHASE6-GUIDE.md` (start to finish)
2. **Implement** the backend following the guide step-by-step
3. **Build** the frontend with `bun run build`
4. **Test** all god mode powers with checkpoints in the guide
5. **Play** with god mode enabled and break your own game

---

## 💡 Design Philosophy

**All Powers OFF by Default:**
- You enable only what you need
- No accidental cheating
- Clean admin experience

**Togglable Powers:**
- Turn on "See All Hands" to spectate
- Turn on "Manipulate Cards" to fix stuck games
- Turn on "Control Turns" to speed up testing
- Turn on "Room Control" to manage problematic players

**No Normal Mode:**
- This game is ONLY "Insane" mode
- Plus-stacking, skip 2, reverse limit — always on
- No settings to disable these rules

---

**You're ready to implement!** Start with Step 1 of the guide and build your way to god mode. 🎮⚡
