import type { Card } from "./game-logic";
import { startGame } from "./game-logic";

interface Player {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
  hand: Card[];  // Player's cards
}

interface Room {
  code: string;
  players: Map<string, Player>;
  hostId: string;
  status: GameStatus;
  createdAt: number;
  // Game state fields
  currentPlayerIndex: number;
  direction: 1 | -1;
  discardPile: Card[];
  pendingDraws: number;
  reverseStackCount: number;
  lastPlayedColor: string | null;
}

const rooms = new Map<string, Room>();

export enum GameStatus {
  waiting = "waiting",
  playing = "playing",
  finished = "finished",
}

// Get a random letter A-Z
const getRandomLetter = (): string => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters[Math.floor(Math.random() * letters.length)];
};

const generateRoomCode = (): string => {
  let code: string;
  do {
    code = "";
    for (let i = 0; i < 4; i++) {
      code += getRandomLetter();
    }
  } while (rooms.has(code));
  return code;
};

const generatePlayerId = (): string => {
  return "p_" + Math.random().toString(36).substring(2, 9);
};

function createRoom(
  playerName: string,
  avatar: string,
): { roomCode: string; playerId: string } {
  let roomCode = generateRoomCode();
  let hostId = generatePlayerId();

  const hostPlayer: Player = {
    id: hostId,
    name: playerName,
    avatar: avatar,
    connected: true,
    hand: [],  // Initialize empty hand
  };

  const room: Room = {
    code: roomCode,
    players: new Map<string, Player>(),
    hostId: hostId,
    status: GameStatus.waiting,
    createdAt: Date.now(),
    // Initialize game state
    currentPlayerIndex: 0,
    direction: 1,
    discardPile: [],
    pendingDraws: 0,
    reverseStackCount: 0,
    lastPlayedColor: null,
  };
  room.players.set(hostId, hostPlayer);
  rooms.set(roomCode, room);
  return { roomCode: roomCode, playerId: hostId };
}

function joinRoom(
  roomCode: string,
  playerName: string,
  avatar: string,
): { playerId: string } {
  const room: Room | undefined = rooms.get(roomCode);

  if (!room) {
    throw new Error("Room not found");
  }
  if (room.players.size >= 6) {
    throw new Error("Room is full");
  }

  if (room.status != GameStatus.waiting) {
    throw new Error("Game already started");
  }

  let playerId = generatePlayerId();
  let player: Player = {
    id: playerId,
    name: playerName,
    avatar: avatar,
    connected: true,
    hand: [],  // Initialize empty hand
  };

  room.players.set(playerId, player);

  return { playerId: playerId };
}

function leaveRoom(roomCode: string, playerId: string): void {
  const room: Room | undefined = rooms.get(roomCode);

  if (!room) {
    throw new Error("Room not found");
  }

  room.players.delete(playerId);

  // If room is empty, delete it
  if (room.players.size === 0) {
    rooms.delete(roomCode);
    return;
  }

  // Transfer host if the leaving player was the host
  if (room.hostId === playerId) {
    // Make the first remaining player the new host
    const firstPlayer = Array.from(room.players.keys())[0];
    room.hostId = firstPlayer;
  }
}

function disconnectPlayer(roomCode: string, playerId: string): void {
  const room: Room | undefined = rooms.get(roomCode);

  if (!room) {
    return; // Silently ignore if room doesn't exist
  }

  const player = room.players.get(playerId);
  if (player) {
    player.connected = false;
  }
}

function reconnectPlayer(roomCode: string, playerId: string): void {
  const room: Room | undefined = rooms.get(roomCode);

  if (!room) {
    throw new Error("Room not found");
  }

  const player = room.players.get(playerId);
  if (!player) {
    throw new Error("Player not found in room");
  }

  player.connected = true;
}

function getRoom(roomCode: string): Room | undefined {
  return rooms.get(roomCode);
}

interface PlayerListItem extends Player {
  isHost: boolean;
}

function getRoomPlayerList(roomCode: string): PlayerListItem[] {
  const room = rooms.get(roomCode);
  if (!room) return [];

  return Array.from(room.players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    connected: player.connected,
    isHost: player.id === room.hostId,
  }));
}

// Start game in a room
function startGameInRoom(roomCode: string, hostId: string): void {
  const room = rooms.get(roomCode);

  if (!room) {
    throw new Error("Room not found");
  }

  if (room.hostId !== hostId) {
    throw new Error("Only host can start game");
  }

  if (room.players.size < 3) {
    throw new Error("Need at least 3 players to start");
  }

  if (room.status !== GameStatus.waiting) {
    throw new Error("Game already started");
  }

  // Start the game
  startGame(room);
}

export {
  createRoom,
  joinRoom,
  leaveRoom,
  disconnectPlayer,
  reconnectPlayer,
  getRoom,
  getRoomPlayerList,
  startGameInRoom,
  type Player,
  type Room,
  type PlayerListItem,
};
