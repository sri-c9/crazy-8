# Deployment Guide: Share Your Server with Friends

Welcome! This guide will help you deploy your local Bun server so friends can connect from their phones. You'll fix the WebSocket URL, set up ngrok, and test with real devices.

## Before You Start

**Prerequisites:**
- Server working on localhost (`bun dev` runs without errors)
- `http://localhost:3000` loads the landing page
- Room creation and joining works locally
- You have an ngrok account (free tier works — sign up at [ngrok.com](https://ngrok.com))

**What you'll build:**
- Protocol-aware WebSocket connection (works on localhost AND ngrok)
- ngrok tunnel for public access
- Startup script that launches server + ngrok together
- Verified cross-device multiplayer

**Time estimate:** 20-30 minutes

---

## Step 1: Fix the WebSocket URL

### The Problem

Right now, your frontend probably has a hardcoded WebSocket URL:
```ts
const ws = new WebSocket("ws://localhost:3000/ws");
```

This works on localhost but **breaks on ngrok** because:
- ngrok uses HTTPS (`https://abc123.ngrok.io`)
- HTTPS pages require **secure WebSockets** (`wss://`, not `ws://`)
- Browsers block the connection (mixed content error)

### Your Task

Update the WebSocket connection to detect the page's protocol automatically.

**Open `public/index.html`** (or your WebSocket client code) and find the WebSocket connection line.

**Replace the hardcoded URL with:**

```ts
// Detect protocol (ws:// for http://, wss:// for https://)
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const host = window.location.host; // includes port if present

// Construct WebSocket URL
const wsUrl = `${protocol}//${host}/ws`;
console.log("Connecting to:", wsUrl); // Debug log

const ws = new WebSocket(wsUrl);
```

<details>
<summary>💡 Why this works</summary>

`window.location.protocol` returns:
- `"http:"` when page loaded via `http://localhost:3000`
- `"https:"` when page loaded via `https://abc123.ngrok.io`

`window.location.host` returns:
- `"localhost:3000"` on local development
- `"abc123.ngrok.io"` on ngrok tunnel

Combining them:
- Localhost: `ws://localhost:3000/ws`
- ngrok: `wss://abc123.ngrok.io/ws`
</details>

### Checkpoint: Test on Localhost

1. Save the file
2. Restart server: `bun dev`
3. Open `http://localhost:3000`
4. Open browser DevTools → Console tab
5. Verify log shows: `Connecting to: ws://localhost:3000/ws`
6. Create a room → should still work

**If you see errors:** Double-check the syntax, ensure `window.location` variables are correct.

---

## Step 2: Install and Configure ngrok

### Install ngrok

**macOS (Homebrew):**
```bash
brew install ngrok
```

**Linux:**
```bash
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | \
  sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && \
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | \
  sudo tee /etc/apt/sources.list.d/ngrok.list && \
  sudo apt update && sudo apt install ngrok
```

**Windows:**
Download from [ngrok.com/download](https://ngrok.com/download)

**Verify installation:**
```bash
ngrok version
```

### Get Your Auth Token

1. Go to [ngrok.com](https://ngrok.com) and sign up (free)
2. Navigate to **"Your Authtoken"** in the dashboard
3. Copy the token (looks like `2a1b3c4d5e6f7g8h9i0j_AbCdEfGhIjKlMnOpQrStUvWx`)

### Add Token to ngrok

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

Replace `YOUR_AUTH_TOKEN` with your actual token.

**Verify:**
```bash
ngrok config check
```

### Start the Tunnel

**In a separate terminal** (keep `bun dev` running in the first terminal):

```bash
ngrok http 3000
```

You should see:
```
Session Status    online
Account           Your Name (Plan: Free)
Forwarding        https://abc123.ngrok.io -> http://localhost:3000
```

**Copy the HTTPS URL** (`https://abc123.ngrok.io` — your subdomain will be different).

### Checkpoint: Test on Laptop via ngrok

1. **Keep both terminals open:**
   - Terminal 1: `bun dev` (server running)
   - Terminal 2: `ngrok http 3000` (tunnel running)

2. Open the ngrok URL in your browser (e.g., `https://abc123.ngrok.io`)

3. **Open DevTools → Console**
   - Verify log shows: `Connecting to: wss://abc123.ngrok.io/ws` (note the `wss://`)

4. **Create a room**
   - Enter your name and avatar
   - Click "Create Room"
   - Room code should appear

5. **Join the room from a second tab**
   - Open the same ngrok URL in an incognito/private window
   - Join with the room code
   - Both tabs should show updated player list

**If the WebSocket doesn't connect:**
- Check browser console for errors
- Ensure you're using the HTTPS URL (not HTTP)
- Verify `bun dev` is still running
- Try restarting both server and ngrok

---

## Step 3: Test with a Friend

Now test across real devices!

### Send the URL

**Share your ngrok URL with a friend:**
- Text message
- Discord/Slack
- Email

**Important:** Send the **HTTPS** URL (e.g., `https://abc123.ngrok.io`), not the HTTP one.

### Test Scenario

1. **You (on laptop):**
   - Open ngrok URL
   - Create a room
   - Note the room code

2. **Friend (on phone):**
   - Open ngrok URL in Safari/Chrome
   - Enter name and avatar
   - Type room code
   - Click "Join Room"

3. **Verify:**
   - Both devices show the same player list
   - Player names and avatars appear correctly
   - Real-time updates work (try opening/closing browser tabs)

### Checkpoint: Cross-Device Success

- [ ] Friend's phone loads landing page over ngrok URL
- [ ] Friend can join your room
- [ ] Both devices show updated player list
- [ ] Closing browser tab marks player as disconnected
- [ ] Reopening and rejoining works

**Troubleshooting:**
- **Friend sees "Can't connect":** Ensure they're using HTTPS URL, not HTTP
- **WebSocket fails on mobile:** Check if they're on corporate WiFi (might block WebSockets) — try mobile LTE
- **Tunnel shows "Invalid Host Header":** Shouldn't happen with Bun, but if it does, restart ngrok
- **ngrok tunnel died:** Terminal 2 shows "Session Expired" — restart `ngrok http 3000`

---

## Step 4: Create a Startup Script

Instead of running `bun dev` and `ngrok http 3000` in separate terminals, create one script to start both.

### Your Task

Create a new file in the project root: **`start-server.sh`**

```bash
#!/bin/bash

# Cleanup function (runs on Ctrl+C)
cleanup() {
  echo "Stopping server..."
  if [ ! -z "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null
  fi
  exit 0
}

# Trap signals to ensure cleanup
trap cleanup EXIT INT TERM

# Start Bun server in background
echo "Starting Bun server on port 3000..."
bun dev &
SERVER_PID=$!

# Wait for server to initialize
sleep 2

# Check if server started successfully
if ! curl -s http://localhost:3000 > /dev/null; then
  echo "Error: Server failed to start"
  exit 1
fi

echo "Server running (PID: $SERVER_PID)"
echo "Starting ngrok tunnel..."
echo ""

# Start ngrok (foreground)
ngrok http 3000

# Cleanup runs automatically on exit
```

**Make it executable:**
```bash
chmod +x start-server.sh
```

**Run it:**
```bash
./start-server.sh
```

You should see:
1. "Starting Bun server..." message
2. Bun dev output
3. "Starting ngrok tunnel..." message
4. ngrok dashboard with HTTPS URL

**To stop:** Press `Ctrl+C` once — both Bun server and ngrok will stop automatically.

<details>
<summary>💡 How the script works</summary>

- `bun dev &` starts server in background, `$!` captures its process ID
- `sleep 2` gives server time to start
- `curl -s http://localhost:3000` checks if server is responding
- `ngrok http 3000` runs in foreground (you see the URL dashboard)
- `trap cleanup EXIT INT TERM` ensures server stops when you Ctrl+C ngrok
- `kill $SERVER_PID` terminates Bun server process

**Why use trap?**
Without it, pressing Ctrl+C only stops ngrok — the Bun server keeps running in the background, consuming port 3000. Next time you run the script, you'd get "port already in use" errors.
</details>

### Checkpoint: Script Works

- [ ] `./start-server.sh` starts both server and ngrok
- [ ] ngrok URL appears
- [ ] Opening URL in browser works
- [ ] Pressing Ctrl+C stops both processes
- [ ] Running script again works (no "port in use" error)

---

## Step 5 (Optional): Add Logging

Add server logs to debug issues during play.

### Your Task

Open `server.ts` and add a logger at the top:

```ts
interface Logger {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

const log: Logger = {
  info: (msg: string): void => {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`);
  },
  error: (msg: string): void => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`);
  }
};
```

**Use it in handlers:**

```ts
// In handleCreate
log.info(`Room created: ${roomCode} by ${playerName}`);

// In handleJoin
log.info(`Player ${playerName} joined room ${roomCode}`);

// In WebSocket close handler
log.info(`Player ${playerId} disconnected from room ${roomCode}`);

// In error catch blocks
log.error(`Failed to join room: ${error.message}`);
```

**Optional: Metrics Endpoint**

Add a `/metrics` route to see server stats:

```ts
// At top of server.ts
const metrics = {
  roomsCreated: 0,
  playersJoined: 0,
  activeRooms: 0
};

// In createRoom handler
metrics.roomsCreated++;

// In joinRoom handler
metrics.playersJoined++;

// In fetch handler (before WebSocket upgrade check)
if (url.pathname === "/metrics") {
  metrics.activeRooms = rooms.size;
  return new Response(JSON.stringify(metrics, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}
```

Visit `https://your-ngrok-url.ngrok.io/metrics` to see stats.

---

## What You Built

Congratulations! You've deployed your local server:

- ✅ **Protocol-aware WebSocket:** Works on localhost (`ws://`) and ngrok (`wss://`)
- ✅ **ngrok tunnel:** Friends can connect from anywhere via HTTPS URL
- ✅ **Startup script:** One command to launch server + tunnel
- ✅ **Cross-device tested:** Verified multiplayer works on laptop + phone
- ✅ **Server logging:** Debug issues during play (optional)

## Next Steps

Now you can:
- **Play with friends:** Share your ngrok URL and create a room
- **Test edge cases:** What happens if host leaves? If everyone disconnects?
- **Add features:** Custom avatars, room passwords, player limits
- **Monitor usage:** Check `/metrics` to see how many rooms are active

**Known limitations:**
- **ngrok URL changes:** Free tier assigns random subdomain on each restart. Solutions:
  - Share new URL each time (easiest)
  - Reserve a subdomain (free: 1 allowed, go to ngrok dashboard → Domains)
  - Upgrade to ngrok Pro for custom domain
- **Server restarts:** All rooms lost (in-memory only). This is by design for local play.
- **Reconnection:** Players marked disconnected, not removed. Rejoining requires refresh.

**Tips for sharing:**
- Test on WiFi and mobile LTE before sharing widely
- Keep laptop plugged in (ngrok tunnel dies if laptop sleeps)
- Monitor server terminal for errors during play
- If ngrok tunnel dies, restart script and share new URL

Ready to play? Start the server and share the link!
