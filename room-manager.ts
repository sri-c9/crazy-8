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

console.log(generateRoomCode());

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

const result: { roomCode: string; playerId: string } = createRoom(
  "Alice",
  "😎",
);
console.log(result); // { roomCode: "ABXY", playerId: "p_abc123" }
console.log(rooms.get(result.roomCode)); // Should show the room object with avatar

export function joinRoom(
  roomCode: string,
  playerName: string,
  avatar: string,
): { playerId: string } {
  const room = rooms.get(roomCode);

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

const room1 = createRoom("Alice", "😎");
const player2 = joinRoom(room1.roomCode, "Bob", "🔥");
console.log(rooms.get(room1.roomCode).players.size); // Should be 2
