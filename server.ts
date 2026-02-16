import type { Server, ServerWebSocket } from "bun";
import path from "path";
import {
  createRoom,
  joinRoom,
  disconnectPlayer,
  reconnectPlayer,
  getRoomPlayerList,
  leaveRoom,
  startGameInRoom,
  getRoom,
  GameStatus,
} from "./room-manager";
import {
  playCard,
  drawCard,
  getCurrentPlayer,
  getTopCard,
  checkWinCondition,
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
function validateString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required and must be a non-empty string`);
  }
  return value.trim();
}

function validateInt(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return value;
}

// Connection map to track active WebSocket connections by playerId
const playerConnections = new Map<string, ServerWebSocket<WebSocketData>>();

const server = Bun.serve<WebSocketData>({
  port: 3000,

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

    // Prevent path traversal attacks
    const publicDir = path.resolve("./public");
    let requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const resolvedPath = path.resolve(publicDir, "." + requestedPath);

    // Verify the resolved path is within the public directory
    if (!resolvedPath.startsWith(publicDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(resolvedPath);
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
        ws.send(
          JSON.stringify({ type: "error", message: (error as Error).message }),
        );
      }
    },

    close(ws: ServerWebSocket<WebSocketData>) {
      if (ws.data.roomCode && ws.data.playerId) {
        const roomCode = ws.data.roomCode;
        const playerId = ws.data.playerId;

        disconnectPlayer(roomCode, playerId);
        ws.unsubscribe(roomCode);
        playerConnections.delete(playerId);

        const room = getRoom(roomCode);
        if (!room) return;

        // If game is playing and disconnected player was current, advance turn
        if (room.status === GameStatus.playing) {
          const currentPlayerId = getCurrentPlayer(room);
          if (currentPlayerId === playerId) {
            // Auto-draw if pending draws, otherwise advance turn
            if (room.pendingDraws > 0) {
              try {
                drawCard(room, playerId);
              } catch {
                // Ignore errors (player already disconnected)
              }
            } else {
              advanceTurn(room);
            }
          }

          // Check if only 1 player left (game over)
          if (room.players.size === 1) {
            const winnerId = Array.from(room.players.keys())[0];
            broadcastGameState(roomCode, winnerId);
          } else {
            // Broadcast updated game state
            broadcastGameState(roomCode);
          }
        }

        // Broadcast updated player list
        server.publish(
          roomCode,
          JSON.stringify({
            type: "playerList",
            players: getRoomPlayerList(roomCode),
          }),
        );
      }
    },
  },
});

const handleCreate = (
  ws: ServerWebSocket<WebSocketData>,
  msg: IncomingMessage,
) => {
  try {
    const playerName = validateString(msg.playerName, "playerName");
    const avatar = validateString(msg.avatar, "avatar");

    const { roomCode, playerId } = createRoom(playerName, avatar);

    ws.data.playerId = playerId;
    ws.data.playerName = playerName;
    ws.data.avatar = avatar;
    ws.data.roomCode = roomCode;

    ws.subscribe(roomCode);
    playerConnections.set(playerId, ws);

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
    ws.send(
      JSON.stringify({
        type: "error",
        message: (error as Error).message,
      }),
    );
  }
};

const handleJoin = (
  ws: ServerWebSocket<WebSocketData>,
  msg: IncomingMessage,
) => {
  try {
    const roomCode = validateString(msg.roomCode, "roomCode").toUpperCase();
    const playerName = validateString(msg.playerName, "playerName");
    const avatar = validateString(msg.avatar, "avatar");

    const { playerId } = joinRoom(roomCode, playerName, avatar);

    ws.data.playerId = playerId;
    ws.data.playerName = playerName;
    ws.data.avatar = avatar;
    ws.data.roomCode = roomCode;

    ws.subscribe(roomCode);
    playerConnections.set(playerId, ws);

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
    ws.send(
      JSON.stringify({
        type: "error",
        message: (error as Error).message,
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

    // Clean up old WebSocket if player is rejoining
    const existingWs = playerConnections.get(playerId);
    if (existingWs && existingWs !== ws) {
      try {
        existingWs.unsubscribe(roomCode);
        existingWs.close();
      } catch {
        // Ignore errors from closing stale connections
      }
    }

    // Subscribe to room
    ws.subscribe(roomCode);
    playerConnections.set(playerId, ws);

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
    ws.send(
      JSON.stringify({
        type: "error",
        message: (error as Error).message,
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
    ws.send(
      JSON.stringify({
        type: "error",
        message: (error as Error).message,
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

    const card = player.hand[cardIndex];
    if (!card) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid card index" }));
      return;
    }

    if (card.type === "wild" || card.type === "plus4" || card.type === "plus20") {
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
      // Skip advances by 2 (skips 1 player)
      const playerArray = Array.from(room.players.keys());
      const count = playerArray.length;
      const skippedIndex = (room.currentPlayerIndex + room.direction + count) % count;
      skippedPlayerIds = [playerArray[skippedIndex]];
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

    // Check for winner
    const winner = checkWinCondition(room);

    // Broadcast updated state
    broadcastGameState(roomCode, winner);
  } catch (error) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: (error as Error).message,
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

    // Capture whether this is a forced draw before drawing
    const wasForcedDraw = room.pendingDraws > 0;

    const drawnCards = drawCard(room, playerId);

    // Send drawn cards to player (direct message)
    ws.send(
      JSON.stringify({
        type: "cardDrawn",
        cards: drawnCards,
        forced: wasForcedDraw,
      }),
    );

    // Broadcast updated state (hide drawn cards from others)
    broadcastGameState(roomCode);
  } catch (error) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: (error as Error).message,
      }),
    );
  }
};

console.log(`Server running on http://localhost:${server.port}`);
