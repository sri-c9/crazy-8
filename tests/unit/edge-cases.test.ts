import { test, expect, describe } from "bun:test";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  getRoomPlayerList,
  startGameInRoom,
  getAllRooms,
  GameStatus,
} from "../../room-manager";

// ===========================================================================
// EDGE-CASE coverage for room-manager.ts (pure in-memory module).
//
// NOTE: player-name / room-code STRING validation (validatePlayerName /
// validateRoomCode) lives in server.ts and is NOT exported, so it cannot be
// imported. The "Server-side input validation" describe block below MIRRORS
// the exact logic from server.ts (lines 46-70) to document its behavior. If
// server.ts changes, these mirrors must be updated by hand.
// ===========================================================================

// Helper: spin up a room with N players, return { code, hostId, ids }.
function makeRoom(n: number): { code: string; hostId: string; ids: string[] } {
  const { roomCode, playerId } = createRoom("Host", "🐶");
  const ids = [playerId];
  for (let i = 1; i < n; i++) {
    const { playerId: pid } = joinRoom(roomCode, `P${i}`, "🐱");
    ids.push(pid);
  }
  return { code: roomCode, hostId: playerId, ids };
}

// ---------------------------------------------------------------------------
// 1. Max 6 players — 7th join rejected
// ---------------------------------------------------------------------------
describe("capacity (max 6)", () => {
  test("6 players join fine; 7th is rejected with 'Room is full'", () => {
    const { code } = makeRoom(6);
    expect(getRoom(code)!.players.size).toBe(6);
    expect(() => joinRoom(code, "Seventh", "🐭")).toThrow("Room is full");
  });

  test("capacity check happens BEFORE started-game check (order)", () => {
    // A full room that is ALSO playing should still say 'Room is full'
    const { code, hostId } = makeRoom(6);
    startGameInRoom(code, hostId);
    expect(() => joinRoom(code, "X", "🐭")).toThrow("Room is full");
  });
});

// ---------------------------------------------------------------------------
// 2 & 3. Start-game minimums / join a full room
// ---------------------------------------------------------------------------
describe("startGameInRoom minimum players", () => {
  test("1 player cannot start", () => {
    const { code, hostId } = makeRoom(1);
    expect(() => startGameInRoom(code, hostId)).toThrow("at least 3 players");
  });

  test("2 players cannot start", () => {
    const { code, hostId } = makeRoom(2);
    expect(() => startGameInRoom(code, hostId)).toThrow("at least 3 players");
  });

  test("3 players can start; status becomes playing", () => {
    const { code, hostId } = makeRoom(3);
    startGameInRoom(code, hostId);
    expect(getRoom(code)!.status).toBe(GameStatus.playing);
  });

  test("only the host may start the game", () => {
    const { code, ids } = makeRoom(3);
    expect(() => startGameInRoom(code, ids[1])).toThrow("Only host can start");
  });

  test("cannot start an already-started game", () => {
    const { code, hostId } = makeRoom(3);
    startGameInRoom(code, hostId);
    expect(() => startGameInRoom(code, hostId)).toThrow("Game already started");
  });
});

// ---------------------------------------------------------------------------
// 4. Join an already-started game (no mid-game join)
// ---------------------------------------------------------------------------
describe("join guards", () => {
  test("cannot join a room whose game is 'playing'", () => {
    const { code, hostId } = makeRoom(3);
    startGameInRoom(code, hostId);
    expect(() => joinRoom(code, "Latecomer", "🦊")).toThrow("Game already started");
  });

  test("cannot join a 'finished' game", () => {
    const { code, hostId, ids } = makeRoom(3);
    startGameInRoom(code, hostId);
    // Drain to 1 player -> status becomes finished (leaveRoom logic)
    leaveRoom(code, ids[1]);
    leaveRoom(code, ids[2]);
    expect(getRoom(code)!.status).toBe(GameStatus.finished);
    expect(() => joinRoom(code, "Late", "🦊")).toThrow("Game already started");
  });

  // 5. nonexistent room code
  test("joining a nonexistent room throws 'Room not found'", () => {
    expect(() => joinRoom("ZZZZ", "Nobody", "👻")).toThrow("Room not found");
  });
});

// ---------------------------------------------------------------------------
// 5. Server-side input validation — MIRROR of server.ts (NOT imported).
//    Mirrors validateString/validatePlayerName/validateRoomCode exactly.
// ---------------------------------------------------------------------------
describe("server validation (MIRROR of server.ts lines 46-70)", () => {
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

  // --- player names ---
  test("empty name rejected", () => {
    expect(() => validatePlayerName("")).toThrow("required");
  });
  test("whitespace-only name rejected", () => {
    expect(() => validatePlayerName("   ")).toThrow("required");
  });
  test("name is trimmed (leading/trailing whitespace stripped)", () => {
    expect(validatePlayerName("  Alice  ")).toBe("Alice");
  });
  test("name exactly 20 chars accepted", () => {
    expect(validatePlayerName("a".repeat(20))).toHaveLength(20);
  });
  test("name 21 chars REJECTED (truncation is NOT done — it throws)", () => {
    expect(() => validatePlayerName("a".repeat(21))).toThrow("characters or less");
  });
  test("non-string name rejected", () => {
    expect(() => validatePlayerName(42 as unknown)).toThrow("required");
    expect(() => validatePlayerName(null as unknown)).toThrow("required");
  });

  // --- room codes ---
  test("lowercase room code is upper-cased then validated (accepted)", () => {
    expect(validateRoomCode("abcd")).toBe("ABCD");
  });
  test("too-short room code rejected", () => {
    expect(() => validateRoomCode("ABC")).toThrow("Invalid room code format");
  });
  test("too-long room code rejected", () => {
    expect(() => validateRoomCode("ABCDE")).toThrow("Invalid room code format");
  });
  test("symbols / digits in room code rejected", () => {
    expect(() => validateRoomCode("AB1D")).toThrow("Invalid room code format");
    expect(() => validateRoomCode("AB!D")).toThrow("Invalid room code format");
  });
  test("empty room code rejected", () => {
    expect(() => validateRoomCode("")).toThrow("required");
  });
});

