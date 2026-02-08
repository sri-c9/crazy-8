# Deployment Plan: Local Server + ngrok

## Goal

Set up local Bun server to be accessible over the internet via ngrok, enabling friends on mobile devices to connect and play. Fix WebSocket protocol issues for HTTPS tunnels, configure ngrok, create startup scripts, and verify cross-device functionality.

## Prerequisites

- **Server Implementation Complete:** `server.ts`, `room-manager.ts`, and frontend files working on localhost
- **Bun Installed:** `bun --version` confirms Bun is available
- **ngrok Account:** Free account at ngrok.com (for auth token)

## 1. Fix WebSocket URL (Protocol-Aware)

### Current Bug

`public/index.html` likely hardcodes the WebSocket URL:
```ts
const ws = new WebSocket("ws://localhost:3000/ws");
```

This breaks when using ngrok because:
- ngrok serves over **HTTPS** (`https://abc123.ngrok.io`)
- HTTPS pages require **secure WebSockets** (`wss://`, not `ws://`)
- Browsers block mixed content (HTTPS page + WS connection)

### Fix: Dynamic Protocol Detection

Update the WebSocket connection logic to detect the page's protocol:

```ts
// Determine protocol based on page URL
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const host = window.location.host; // includes port if present

// Construct WebSocket URL
const wsUrl = `${protocol}//${host}/ws`;
const ws = new WebSocket(wsUrl);
```

**Why this works:**
- On localhost: `http://localhost:3000` → `ws://localhost:3000/ws`
- On ngrok: `https://abc123.ngrok.io` → `wss://abc123.ngrok.io/ws`

### Implementation Location

Modify the `connectWebSocket()` function in `public/index.html` (or separate TypeScript client file if using a build step).

## 2. ngrok Setup & Configuration

### Install ngrok

**macOS (Homebrew):**
```bash
brew install ngrok
```

**Linux/Windows:**
Download from [ngrok.com/download](https://ngrok.com/download)

### Configure Auth Token

1. Sign up at [ngrok.com](https://ngrok.com) (free tier is sufficient)
2. Get your auth token from the dashboard
3. Add token to ngrok config:

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### Start Tunnel

**Basic tunnel (random subdomain):**
```bash
ngrok http 3000
```

Output:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

**Custom subdomain (ngrok Pro):**
```bash
ngrok http --domain=crazy8.ngrok.app 3000
```

### Share the URL

- Copy the HTTPS URL from ngrok terminal (e.g., `https://abc123.ngrok.io`)
- Share with friends on mobile devices
- They visit the URL in Safari/Chrome on their phones
- No firewall configuration or port forwarding needed

## 3. Startup Script

Create a unified script to start both Bun server and ngrok tunnel.

**`start-server.sh`:**
```bash
#!/bin/bash

# Trap to ensure cleanup on exit
cleanup() {
  echo "Stopping server..."
  if [ ! -z "$SERVER_PID" ]; then
    kill $SERVER_PID 2>/dev/null
  fi
  exit 0
}

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

# Start ngrok (foreground, blocks until Ctrl+C)
ngrok http 3000

# Cleanup will run automatically via trap
```

**Make executable:**
```bash
chmod +x start-server.sh
```

**Usage:**
```bash
./start-server.sh
```

**To stop:** Press `Ctrl+C` once — the trap will kill the Bun server automatically.

## 4. Bun Server Compression

Reduce bandwidth usage for mobile devices by enabling compression.

**Add compression support in `server.ts`:**

```ts
// In the fetch handler
async fetch(req: Request, server: Server): Promise<Response | undefined> {
  const url = new URL(req.url);

  // ... WebSocket upgrade logic

  // Serve static files with compression
  let filePath = "./public" + url.pathname;
  if (url.pathname === "/") {
    filePath = "./public/index.html";
  }

  const file = Bun.file(filePath);
  if (await file.exists()) {
    // Bun automatically compresses responses if client sends Accept-Encoding: gzip
    const headers = new Headers();

    // Set Content-Type based on file extension
    if (filePath.endsWith(".html")) headers.set("Content-Type", "text/html");
    if (filePath.endsWith(".css")) headers.set("Content-Type", "text/css");
    if (filePath.endsWith(".js")) headers.set("Content-Type", "application/javascript");

    return new Response(file, { headers });
  }

  return new Response("Not Found", { status: 404 });
}
```

**Note:** Bun automatically applies gzip/brotli compression when the client supports it (via `Accept-Encoding` header). No additional configuration needed.

## 5. Logging & Metrics

Add server-side logging to debug issues during deployment.

### Logger Pattern

**In `server.ts`:**

```ts
interface Logger {
  info: (msg: string) => void;
  error: (msg: string) => void;
  debug: (msg: string) => void;
}

const log: Logger = {
  info: (msg: string): void => {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`);
  },
  error: (msg: string): void => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`);
  },
  debug: (msg: string): void => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`);
    }
  }
};

