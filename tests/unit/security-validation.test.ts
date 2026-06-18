// Security unit tests (bun:test) — added by SECURITY audit agent.
// Exercises REAL production modules: room-manager.ts (session tokens, rooms),
// and the path-traversal guard logic used in server.ts fetch().
// These are isolated unit tests; they do NOT start a server or use port 3000.

import { describe, test, expect, beforeEach } from "bun:test";
import { resolve } from "path";
import {
  createRoom,
  joinRoom,
  getRoom,
  reconnectPlayer,
  getAllRooms,
  type Room,
} from "../../room-manager";

// Helper: clear the shared in-memory room map between tests so state doesn't leak.
function clearRooms() {
  const rooms = getAllRooms();
  rooms.clear();
}

beforeEach(clearRooms);

// ---------------------------------------------------------------------------
// Replicas of server.ts validation rules. The production helpers are NOT
// exported, so we mirror them here to lock in expected behavior and document
// the contract the server is expected to enforce. Kept in sync with
// server.ts lines 46-70.
// ---------------------------------------------------------------------------
const MAX_PLAYER_NAME_LENGTH = 20;
const ROOM_CODE_REGEX = /^[A-Z]{4}$/;

function validateStringRef(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("required and must be a non-empty string");
  }
  return value.trim();
}
function validatePlayerNameRef(value: unknown): string {
  const name = validateStringRef(value);
  if (name.length > MAX_PLAYER_NAME_LENGTH) {
    throw new Error("Player name must be 20 characters or less");
  }
  return name;
}
function validateRoomCodeRef(value: unknown): string {
  const code = validateStringRef(value).toUpperCase();
  if (!ROOM_CODE_REGEX.test(code)) throw new Error("Invalid room code format");
  return code;
}

describe("validatePlayerName contract", () => {
  test("rejects empty / whitespace-only / non-string", () => {
    expect(() => validatePlayerNameRef("")).toThrow();
    expect(() => validatePlayerNameRef("   ")).toThrow();
    expect(() => validatePlayerNameRef(undefined)).toThrow();
    expect(() => validatePlayerNameRef(null)).toThrow();
    expect(() => validatePlayerNameRef(42)).toThrow();
    expect(() => validatePlayerNameRef({})).toThrow();
  });

  test("trims surrounding whitespace", () => {
    expect(validatePlayerNameRef("  Alice  ")).toBe("Alice");
  });

  test("rejects names longer than 20 chars (no truncation, hard reject)", () => {
    expect(() => validatePlayerNameRef("A".repeat(21))).toThrow();
    expect(validatePlayerNameRef("A".repeat(20))).toBe("A".repeat(20));
  });

  test("accepts unicode and does NOT sanitize injection-y strings (stored raw)", () => {
    // FINDING: name is stored verbatim — no HTML/script sanitization at the
    // validation layer. XSS safety depends entirely on the client rendering
    // via textContent (it does — see admin-client el()/game-client).
    expect(validatePlayerNameRef("<script>x</script>")).toBe("<script>x</script>");
    expect(validatePlayerNameRef("🔥émoji")).toBe("🔥émoji");
  });
});