// ---------------------------------------------------------------------------
// 6/7. room-manager does NO name/avatar validation — duplicates allowed.
// ---------------------------------------------------------------------------
describe("room-manager name/avatar policy (documents actual behavior)", () => {
  test("room-manager accepts empty / whitespace / huge names (no validation here)", () => {
    const { roomCode } = createRoom("", "🐶");
    expect(() => joinRoom(roomCode, "   ", "🐱")).not.toThrow();
    expect(() => joinRoom(roomCode, "x".repeat(500), "🐭")).not.toThrow();
    // Confirms validation is the server boundary's job, not room-manager's.
    expect(getRoom(roomCode)!.players.size).toBe(3);
  });

  test("duplicate names ALLOWED", () => {
    const { roomCode } = createRoom("Same", "🐶");
    expect(() => joinRoom(roomCode, "Same", "🐱")).not.toThrow();
    const names = getRoomPlayerList(roomCode).map((p) => p.name);
    expect(names.filter((n) => n === "Same")).toHaveLength(2);
  });

  test("duplicate avatars ALLOWED", () => {
    const { roomCode } = createRoom("A", "🐶");
    joinRoom(roomCode, "B", "🐶");
    const avatars = getRoomPlayerList(roomCode).map((p) => p.avatar);
    expect(avatars.filter((a) => a === "🐶")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 8. Room-code generation: uniqueness / collision avoidance
// ---------------------------------------------------------------------------
describe("room-code generation", () => {
  test("generated codes are 4 uppercase letters and unique across many rooms", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const { roomCode } = createRoom("U", "🐶");
      expect(roomCode).toMatch(/^[A-Z]{4}$/);
      expect(codes.has(roomCode)).toBe(false); // collision loop guarantees uniqueness
      codes.add(roomCode);
    }
    expect(codes.size).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// 9. leaveRoom edge cases
// ---------------------------------------------------------------------------
describe("leaveRoom edge cases", () => {
  test("last player leaves -> room deleted", () => {
    const { roomCode, playerId } = createRoom("Solo", "🐶");
    leaveRoom(roomCode, playerId);
    expect(getRoom(roomCode)).toBeUndefined();
  });

  test("host leaves -> host reassigned to next remaining player", () => {
    const { code, hostId, ids } = makeRoom(3);
    leaveRoom(code, hostId);
    const room = getRoom(code)!;
    expect(room.hostId).not.toBe(hostId);
    expect(room.players.has(room.hostId)).toBe(true);
    expect(ids).toContain(room.hostId);
  });

  test("leaving a nonexistent room throws 'Room not found'", () => {
    expect(() => leaveRoom("ZZZZ", "p_nope")).toThrow("Room not found");
  });

  test("leaving with an unknown playerId in a real room does not crash; size unchanged for others", () => {
    const { code } = makeRoom(3);
    const before = getRoom(code)!.players.size;
    expect(() => leaveRoom(code, "p_ghost")).not.toThrow();
    expect(getRoom(code)!.players.size).toBe(before); // delete of missing key is a no-op
  });

  test("mid-game: dropping to 1 player marks game finished", () => {
    const { code, hostId, ids } = makeRoom(3);
    startGameInRoom(code, hostId);
    leaveRoom(code, ids[1]);
    expect(getRoom(code)!.status).toBe(GameStatus.playing);
    leaveRoom(code, ids[2]);
    expect(getRoom(code)!.status).toBe(GameStatus.finished);
  });

  // POTENTIAL BUG probe: currentPlayerIndex bounds after removing current player.
  test("mid-game: removing the current player keeps currentPlayerIndex in bounds", () => {
    const { code, hostId, ids } = makeRoom(4);
    startGameInRoom(code, hostId);
    const room = getRoom(code)!;
    // Force current player to be the LAST index (size-1), then remove that player.
    room.currentPlayerIndex = room.players.size - 1;
    const keys = Array.from(room.players.keys());
    const currentId = keys[room.currentPlayerIndex];
    leaveRoom(code, currentId);
    // Index must stay a valid index into the (now smaller) players map.
    expect(room.currentPlayerIndex).toBeLessThan(room.players.size);
    expect(room.currentPlayerIndex).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 10. In-memory only (by design). getAllRooms returns the live Map.
// ---------------------------------------------------------------------------
describe("in-memory state (by design)", () => {
  test("getAllRooms exposes the live in-memory Map (no persistence layer)", () => {
    const { roomCode } = createRoom("Mem", "🐶");
    const all = getAllRooms();
    expect(all instanceof Map).toBe(true);
    expect(all.has(roomCode)).toBe(true);
    // Documents: rooms live only in this Map; a process restart wipes them.
  });
});
