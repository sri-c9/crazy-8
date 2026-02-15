import type { Server, ServerWebSocket } from "bun";
import {
  createRoom,
  joinRoom,
  disconnectPlayer,
  getRoomPlayerList,
  leaveRoom,
  startGameInRoom,
  getRoom,
} from "./room-manager";
import {
  playCard,
  drawCard,
  getCurrentPlayer,
  getTopCard,
  checkWinCondition,
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

    let filePath: string = "./public" + url.pathname;
    if (url.pathname === "/") {
      filePath = "./public/index.html";
    }
    const file = Bun.file(filePath);
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
        disconnectPlayer(ws.data.roomCode, ws.data.playerId);
        ws.unsubscribe(ws.data.roomCode);

        server.publish(
          ws.data.roomCode,
          JSON.stringify({
            type: "playerList",
            players: getRoomPlayerList(ws.data.roomCode),
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
    const roomCode = validateString(msg.roomCode, "roomCode");
    const playerName = validateString(msg.playerName, "playerName");
    const avatar = validateString(msg.avatar, "avatar");

    const { playerId } = joinRoom(roomCode, playerName, avatar);

    ws.data.playerId = playerId;
    ws.data.playerName = playerName;
    ws.data.avatar = avatar;
    ws.data.roomCode = roomCode;

    ws.subscribe(roomCode);

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

    // Publish to room (each connected player receives their personalized state)
    server.publish(roomCode, JSON.stringify(personalizedState));
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

    // Validate chosenColor for wild-type cards
    const player = room.players.get(playerId);
    if (player) {
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
    }

    // Get the card and next player info before playCard modifies state
    const card = player.hand[cardIndex];
    let swapTargetId: string | null = null;

    if (card.type === "swap") {
      const playerArray = Array.from(room.players.keys());
      const count = playerArray.length;
      const nextPlayerIndex = (room.currentPlayerIndex + room.direction + count) % count;
      swapTargetId = playerArray[nextPlayerIndex];
    }

    playCard(room, playerId, cardIndex, msg.chosenColor);

    // Send swap effect notifications
    if (swapTargetId) {
      // Send to the player who played the swap
      for (const [pid, p] of room.players) {
        if (pid === playerId) {
          server.publish(
            roomCode,
            JSON.stringify({
              type: "cardEffect",
              effect: "youSwapped",
              targetPlayerId: pid,
            }),
          );
        } else if (pid === swapTargetId) {
          // Send to the player who was swapped with
          server.publish(
            roomCode,
            JSON.stringify({
              type: "cardEffect",
              effect: "swapped",
              targetPlayerId: pid,
            }),
          );
        }
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
    ws.send(
      JSON.stringify({
        type: "error",
        message: (error as Error).message,
      }),
    );
  }
};

console.log(`Server running on http://localhost:${server.port}`);
