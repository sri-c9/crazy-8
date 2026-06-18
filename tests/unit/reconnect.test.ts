import { test, expect, describe, beforeEach } from "bun:test";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  disconnectPlayer,
  reconnectPlayer,
  getRoom,
  getRoomPlayerList,
  startGameInRoom,
  getAllRooms,
  GameStatus,
} from "../../room-manager";
import { getCurrentPlayer, advanceTurn } from "../../game-logic";

// Helper: clear the module-level rooms map between tests for isolation.
function clearRooms() {
  const rooms = getAllRooms();
  for (const code of Array.from(rooms.keys())) rooms.delete(code);
}

beforeEach(() => clearRooms());

describe("disconnectPlayer (LOBBY vs IN-GAME)", () => {
  test("marks player connected:false, does NOT remove them (lobby)", () => {
    const { roomCode, playerId } = createRoom("Host", "😎");
    const p2 = joinRoom(roomCode, "P2", "🔥");
    disconnectPlayer(roomCode, p2.playerId);

    const room = getRoom(roomCode)!;
    expect(room.players.has(p2.playerId)).toBe(true); // still present
    expect(room.players.get(p2.playerId)!.connected).toBe(false);
    const list = getRoomPlayerList(roomCode);
    expect(list.find((p) => p.id === p2.playerId)!.connected).toBe(false);
  });

  test("clears pendingDraws only when the CURRENT player disconnects mid-game", () => {
    const { roomCode, playerId } = createRoom("Host", "😎");
    const p2 = joinRoom(roomCode, "P2", "🔥");
    const p3 = joinRoom(roomCode, "P3", "👻");
    startGameInRoom(roomCode, playerId);
    const room = getRoom(roomCode)!;
    room.pendingDraws = 4;

    // Disconnect a NON-current player -> pendingDraws preserved
    const current = getCurrentPlayer(room);
    const nonCurrent = [playerId, p2.playerId, p3.playerId].find(
      (id) => id !== current,
    )!;
    disconnectPlayer(roomCode, nonCurrent);
    expect(room.pendingDraws).toBe(4);

    // Disconnect the CURRENT player -> pendingDraws cleared
    disconnectPlayer(roomCode, current);
    expect(room.pendingDraws).toBe(0);
  });

  test("disconnect on missing room is silently ignored (no throw)", () => {
    expect(() => disconnectPlayer("ZZZZ", "p_nope")).not.toThrow();
  });
});

describe("reconnectPlayer", () => {
  test("flips connected back to true for an existing player", () => {
    const { roomCode, playerId } = createRoom("Host", "😎");
    const p2 = joinRoom(roomCode, "P2", "🔥");
    disconnectPlayer(roomCode, p2.playerId);
    reconnectPlayer(roomCode, p2.playerId);
    expect(getRoom(roomCode)!.players.get(p2.playerId)!.connected).toBe(true);
  });

  test("THROWS 'Room not found' when the room was already deleted", () => {
    // This is the exact throw the server logs as "Rejoin error: Room not found".
    const { roomCode, playerId } = createRoom("Host", "😎");
    // Simulate the close handler having removed the last player -> room deleted.
    leaveRoom(roomCode, playerId);
    expect(getRoom(roomCode)).toBeUndefined();
    expect(() => reconnectPlayer(roomCode, playerId)).toThrow("Room not found");
  });

  test("THROWS 'Player not found in room' when room exists but player was removed", () => {
    const { roomCode, playerId } = createRoom("Host", "😎");
    const p2 = joinRoom(roomCode, "P2", "🔥");
    leaveRoom(roomCode, p2.playerId); // p2 removed, room survives (host remains)
    expect(() => reconnectPlayer(roomCode, p2.playerId)).toThrow(
      "Player not found in room",
    );
  });
});

describe("host reassignment & empty-room destruction", () => {
  test("host role transfers when host leaves; room survives", () => {
    const { roomCode, playerId } = createRoom("Host", "😎");
    const p2 = joinRoom(roomCode, "P2", "🔥");
    leaveRoom(roomCode, playerId);
    const room = getRoom(roomCode)!;
    expect(room).toBeDefined();
    expect(room.hostId).toBe(p2.playerId);
  });

  test("room is deleted when the last player leaves", () => {
    const { roomCode, playerId } = createRoom("Host", "😎");
    leaveRoom(roomCode, playerId);
    expect(getRoom(roomCode)).toBeUndefined();
  });

  test("disconnect does NOT reassign host (only leaveRoom does)", () => {
    const { roomCode, playerId } = createRoom("Host", "😎");
    const p2 = joinRoom(roomCode, "P2", "🔥");
    disconnectPlayer(roomCode, playerId); // host merely disconnected
    expect(getRoom(roomCode)!.hostId).toBe(playerId); // unchanged
  });
});

describe("turn auto-advance on removal (leaveRoom index adjustment)", () => {
  test("removing current player keeps currentPlayerIndex in bounds", () => {
    const { roomCode, playerId } = createRoom("Host", "😎");
    const p2 = joinRoom(roomCode, "P2", "🔥");
    const p3 = joinRoom(roomCode, "P3", "👻");
    startGameInRoom(roomCode, playerId);
    const room = getRoom(roomCode)!;

    // Force current to be the LAST player so removal could go out of bounds.
    room.currentPlayerIndex = 2;
    const currentId = getCurrentPlayer(room);
    leaveRoom(roomCode, currentId);
    expect(room.currentPlayerIndex).toBeLessThan(room.players.size);
    // The seat now holds a valid, different player.
    expect(getCurrentPlayer(room)).toBeDefined();
  });

  test("removing a player BEFORE current shifts index back by one", () => {
    const { roomCode, playerId } = createRoom("Host", "😎");
    const p2 = joinRoom(roomCode, "P2", "🔥");
    const p3 = joinRoom(roomCode, "P3", "👻");
    startGameInRoom(roomCode, playerId);
    const room = getRoom(roomCode)!;
    room.currentPlayerIndex = 2; // p3 is current
    leaveRoom(roomCode, playerId); // remove index 0
    // p3 should still be current (index shifted 2 -> 1)
    expect(room.currentPlayerIndex).toBe(1);
  });

  test("game ends when only one player remains after a removal", () => {
    const { roomCode, playerId } = createRoom("Host", "😎");
    const p2 = joinRoom(roomCode, "P2", "🔥");
    const p3 = joinRoom(roomCode, "P3", "👻");
    startGameInRoom(roomCode, playerId);
    leaveRoom(roomCode, p2.playerId);
    leaveRoom(roomCode, p3.playerId);
    expect(getRoom(roomCode)!.status).toBe(GameStatus.finished);
  });
});
