interface Player {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
}

interface Room {
  code: string;
  players: Map<string, Player>;
  hostId: string;
  status: GameStatus;
  createdAt: number;
}

const rooms = new Map<string, Room>();

enum GameStatus {
  waiting,
  playing,
  finished,
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
  };

  const room: Room = {
    code: roomCode,
    players: new Map<string, Player>(),
    hostId: hostId,
    status: GameStatus.waiting,
    createdAt: Date.now(),
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

export {
  createRoom,
  joinRoom,
  leaveRoom,
  disconnectPlayer,
  reconnectPlayer,
  getRoom,
  getRoomPlayerList,
  type Player,
  type Room,
  type PlayerListItem,
  GameStatus,
};