// Usage examples
log.info(`Room created: ${roomCode}`);
log.error(`Failed to join room: ${error.message}`);
log.debug(`Active rooms: ${rooms.size}`);
```

### Metrics Endpoint (Optional)

Track server statistics in memory:

```ts
interface Metrics {
  roomsCreated: number;
  playersJoined: number;
  activeRooms: number;
  errors: number;
}

const metrics: Metrics = {
  roomsCreated: 0,
  playersJoined: 0,
  activeRooms: 0,
  errors: 0
};

// In fetch handler, add metrics endpoint
if (url.pathname === "/metrics") {
  metrics.activeRooms = rooms.size; // Update from room-manager
  return new Response(JSON.stringify(metrics, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}

// Increment on events
// In createRoom handler:
metrics.roomsCreated++;

// In joinRoom handler:
metrics.playersJoined++;

// In error catch blocks:
metrics.errors++;
```

Access metrics at: `https://your-ngrok-url.ngrok.io/metrics`

## 6. Infrastructure Testing Checklist

Verify the deployment setup works correctly:

### Local Testing
- [ ] `bun dev` starts server without errors
- [ ] `http://localhost:3000` loads landing page
- [ ] WebSocket connects at `ws://localhost:3000/ws`
- [ ] Create room → room code appears
- [ ] Join room from second browser tab → player list updates

### ngrok Testing
- [ ] `ngrok http 3000` creates tunnel with HTTPS URL
- [ ] Visit ngrok URL in browser → landing page loads (CSS, no errors)
- [ ] WebSocket connects via `wss://` (check DevTools Network tab)
- [ ] Create room via ngrok URL → room code appears
- [ ] Join room from mobile device → player list shows both players

### Cross-Device Testing
- [ ] **Device 1 (laptop):** Create room via ngrok URL
- [ ] **Device 2 (iPhone):** Join room via ngrok URL
- [ ] Both devices see updated player list in real-time
- [ ] Close Device 2 browser → Device 1 shows player disconnected
- [ ] Reopen Device 2 browser, reconnect → player marked connected again

### Network Conditions
- [ ] Test on WiFi → works
- [ ] Test on mobile LTE → works
- [ ] Test mixed networks (one WiFi, one LTE) → works

## 7. Troubleshooting

### ngrok "Invalid Host Header"

**Symptom:** ngrok returns `Invalid Host Header` error page

**Cause:** Some tools (like Vite) validate the `Host` header for security. Bun doesn't do this by default, but if you see this error:

**Fix:** ngrok should work with Bun out of the box. If issues persist, check ngrok config:
```bash
ngrok config check
```

### Mixed Content Blocking WebSocket

**Symptom:** Browser console shows:
```
Mixed Content: The page at 'https://...' was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint 'ws://...'.
```

**Cause:** WebSocket URL is hardcoded to `ws://` instead of using protocol detection.

**Fix:** Implement protocol-aware WebSocket URL (see Section 1 above).

### Connection Timeouts on Mobile

**Symptom:** Mobile devices can load the page but WebSocket never connects (spinning indicator indefinitely).

**Possible causes:**
1. **Corporate/school network blocks WebSockets:** Try switching to mobile LTE
2. **VPN interference:** Disable VPN on mobile device
3. **ngrok tunnel died:** Restart `ngrok http 3000` and use new URL
4. **Server not running:** Verify `bun dev` is still active

**Debug steps:**
1. Open Safari DevTools on iPhone (connect to Mac via USB, enable Web Inspector)
2. Check console for WebSocket errors
3. Verify `wss://` URL is being used (not `ws://`)
4. Test ngrok URL on laptop first to isolate mobile-specific issues

### ngrok URL Changes Every Restart

**Symptom:** Free ngrok tier assigns random subdomain (`abc123.ngrok.io`), URL changes each restart.

**Solutions:**
- **Option 1:** Upgrade to ngrok Pro for custom domain (`crazy8.ngrok.app`)
- **Option 2:** Use ngrok's reserved domains (free tier: 1 domain allowed)
  ```bash
  ngrok http --domain=your-reserved-domain.ngrok-free.app 3000
  ```
- **Option 3:** Share new URL each time (acceptable for casual play)

## Success Criteria

- ✅ `start-server.sh` starts both Bun server and ngrok with one command
- ✅ WebSocket URL auto-detects protocol (`ws://` on localhost, `wss://` on ngrok)
- ✅ Landing page loads over ngrok HTTPS URL without errors
- ✅ Mobile devices can create/join rooms via ngrok URL
- ✅ Player list updates in real-time across devices
- ✅ Disconnect detection works (close browser tab → player marked disconnected)
- ✅ Server logs show room creation, joins, and disconnects
- ✅ `/metrics` endpoint shows active room count (optional)

## Next Steps

After deployment is working:
- **Share with friends:** Send ngrok URL via text/Discord/Slack
- **Test with real players:** 3-6 people on different devices
- **Monitor server logs:** Watch for errors during gameplay
- **Iterate on UX:** Collect feedback on mobile experience

For detailed step-by-step instructions, see `docs/guides/DEPLOYMENT-GUIDE.md`.
