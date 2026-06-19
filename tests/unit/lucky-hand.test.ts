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
const luckyhand = (color: CardColor): Card => ({ type: "luckyhand", color });

describe("Lucky Hand", () => {
  test("playing it keeps the turn and sets luckyDrawPlayerId", () => {
    const room = makeRoom(3, { discardPile: [num("red", 5)] }, {
      p0: [luckyhand("red"), num("blue", 2)],
    });
    playCard(room, "p0", 0);
    expect(getCurrentPlayer(room)).toBe("p0"); // still p0's turn
    expect(room.luckyDrawPlayerId).toBe("p0");
  });

  test("a second play is rejected while the boost is pending", () => {
    const room = makeRoom(3, { discardPile: [num("red", 5)] }, {
      p0: [luckyhand("red"), num("red", 2)],
    });
    playCard(room, "p0", 0);
    expect(() => playCard(room, "p0", 0)).toThrow("You must draw after Lucky Hand");
  });

  test("drawing consumes the boost, clears the flag, and advances the turn", () => {
    const room = makeRoom(3, { discardPile: [num("red", 5)] }, {
      p0: [luckyhand("red")],
      // p0 has only Lucky Hand; after playing it the hand is empty -> see win test below.
    });
    // Give p0 a spare card so playing Lucky Hand does not win.
    room.players.get("p0")!.hand = [luckyhand("red"), num("blue", 9)];
    playCard(room, "p0", 0);
    const before = room.players.get("p0")!.hand.length;
    drawCard(room, "p0");
    expect(room.luckyDrawPlayerId).toBeNull();
    expect(room.players.get("p0")!.hand.length).toBe(before + 1);
    expect(getCurrentPlayer(room)).toBe("p1"); // turn advanced after the draw
  });

  test("Lucky Hand as the last card wins immediately (no boosted draw)", () => {
    const room = makeRoom(3, { discardPile: [num("red", 5)] }, { p0: [luckyhand("red")] });
    playCard(room, "p0", 0);
    expect(room.status).toBe(GameStatus.finished);
    expect(room.luckyDrawPlayerId).toBeNull();
  });
});
