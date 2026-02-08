import type { Server, ServerWebSocket } from "bun";
import {
  createRoom,
  joinRoom,
  disconnectPlayer,
  getRoomPlayerList,
  leaveRoom,
} from "./room-manager";

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
        leaveRoom(ws.data.roomCode, ws.data.playerId);
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
  const { roomCode, playerId } = createRoom(msg.playerName!, msg.avatar!);

  ws.data.playerId = playerId;
  ws.data.playerName = msg.playerName!;
  ws.data.avatar = msg.avatar!;
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
};

const handleJoin = (
  ws: ServerWebSocket<WebSocketData>,
  msg: IncomingMessage,
) => {
  try {
    const { playerId } = joinRoom(msg.roomCode!, msg.playerName!, msg.avatar!);

    ws.data.playerId = playerId;
    ws.data.playerName = msg.playerName!;
    ws.data.avatar = msg.avatar!;
    ws.data.roomCode = msg.roomCode!;

    ws.subscribe(msg.roomCode!);

    ws.send(
      JSON.stringify({
        type: "joined",
        roomCode: msg.roomCode!,
        playerId: playerId,
      }),
    );

    server.publish(
      msg.roomCode!,
      JSON.stringify({
        type: "playerList",
        players: getRoomPlayerList(msg.roomCode!),
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

console.log(`Server running on http://localhost:${server.port}`);
