import type { Server, ServerWebSocket } from "bun";
import { resolve } from "path";
import {
  createRoom,
  joinRoom,
  disconnectPlayer,
  reconnectPlayer,
  getRoomPlayerList,
  leaveRoom,
  startGameInRoom,
  getRoom,
  getAllRooms,
  deleteRoom,
  GameStatus,
} from "./room-manager";
import {
  playCard,
  drawCard,
  getCurrentPlayer,
  getTopCard,
  advanceTurn,
  type Card,
  type CardColor,
} from "./game-logic";

interface WebSocketData {
  playerId: string | null;
  playerName: string | null;
  avatar: string | null;
  roomCode: string | null;
}

interface IncomingMessage {
  action: string;
  playerName?: string;
  avatar?: string;
  roomCode?: string;
  playerId?: string;
  cardIndex?: number;
  chosenColor?: CardColor;
}

// Validation helpers
const MAX_PLAYER_NAME_LENGTH = 20;
const ROOM_CODE_REGEX = /^[A-Z]{4}$/;

function validateString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required and must be a non-empty string`);
  }
  return value.trim();
}

function validatePlayerName(value: unknown): string {
  const name = validateString(value, "playerName");
  if (name.length > MAX_PLAYER_NAME_LENGTH) {
    throw new Error(`Player name must be ${MAX_PLAYER_NAME_LENGTH} characters or less`);
  }
  return name;
}

function validateRoomCode(value: unknown): string {
  const code = validateString(value, "roomCode").toUpperCase();
  if (!ROOM_CODE_REGEX.test(code)) {
    throw new Error("Invalid room code format");
  }
  return code;
}

function validateInt(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return value;
}

// Sanitize error messages to avoid leaking server internals to clients
function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const safePatterns = [
      "is required", "characters or less", "Invalid room code",
      "must be a non-negative integer", "Room not found", "Room is full",
      "Game already started", "Player not found", "Not your turn",
      "Invalid card", "Cannot play", "Must choose a color",
      "Invalid color choice", "Not in a room", "Game is not in progress",
      "Invalid card index", "not the host", "at least", "Unknown action",
      "You are disconnected",
    ];
    if (safePatterns.some((p) => error.message.includes(p))) {
      return error.message;
    }
  }
  return "An error occurred";
}

// Connection map to track active WebSocket connections by playerId
const playerConnections = new Map<string, ServerWebSocket<WebSocketData>>();

// Multi-tab safety: close old connection before storing new one
function replacePlayerConnection(playerId: string, newWs: ServerWebSocket<WebSocketData>) {
  const oldWs = playerConnections.get(playerId);
  if (oldWs && oldWs !== newWs) {
    try {
      oldWs.close(1000, "Replaced by new connection");
    } catch {
      // Old connection may already be closed
    }
  }
  playerConnections.set(playerId, newWs);
}

// Disconnect timer maps
const turnSkipTimers = new Map<string, Timer>(); // 30s: auto-skip disconnected player's turn
const leaveTimers = new Map<string, Timer>(); // 2min: formally remove player from room

// Track disconnect metadata for timers (roomCode needed when timer fires)
const disconnectInfo = new Map<string, { roomCode: string }>();

// Rate limiting: sliding window tracking per connection
const MSG_RATE_LIMIT = 20; // max messages per second
const MSG_RATE_WINDOW = 1000; // 1 second window
const ROOM_CREATE_LIMIT = 5; // max room creates per minute
const ROOM_CREATE_WINDOW = 60_000; // 1 minute window

interface RateLimitState {
  messageTimestamps: number[];
  createTimestamps: number[];
}

const rateLimitState = new WeakMap<ServerWebSocket<WebSocketData>, RateLimitState>();

function getRateLimitState(ws: ServerWebSocket<WebSocketData>): RateLimitState {
  let state = rateLimitState.get(ws);
  if (!state) {
    state = { messageTimestamps: [], createTimestamps: [] };
    rateLimitState.set(ws, state);
  }
  return state;
}

function isMessageRateLimited(ws: ServerWebSocket<WebSocketData>): boolean {
  const state = getRateLimitState(ws);
  const now = Date.now();
  // Prune old timestamps
  state.messageTimestamps = state.messageTimestamps.filter(
    (t) => now - t < MSG_RATE_WINDOW,
  );
  if (state.messageTimestamps.length >= MSG_RATE_LIMIT) {
    return true;
  }
  state.messageTimestamps.push(now);
  return false;
}

function isCreateRateLimited(ws: ServerWebSocket<WebSocketData>): boolean {
  const state = getRateLimitState(ws);
  const now = Date.now();
  // Prune old timestamps
  state.createTimestamps = state.createTimestamps.filter(
    (t) => now - t < ROOM_CREATE_WINDOW,
  );
  if (state.createTimestamps.length >= ROOM_CREATE_LIMIT) {
    return true;
  }
  state.createTimestamps.push(now);
  return false;
}

const PORT = parseInt(Bun.env.PORT ?? "3000", 10);

const server = Bun.serve<WebSocketData>({
  port: PORT,

  async fetch(
    req: Request,
    server: Server<WebSocketData>,
  ): Promise<Response | undefined> {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const success = server.upgrade(req, {
        data: {
          playerId: null,
          playerName: null,
          avatar: null,
          roomCode: null,
        } as WebSocketData,
      });

      if (success) return undefined;
      return new Response("Websocket upgrade failed", { status: 500 });
    }

    const publicDir = resolve("./public");
    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const resolved = resolve("./public" + requestedPath);
    if (!resolved.startsWith(publicDir + "/") && resolved !== publicDir) {
      return new Response("Forbidden", { status: 403 });
    }

    // Gate admin panel behind a secret key
    if (requestedPath === "/admin.html" || requestedPath === "/admin-client.js" || requestedPath === "/dist/admin-client.js") {
      const key = url.searchParams.get("key");
      const adminKey = Bun.env.ADMIN_KEY ?? "dev-admin-2024";
      if (key !== adminKey) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    const file = Bun.file(resolved);
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not Found", { status: 404 });
  },

  websocket: {
    open(ws: ServerWebSocket<WebSocketData>) {
      console.log("WebSocket connected");
    },

    message(ws: ServerWebSocket<WebSocketData>, message: string) {
      // 2A-1: Max message size (4KB)
      if (message.length > 4096) {
        ws.send(JSON.stringify({ type: "error", message: "Message too large" }));
        return;
      }

      // Rate limit: reject if >20 messages/sec
      if (isMessageRateLimited(ws)) {
        ws.send(
          JSON.stringify({ type: "error", message: "Rate limited: too many messages" }),
        );
        return;
      }

      console.log("WebSocket message recieved: ", message);

      try {
        const msg = JSON.parse(message) as IncomingMessage;
        switch (msg.action) {
          case "create":
            handleCreate(ws, msg);
            break;
          case "join":
            handleJoin(ws, msg);
            break;
          case "rejoin":
            handleRejoin(ws, msg);
            break;
          case "startGame":
            handleStartGame(ws);
            break;
          case "play":
            handlePlayCard(ws, msg);
            break;
          case "draw":
            handleDrawCard(ws);
            break;
          default:
            ws.send(
              JSON.stringify({ type: "error", message: "Unknown action" }),
            );
        }
      } catch (error) {
        console.error("Message handler error:", error);
        ws.send(
          JSON.stringify({ type: "error", message: "Invalid request" }),
        );
      }
    },

    close(ws: ServerWebSocket<WebSocketData>) {
      if (ws.data.roomCode && ws.data.playerId) {
        const { roomCode, playerId } = ws.data;

        ws.unsubscribe(roomCode);

        // If a newer connection replaced this one, don't run disconnect logic
        if (playerConnections.get(playerId) !== ws) {
          return;
        }

        disconnectPlayer(roomCode, playerId);
        playerConnections.delete(playerId);

        // Store disconnect info for timer callbacks
        disconnectInfo.set(playerId, { roomCode });

        // Broadcast updated player list
        server.publish(
          roomCode,
          JSON.stringify({
            type: "playerList",
            players: getRoomPlayerList(roomCode),
          }),
        );

        // 1B: 30s timer — auto-skip turn if it's this player's turn
        const skipTimer = setTimeout(() => {
          turnSkipTimers.delete(playerId);

          const room = getRoom(roomCode);
          if (!room) return;
          if (room.status !== GameStatus.playing) return;

          const player = room.players.get(playerId);
          if (!player || player.connected) return; // reconnected

          // If it's this player's turn, advance
          const currentPlayerId = getCurrentPlayer(room);
          if (currentPlayerId === playerId) {
            // Clear any pending draws before skipping
            room.pendingDraws = 0;
            advanceTurn(room);
            broadcastGameState(roomCode);
          }
        }, 30_000);
        turnSkipTimers.set(playerId, skipTimer);

        // 1C: 2min timer — formally remove player from room
        const leaveTimer = setTimeout(() => {
          leaveTimers.delete(playerId);
          disconnectInfo.delete(playerId);

          const room = getRoom(roomCode);
          if (!room) return;

          const player = room.players.get(playerId);
          if (!player || player.connected) return; // reconnected

          // Check if it's their turn before removing (advance first)
          if (room.status === GameStatus.playing) {
            const currentPlayerId = getCurrentPlayer(room);
            if (currentPlayerId === playerId) {
              room.pendingDraws = 0;
              advanceTurn(room);
            }
          }

          try {
            leaveRoom(roomCode, playerId);
          } catch {
            return; // Room may already be gone
          }

          // Room may have been deleted if it was the last player
          const updatedRoom = getRoom(roomCode);
          if (!updatedRoom) return;

          // Broadcast updated player list
          server.publish(
            roomCode,
            JSON.stringify({
              type: "playerList",
              players: getRoomPlayerList(roomCode),
            }),
          );

          // If only 1 player left in an active game, end it
          if (updatedRoom.status === GameStatus.playing && updatedRoom.players.size <= 1) {
            updatedRoom.status = GameStatus.finished;
            const winnerId = updatedRoom.players.size === 1
              ? Array.from(updatedRoom.players.keys())[0]
              : null;
            broadcastGameState(roomCode, winnerId);
          } else if (updatedRoom.status === GameStatus.playing) {
            // Broadcast state so remaining players see updated turn
            broadcastGameState(roomCode);
          }
        }, 120_000);
        leaveTimers.set(playerId, leaveTimer);
      }
    },
  },
});

const handleCreate = (
  ws: ServerWebSocket<WebSocketData>,
  msg: IncomingMessage,
) => {
  try {
    // Rate limit: reject if >5 room creates/min
    if (isCreateRateLimited(ws)) {
      ws.send(
        JSON.stringify({ type: "error", message: "Rate limited: too many room creations" }),
      );
      return;
    }

    const playerName = validatePlayerName(msg.playerName);
    const avatar = validateString(msg.avatar, "avatar");

    const { roomCode, playerId } = createRoom(playerName, avatar);

    ws.data.playerId = playerId;
    ws.data.playerName = playerName;
    ws.data.avatar = avatar;
    ws.data.roomCode = roomCode;

    ws.subscribe(roomCode);
    replacePlayerConnection(playerId, ws);

    ws.send(
      JSON.stringify({
        type: "roomCreated",
        roomCode,
        playerId,
      }),
    );

    server.publish(
      roomCode,
      JSON.stringify({
        type: "playerList",
        players: getRoomPlayerList(roomCode),
      }),
    );
  } catch (error) {
    console.error("Create room error:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Failed to create room",
      }),
    );
  }
};

const handleJoin = (
  ws: ServerWebSocket<WebSocketData>,
  msg: IncomingMessage,
) => {
  try {
    const roomCode = validateRoomCode(msg.roomCode);
    const playerName = validatePlayerName(msg.playerName);
    const avatar = validateString(msg.avatar, "avatar");

    const { playerId } = joinRoom(roomCode, playerName, avatar);

    ws.data.playerId = playerId;
    ws.data.playerName = playerName;
    ws.data.avatar = avatar;
    ws.data.roomCode = roomCode;

    ws.subscribe(roomCode);
    replacePlayerConnection(playerId, ws);

    ws.send(
      JSON.stringify({
        type: "joined",
        roomCode: roomCode,
        playerId: playerId,
      }),
    );

    server.publish(
      roomCode,
      JSON.stringify({
        type: "playerList",
        players: getRoomPlayerList(roomCode),
      }),
    );
  } catch (error) {
    console.error("Join room error:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: safeErrorMessage(error),
      }),
    );
  }
};

const handleRejoin = (
  ws: ServerWebSocket<WebSocketData>,
  msg: IncomingMessage,
) => {
  try {
    const roomCode = validateString(msg.roomCode, "roomCode").toUpperCase();
    const playerId = validateString(msg.playerId, "playerId");

    // Cancel disconnect timers
    const skipTimer = turnSkipTimers.get(playerId);
    if (skipTimer) {
      clearTimeout(skipTimer);
      turnSkipTimers.delete(playerId);
    }
    const leaveTimer = leaveTimers.get(playerId);
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimers.delete(playerId);
    }
    disconnectInfo.delete(playerId);

    // Reconnect the player
    reconnectPlayer(roomCode, playerId);

    // Get the room to retrieve player info
    const room = getRoom(roomCode);
    if (!room) {
      ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
      return;
    }

    const player = room.players.get(playerId);
    if (!player) {
      ws.send(JSON.stringify({ type: "error", message: "Player not found" }));
      return;
    }

    // Update WebSocket data
    ws.data.playerId = playerId;
    ws.data.playerName = player.name;
    ws.data.avatar = player.avatar;
    ws.data.roomCode = roomCode;

    // Subscribe to room
    ws.subscribe(roomCode);
    replacePlayerConnection(playerId, ws);

    // Send rejoined confirmation
    ws.send(
      JSON.stringify({
        type: "rejoined",
        roomCode: roomCode,
        playerId: playerId,
      }),
    );

    // Broadcast updated player list
    server.publish(
      roomCode,
      JSON.stringify({
        type: "playerList",
        players: getRoomPlayerList(roomCode),
      }),
    );

    // If game is in progress, send game state
    if (room.status === "playing") {
      broadcastGameState(roomCode);
    }
  } catch (error) {
    console.error("Rejoin error:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Failed to rejoin room",
      }),
    );
  }
};

// Helper function to broadcast game state to all players in a room
const broadcastGameState = (roomCode: string, winner?: string | null) => {
  const room = getRoom(roomCode);
  if (!room) return;

  const currentPlayerId = getCurrentPlayer(room);
  const topCard = getTopCard(room);

  // Send personalized state to each player
  for (const [playerId, player] of room.players) {
    const personalizedState = {
      type: "state",
      gameState: {
        currentPlayerId,
        topCard,
        lastPlayedColor: room.lastPlayedColor,
        direction: room.direction,
        pendingDraws: room.pendingDraws,
        reverseStackCount: room.reverseStackCount,
        players: Array.from(room.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          connected: p.connected,
          cardCount: p.hand.length,
          hand: p.id === playerId ? p.hand : undefined, // Only send own hand
        })),
        winner: winner || null,
      },
      yourPlayerId: playerId,
    };

    // Send directly to this player's connection (not broadcast)
    const playerWs = playerConnections.get(playerId);
    if (playerWs) {
      playerWs.send(JSON.stringify(personalizedState));
    }
  }
};

// Handle start game
const handleStartGame = (ws: ServerWebSocket<WebSocketData>) => {
  const { roomCode, playerId } = ws.data;

  if (!roomCode || !playerId) {
    ws.send(JSON.stringify({ type: "error", message: "Not in a room" }));
    return;
  }

  try {
    startGameInRoom(roomCode, playerId);

    // Broadcast game started message
    server.publish(
      roomCode,
      JSON.stringify({
        type: "gameStarted",
        message: "Game started!",
      }),
    );

    // Broadcast initial game state
    broadcastGameState(roomCode);
  } catch (error) {
    console.error("Start game error:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Failed to start game",
      }),
    );
  }
};

// Handle play card
const handlePlayCard = (
  ws: ServerWebSocket<WebSocketData>,
  msg: IncomingMessage,
) => {
  const { roomCode, playerId } = ws.data;

  if (!roomCode || !playerId) {
    ws.send(JSON.stringify({ type: "error", message: "Not in a room" }));
    return;
  }

  try {
    const cardIndex = validateInt(msg.cardIndex, "cardIndex");

    const room = getRoom(roomCode);
    if (!room) {
      ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
      return;
    }

    // Check game status
    if (room.status !== GameStatus.playing) {
      ws.send(JSON.stringify({ type: "error", message: "Game is not in progress" }));
      return;
    }

    // Validate chosenColor for wild-type cards
    const player = room.players.get(playerId);
    if (!player) {
      ws.send(JSON.stringify({ type: "error", message: "Player not found" }));
      return;
    }
    if (!player.connected) {
      ws.send(JSON.stringify({ type: "error", message: "You are disconnected" }));
      return;
    }

    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid card index" }));
      return;
    }

    const card = player.hand[cardIndex];
    if (card && (card.type === "wild" || card.type === "plus4" || card.type === "plus20")) {
      if (!msg.chosenColor) {
        ws.send(JSON.stringify({ type: "error", message: "Must choose a color for this card" }));
        return;
      }
      const validColors: CardColor[] = ["red", "blue", "green", "yellow"];
      if (!validColors.includes(msg.chosenColor)) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid color choice" }));
        return;
      }
    }

    // Get the card and next player info before playCard modifies state
    let swapTargetId: string | null = null;
    let skippedPlayerIds: string[] = [];

    if (card.type === "swap") {
      const playerArray = Array.from(room.players.keys());
      const count = playerArray.length;
      const nextPlayerIndex = (room.currentPlayerIndex + room.direction + count) % count;
      swapTargetId = playerArray[nextPlayerIndex];
    }

    if (card.type === "skip") {
      // Skip advances by 3 (skips 2 players)
      const playerArray = Array.from(room.players.keys());
      const count = playerArray.length;
      const skippedIndex1 = (room.currentPlayerIndex + room.direction + count) % count;
      const skippedIndex2 = (room.currentPlayerIndex + 2 * room.direction + count) % count;
      skippedPlayerIds = [playerArray[skippedIndex1], playerArray[skippedIndex2]];
    }

    playCard(room, playerId, cardIndex, msg.chosenColor);

    // Send skip effect notifications
    if (skippedPlayerIds.length > 0) {
      skippedPlayerIds.forEach((skippedId) => {
        const ws = playerConnections.get(skippedId);
        if (ws) {
          ws.send(JSON.stringify({ type: "cardEffect", effect: "skipped" }));
        }
      });
    }

    // Send reverse effect notification (broadcast to all)
    if (card.type === "reverse") {
      server.publish(
        roomCode,
        JSON.stringify({ type: "cardEffect", effect: "reversed" }),
      );
    }

    // Send swap effect notifications
    if (swapTargetId) {
      // Send to the player who played the swap
      const playerWs = playerConnections.get(playerId);
      if (playerWs) {
        playerWs.send(
          JSON.stringify({
            type: "cardEffect",
            effect: "youSwapped",
            targetPlayerId: swapTargetId,
          }),
        );
      }

      // Send to the player who was swapped with
      const targetWs = playerConnections.get(swapTargetId);
      if (targetWs) {
        targetWs.send(
          JSON.stringify({
            type: "cardEffect",
            effect: "swapped",
            targetPlayerId: playerId,
          }),
        );
      }
    }

    // Determine winner — playCard() already sets room.status to finished
    // when a player empties their hand, so just check status here.
    const winner = room.status === GameStatus.finished ? playerId : null;

    // Broadcast updated state
    broadcastGameState(roomCode, winner);
  } catch (error) {
    console.error("Play card error:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: safeErrorMessage(error),
      }),
    );
  }
};

// Handle draw card
const handleDrawCard = (ws: ServerWebSocket<WebSocketData>) => {
  const { roomCode, playerId } = ws.data;

  if (!roomCode || !playerId) {
    ws.send(JSON.stringify({ type: "error", message: "Not in a room" }));
    return;
  }

  try {
    const room = getRoom(roomCode);
    if (!room) {
      ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
      return;
    }

    // Check game status
    if (room.status !== GameStatus.playing) {
      ws.send(JSON.stringify({ type: "error", message: "Game is not in progress" }));
      return;
    }

    const player = room.players.get(playerId);
    if (!player) {
      ws.send(JSON.stringify({ type: "error", message: "Player not found" }));
      return;
    }
    if (!player.connected) {
      ws.send(JSON.stringify({ type: "error", message: "You are disconnected" }));
      return;
    }

    const drawnCards = drawCard(room, playerId);

    // Send drawn cards to player (direct message)
    ws.send(
      JSON.stringify({
        type: "cardDrawn",
        cards: drawnCards,
        forced: drawnCards.length > 1, // True if plus-stack forced draw
      }),
    );

    // Broadcast updated state (hide drawn cards from others)
    broadcastGameState(roomCode);
  } catch (error) {
    console.error("Draw card error:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        message: safeErrorMessage(error),
      }),
    );
  }
};

// 1C: Periodic room cleanup — every 5 minutes, sweep rooms where ALL players
// have been disconnected for >5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STALE_DISCONNECT_THRESHOLD = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const now = Date.now();
  const rooms = getAllRooms();

  for (const [roomCode, room] of Array.from(rooms.entries())) {
    const allDisconnected = Array.from(room.players.values()).every(
      (p) => !p.connected,
    );

    if (!allDisconnected) continue;

    // Safety net: if room is old enough and everyone is disconnected, clean it up.
    // The 2-min leave timers handle individual removal, but this sweep catches
    // rooms where timers may have misfired or all players disconnected in waiting state.
    const roomAge = now - room.createdAt;
    if (roomAge > STALE_DISCONNECT_THRESHOLD) {
      // Clean up any remaining timers for players in this room
      const playerIds = Array.from(room.players.keys());
      for (const playerId of playerIds) {
        const skipTimer = turnSkipTimers.get(playerId);
        if (skipTimer) {
          clearTimeout(skipTimer);
          turnSkipTimers.delete(playerId);
        }
        const leaveTimer = leaveTimers.get(playerId);
        if (leaveTimer) {
          clearTimeout(leaveTimer);
          leaveTimers.delete(playerId);
        }
        disconnectInfo.delete(playerId);
        playerConnections.delete(playerId);
      }
      deleteRoom(roomCode);
      console.log(`Cleaned up stale room ${roomCode}`);
    }
  }
}, CLEANUP_INTERVAL);

console.log(`Server running on http://localhost:${server.port}`);