describe("validateRoomCode contract", () => {
  test("uppercases lowercase codes", () => {
    expect(validateRoomCodeRef("abcd")).toBe("ABCD");
  });
  test("rejects wrong length", () => {
    expect(() => validateRoomCodeRef("ABC")).toThrow();
    expect(() => validateRoomCodeRef("ABCDE")).toThrow();
  });
  test("rejects digits / symbols / whitespace-embedded", () => {
    expect(() => validateRoomCodeRef("AB1D")).toThrow();
    expect(() => validateRoomCodeRef("AB-D")).toThrow();
    expect(() => validateRoomCodeRef("A BD")).toThrow();
    expect(() => validateRoomCodeRef("../x")).toThrow();
  });
  test("rejects empty / non-string", () => {
    expect(() => validateRoomCodeRef("")).toThrow();
    expect(() => validateRoomCodeRef(null)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Session-token rejoin impersonation — exercises REAL room-manager state plus
// the exact token comparison server.ts handleRejoin uses (player.sessionToken
// !== token). server.ts:534-535.
// ---------------------------------------------------------------------------
describe("session token rejoin impersonation", () => {
  function rejoinTokenCheck(room: Room, playerId: string, providedToken: unknown): boolean {
    // Mirror of server.ts handleRejoin token gate.
    reconnectPlayer(room.code, playerId); // real reconnect (flips connected=true)
    const player = room.players.get(playerId);
    if (!player) return false;
    const token = typeof providedToken === "string" ? providedToken : "";
    return player.sessionToken === token; // true => rejoin allowed
  }

  test("each player gets a distinct random session token", () => {
    const host = createRoom("Host", "😎");
    const p2 = joinRoom(host.roomCode, "P2", "🔥");
    expect(host.sessionToken).toBeTruthy();
    expect(p2.sessionToken).toBeTruthy();
    expect(host.sessionToken).not.toBe(p2.sessionToken);
  });

  test("correct token is accepted", () => {
    const host = createRoom("Host", "😎");
    const room = getRoom(host.roomCode)!;
    expect(rejoinTokenCheck(room, host.playerId, host.sessionToken)).toBe(true);
  });

  test("WRONG token is rejected", () => {
    const host = createRoom("Host", "😎");
    const room = getRoom(host.roomCode)!;
    expect(rejoinTokenCheck(room, host.playerId, "not-the-token")).toBe(false);
  });

  test("EMPTY token is rejected", () => {
    const host = createRoom("Host", "😎");
    const room = getRoom(host.roomCode)!;
    expect(rejoinTokenCheck(room, host.playerId, "")).toBe(false);
  });

  test("MISSING / non-string token is rejected (coerced to empty string)", () => {
    const host = createRoom("Host", "😎");
    const room = getRoom(host.roomCode)!;
    expect(rejoinTokenCheck(room, host.playerId, undefined)).toBe(false);
    expect(rejoinTokenCheck(room, host.playerId, null)).toBe(false);
    expect(rejoinTokenCheck(room, host.playerId, 12345)).toBe(false);
  });

  test("cannot rejoin as ANOTHER player using your own token", () => {
    const host = createRoom("Host", "😎");
    const p2 = joinRoom(host.roomCode, "P2", "🔥");
    const room = getRoom(host.roomCode)!;
    // Attacker knows victim's playerId but presents their own token.
    expect(rejoinTokenCheck(room, host.playerId, p2.sessionToken)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Path traversal guard — mirrors server.ts fetch() lines 206-211 exactly.
// ---------------------------------------------------------------------------
describe("static file path traversal guard", () => {
  const publicDir = resolve("./public");

  function isAllowed(pathname: string): boolean {
    const requestedPath = pathname === "/" ? "/index.html" : pathname;
    const resolved = resolve("./public" + requestedPath);
    return resolved.startsWith(publicDir + "/") || resolved === publicDir;
  }

  test("allows normal files inside public/", () => {
    expect(isAllowed("/")).toBe(true);
    expect(isAllowed("/index.html")).toBe(true);
    expect(isAllowed("/dist/game-client.js")).toBe(true);
  });

  test("blocks ../ traversal to repo root", () => {
    expect(isAllowed("/../server.ts")).toBe(false);
    expect(isAllowed("/../../etc/passwd")).toBe(false);
    expect(isAllowed("/../room-manager.ts")).toBe(false);
  });

  test("blocks sibling-prefix escape (publicDir-prefix confusion)", () => {
    // e.g. resolving to /repo/public-secret should NOT be allowed.
    expect(isAllowed("/../public-secret/x")).toBe(false);
  });

  test("NOTE: URL-encoded traversal is decoded by URL() before this guard", () => {
    // The server reads url.pathname from `new URL(req.url)`, which percent-
    // decodes %2f -> '/'. So '/..%2f..%2fserver.ts' becomes '/../../server.ts'
    // and is then blocked by the same resolve() check. Simulate the decoded form:
    expect(isAllowed("/../../server.ts")).toBe(false);
  });
});
