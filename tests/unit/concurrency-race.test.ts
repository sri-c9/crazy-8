import { test, expect, describe } from "bun:test";
import {
  playCard,
  drawCard,
  getCurrentPlayer,
  type Card,
} from "../../game-logic";
import { GameStatus, type Room, type Player } from "../../room-manager";

// Build a deterministic room with N players, each given an explicit hand.
function makeRoom(hands: Card[][]): Room {
  const players = new Map<string, Player>();
  hands.forEach((hand, i) => {
    const id = `p${i}`;
    players.set(id, {
      id,
      sessionToken: `t${i}`,
      name: `P${i}`,
      avatar: "x",
      connected: true,
      hand: [...hand],
    } as Player);
  });
  return {
    code: "TEST",
    players,
    hostId: "p0",
    status: GameStatus.playing,
    createdAt: 0,
    lastActivityAt: 0,
    currentPlayerIndex: 0,
    direction: 1,
    discardPile: [{ type: "number", color: "red", value: 5 }],
    pendingDraws: 0,
    reverseStackCount: 0,
    lastPlayedColor: "red",
    luckyDrawPlayerId: null,
    revealHandsOwnerId: null,
  } as Room;
}

const redCard: Card = { type: "number", color: "red", value: 3 };

describe("playCard index bounds (double-play / stale index)", () => {
  test("playing same index twice: 2nd play throws 'Not your turn' (turn advanced)", () => {
    const room = makeRoom([
      [redCard, redCard], // p0
      [redCard],          // p1
      [redCard],          // p2
    ]);
    playCard(room, "p0", 0); // p0 plays, hand now [redCard], turn -> p1
    expect(getCurrentPlayer(room)).toBe("p1");
    // Replaying as p0 with same index must be rejected (not their turn)
    expect(() => playCard(room, "p0", 0)).toThrow("Not your turn");
  });

  test("out-of-bounds index throws 'Invalid card index'", () => {
    const room = makeRoom([[redCard], [redCard], [redCard]]);
    expect(() => playCard(room, "p0", 5)).toThrow("Invalid card index");
    expect(() => playCard(room, "p0", -1)).toThrow("Invalid card index");
  });

  test("stale index after hand shrinks: index now out of bounds is rejected", () => {
    // p0 has 1 card. If a double-play used index 0 then index 0 again after winning,
    // simulate: p0 plays its only card -> wins, status finished, hand empty.
    const room = makeRoom([[redCard], [redCard], [redCard]]);
    playCard(room, "p0", 0);
    expect(room.status).toBe(GameStatus.finished);
    // game-logic itself does not re-guard status; that is server.ts's job.
    // But index 0 into empty hand must throw if attempted at logic layer:
    expect(() => playCard(room, "p0", 0)).toThrow();
  });
});

describe("out-of-turn play/draw rejection (logic layer)", () => {
  test("non-current player playing is rejected", () => {
    const room = makeRoom([[redCard], [redCard], [redCard]]);
    expect(() => playCard(room, "p1", 0)).toThrow("Not your turn");
    expect(() => playCard(room, "p2", 0)).toThrow("Not your turn");
  });
  test("non-current player drawing is rejected", () => {
    const room = makeRoom([[redCard], [redCard], [redCard]]);
    expect(() => drawCard(room, "p1")).toThrow("Not your turn");
  });
});

describe("double-DRAW pendingDraws integrity", () => {
  test("first draw consumes pendingDraws and advances turn; 2nd draw by same player rejected", () => {
    const room = makeRoom([[redCard], [redCard], [redCard]]);
    room.pendingDraws = 20;
    const drawn = drawCard(room, "p0");
    expect(drawn.length).toBe(20);        // drew the full stack
    expect(room.pendingDraws).toBe(0);    // reset
    expect(getCurrentPlayer(room)).toBe("p1"); // advanced
    // A racing 2nd draw from p0 must be rejected — proves no double-draw of stack
    expect(() => drawCard(room, "p0")).toThrow("Not your turn");
  });

  test("two sequential legit draws by the CURRENT player each draw once (no doubling)", () => {
    // 2-player edge: after p0 draws, turn -> p1, then back to p0. Each is single.
    const room = makeRoom([[redCard], [redCard]]);
    const d1 = drawCard(room, "p0"); // p0 draws 1, turn -> p1
    expect(d1.length).toBe(1);
    const d2 = drawCard(room, "p1"); // p1 draws 1, turn -> p0
    expect(d2.length).toBe(1);
    expect(room.pendingDraws).toBe(0);
  });
});

describe("pendingDraws accumulation under stacking (sanity)", () => {
  test("two +cards stack pendingDraws additively across turns", () => {
    const plus2: Card = { type: "plus2", color: "red" };
    // Give each stacker a spare card so playing +2 isn't their last card
    // (last-card +2 triggers win and skips turn advance).
    const room = makeRoom([[plus2, redCard], [plus2, redCard], [redCard, redCard]]);
    playCard(room, "p0", 0);            // +2 -> pendingDraws 2, turn p1
    expect(room.pendingDraws).toBe(2);
    playCard(room, "p1", 0);            // +2 stacks -> pendingDraws 4, turn p2
    expect(room.pendingDraws).toBe(4);
    const drawn = drawCard(room, "p2"); // p2 forced to draw 4
    expect(drawn.length).toBe(4);
    expect(room.pendingDraws).toBe(0);
  });
});
