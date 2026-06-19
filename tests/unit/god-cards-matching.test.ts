import { test, expect, describe } from "bun:test";
import { canPlayCard, startGame, type Card, type CardColor } from "../../game-logic";
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
    discardPile: [], pendingDraws: 0, reverseStackCount: 0, lastPlayedColor: null,
    luckyDrawPlayerId: null, revealHandsOwnerId: null, ...opts,
  };
}

const num = (color: CardColor, value: number): Card => ({ type: "number", color, value });
const luckyhand = (color: CardColor): Card => ({ type: "luckyhand", color });
const godmode = (color: CardColor): Card => ({ type: "godmode", color });

describe("Lucky Hand / God Mode matching", () => {
  test("playable when its color matches the active color", () => {
    const room = makeRoom(3);
    const top = num("red", 5);
    expect(canPlayCard(luckyhand("red"), top, room)).toBe(true);
    expect(canPlayCard(godmode("red"), top, room)).toBe(true);
  });

  test("NOT playable on a mismatched color", () => {
    const room = makeRoom(3);
    const top = num("red", 5);
    expect(canPlayCard(luckyhand("blue"), top, room)).toBe(false);
    expect(canPlayCard(godmode("blue"), top, room)).toBe(false);
  });

  test("NOT type-matchable (blue Lucky Hand cannot follow a red Lucky Hand)", () => {
    const room = makeRoom(3, { lastPlayedColor: "red" });
    const top = luckyhand("red");
    expect(canPlayCard(luckyhand("blue"), top, room)).toBe(false);
    expect(canPlayCard(godmode("blue"), top, room)).toBe(false);
  });

  test("NOT playable while a +stack is pending", () => {
    const room = makeRoom(3, { pendingDraws: 2 });
    const top = { type: "plus2", color: "red" } as Card;
    expect(canPlayCard(luckyhand("red"), top, room)).toBe(false);
    expect(canPlayCard(godmode("red"), top, room)).toBe(false);
  });

  test("startGame never opens on luckyhand or godmode, and resets flags", () => {
    for (let i = 0; i < 200; i++) {
      const room = makeRoom(3, { status: GameStatus.waiting, luckyDrawPlayerId: "p0", revealHandsOwnerId: "p0" });
      startGame(room);
      expect(room.discardPile[0].type).not.toBe("luckyhand");
      expect(room.discardPile[0].type).not.toBe("godmode");
      expect(room.luckyDrawPlayerId).toBeNull();
      expect(room.revealHandsOwnerId).toBeNull();
    }
  });
});
