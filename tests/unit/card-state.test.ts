import { test, expect, describe, beforeEach } from "bun:test";
import {
  createRoom,
  joinRoom,
  getRoom,
  leaveRoom,
  disconnectPlayer,
  getAllRooms,
} from "../../room-manager";

function clearRooms() {
  const rooms = getAllRooms();
  for (const code of Array.from(rooms.keys())) rooms.delete(code);
}

describe("new card state fields", () => {
  beforeEach(clearRooms);

  test("createRoom initializes the new flags to null", () => {
    const { roomCode } = createRoom("Host", "🐶");
    const room = getRoom(roomCode)!;
    expect(room.luckyDrawPlayerId).toBeNull();
    expect(room.revealHandsOwnerId).toBeNull();
  });

  test("disconnect clears luckyDrawPlayerId when the caster disconnects", () => {
    const { roomCode, playerId } = createRoom("Host", "🐶");
    const room = getRoom(roomCode)!;
    room.luckyDrawPlayerId = playerId;
    disconnectPlayer(roomCode, playerId);
    expect(room.luckyDrawPlayerId).toBeNull();
  });

  test("disconnect clears revealHandsOwnerId when the owner disconnects", () => {
    const { roomCode, playerId } = createRoom("Host", "🐶");
    const room = getRoom(roomCode)!;
    room.revealHandsOwnerId = playerId;
    disconnectPlayer(roomCode, playerId);
    expect(room.revealHandsOwnerId).toBeNull();
  });

  test("leave clears reveal/lucky flags when the leaver owns them", () => {
    const { roomCode, playerId } = createRoom("Host", "🐶");
    const { playerId: p2 } = joinRoom(roomCode, "P2", "🐱");
    const room = getRoom(roomCode)!;
    room.revealHandsOwnerId = p2;
    room.luckyDrawPlayerId = p2;
    leaveRoom(roomCode, p2);
    expect(room.revealHandsOwnerId).toBeNull();
    expect(room.luckyDrawPlayerId).toBeNull();
  });
});
