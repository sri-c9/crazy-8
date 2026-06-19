import { test, expect, describe } from "bun:test";
import { playCard, drawCard, getCurrentPlayer, type Card, type CardColor } from "../../game-logic";
import { GameStatus, type Room, type Player } from "../../room-manager";

function makePlayer(id: string, hand: Card[] = []): Player {
  return { id, sessionToken: "tok_" + id, name: id, avatar: "🐶", connected: true, hand };
}
function makeRoom(playerCount: number, opts: Partial<Room> = {}, hands: Record<string, Card[]> = {}): Room {
  const players = new Map<string, Player>();
  for (let i = 0; i < playerCount; i++) {
    const id = `p${i}`;
    players.set(id, makePlayer(id, hands[id] ?? []));
  }
  return {
    code: "ABCD", players, hostId: "p0", status: GameStatus.playing,
    createdAt: 0, lastActivityAt: 0, currentPlayerIndex: 0, direction: 1,
    discardPile: [], pendingDraws: 0, reverseStackCount: 0, lastPlayedColor: "red",
    luckyDrawPlayerId: null, revealHandsOwnerId: null, ...opts,
  };
}
const num = (color: CardColor, value: number): Card => ({ type: "number", color, value });
const godmode = (color: CardColor): Card => ({ type: "godmode", color });

// p0 plays God Mode; give every player a couple of spare cards.
function godModeRoom(power?: string) {
  const room = makeRoom(3, { discardPile: [num("red", 5)] }, {
    p0: [godmode("red"), num("blue", 1)],
    p1: [num("green", 2), num("yellow", 3), num("red", 4)],
    p2: [num("blue", 6)],
  });
  return room;
}

describe("God Mode", () => {
  test("missing power throws", () => {
    const room = godModeRoom();
    expect(() => playCard(room, "p0", 0)).toThrow("Must choose a God Mode power");
  });

  test("All-Seeing Eye sets the reveal owner and advances the turn", () => {
    const room = godModeRoom();
    playCard(room, "p0", 0, undefined, undefined, "allSeeingEye");
    expect(room.revealHandsOwnerId).toBe("p0");
    expect(getCurrentPlayer(room)).toBe("p1");
  });

  test("All-Seeing Eye clears at the start of the owner's next action (one lap)", () => {
    const room = godModeRoom();
    playCard(room, "p0", 0, undefined, undefined, "allSeeingEye"); // -> p1
    expect(room.revealHandsOwnerId).toBe("p0");
    drawCard(room, "p1"); // -> p2, reveal still active
    expect(room.revealHandsOwnerId).toBe("p0");
    drawCard(room, "p2"); // -> p0, reveal still active until p0 acts
    expect(room.revealHandsOwnerId).toBe("p0");
    drawCard(room, "p0"); // p0 acts again -> reveal cleared
    expect(room.revealHandsOwnerId).toBeNull();
  });

  test("Big Bang preserves total card count and each hand size", () => {
    const room = godModeRoom();
    const sizesBefore = ["p0", "p1", "p2"].map((id) => room.players.get(id)!.hand.length);
    // p0 will have one fewer after playing the God Mode card.
    playCard(room, "p0", 0, undefined, undefined, "bigBang");
    const sizesAfter = ["p0", "p1", "p2"].map((id) => room.players.get(id)!.hand.length);
    const totalBefore = sizesBefore.reduce((a, b) => a + b, 0) - 1; // minus the played card
    const totalAfter = sizesAfter.reduce((a, b) => a + b, 0);
    expect(totalAfter).toBe(totalBefore);
    // p0 had 2 -> 1 after play; p1 had 3; p2 had 1.
    expect(sizesAfter).toEqual([1, 3, 1]);
  });

  test("Reincarnation gives every player exactly 7 cards", () => {
    const room = godModeRoom();
    playCard(room, "p0", 0, undefined, undefined, "reincarnation");
    for (const id of ["p0", "p1", "p2"]) {
      expect(room.players.get(id)!.hand.length).toBe(7);
    }
  });

  test("All-Seeing Eye as the last card wins", () => {
    const room = makeRoom(3, { discardPile: [num("red", 5)] }, {
      p0: [godmode("red")], p1: [num("green", 2)], p2: [num("blue", 6)],
    });
    playCard(room, "p0", 0, undefined, undefined, "allSeeingEye");
    expect(room.status).toBe(GameStatus.finished);
  });

  test("Reincarnation as the last card does NOT win (reborn with 7)", () => {
    const room = makeRoom(3, { discardPile: [num("red", 5)] }, {
      p0: [godmode("red")], p1: [num("green", 2)], p2: [num("blue", 6)],
    });
    playCard(room, "p0", 0, undefined, undefined, "reincarnation");
    expect(room.status).toBe(GameStatus.playing);
    expect(room.players.get("p0")!.hand.length).toBe(7);
  });
});
