import { test, expect, describe } from "bun:test";
import {
  generateCard,
  canPlayCard,
  startGame,
  getCurrentPlayer,
  getTopCard,
  advanceTurn,
  playCard,
  drawCard,
  checkWinCondition,
  type Card,
  type CardColor,
} from "../../game-logic";
import { GameStatus, type Room, type Player } from "../../room-manager";

// ---- Test helpers ---------------------------------------------------------

function makePlayer(id: string, hand: Card[] = []): Player {
  return {
    id,
    sessionToken: "tok_" + id,
    name: id,
    avatar: "🐶",
    connected: true,
    hand,
  };
}

/**
 * Build a Room with N players (p0, p1, ...) inserted in order so that
 * Array.from(players.keys()) == [p0, p1, ...].
 */
function makeRoom(
  playerCount: number,
  opts: Partial<Room> = {},
  hands: Record<string, Card[]> = {}
): Room {
  const players = new Map<string, Player>();
  for (let i = 0; i < playerCount; i++) {
    const id = `p${i}`;
    players.set(id, makePlayer(id, hands[id] ?? []));
  }
  const room: Room = {
    code: "ABCD",
    players,
    hostId: "p0",
    status: GameStatus.playing,
    createdAt: 0,
    lastActivityAt: 0,
    currentPlayerIndex: 0,
    direction: 1,
    discardPile: [],
    pendingDraws: 0,
    reverseStackCount: 0,
    lastPlayedColor: null,
    luckyDrawPlayerId: null,
    revealHandsOwnerId: null,
    ...opts,
  };
  return room;
}

const num = (color: CardColor, value: number): Card => ({ type: "number", color, value });
const plus2 = (color: CardColor): Card => ({ type: "plus2", color });
const plus4 = (): Card => ({ type: "plus4" });
const plus20 = (): Card => ({ type: "plus20" });
const plus20c = (color: CardColor): Card => ({ type: "plus20color", color });
const skip = (color: CardColor): Card => ({ type: "skip", color });
const reverse = (color: CardColor): Card => ({ type: "reverse", color });
const swap = (color: CardColor): Card => ({ type: "swap", color });
const nope = (color: CardColor): Card => ({ type: "nope", color });
const rotate = (color: CardColor): Card => ({ type: "rotate", color });
const steal = (color: CardColor): Card => ({ type: "steal", color });
const wild = (chosenColor: CardColor | null = null): Card => ({ type: "wild", chosenColor });
const pickswap = (color: CardColor): Card => ({ type: "pickswap", color });
const wildpickswap = (): Card => ({ type: "wildpickswap" });

// ---------------------------------------------------------------------------
// RULE 1: Cross-color plus-stacking
// ---------------------------------------------------------------------------
describe("Rule 1: plus-stacking by card value", () => {
  test("+cards equal or higher than top +card can deflect (color ignored)", () => {
    const room = makeRoom(3, { pendingDraws: 2 });
    const top = plus2("red");
    // equal or higher values can stack
    expect(canPlayCard(plus2("blue"), top, room)).toBe(true);
    expect(canPlayCard(plus4(), top, room)).toBe(true);
    expect(canPlayCard(plus20(), top, room)).toBe(true);
    expect(canPlayCard(plus20c("green"), top, room)).toBe(true);
  });

  test("lower-value +cards cannot stack on higher-value +cards", () => {
    const room = makeRoom(3, { pendingDraws: 20 });
    const top = plus20("red");
    // lower-value +cards cannot deflect a higher stack
    expect(canPlayCard(plus2("red"), top, room)).toBe(false);
    expect(canPlayCard(plus4(), top, room)).toBe(false);
    // equal or higher still allowed
    expect(canPlayCard(plus20(), top, room)).toBe(true);
    expect(canPlayCard(plus20c("green"), top, room)).toBe(true);
  });

  test("non-plus cards CANNOT be played when pendingDraws > 0", () => {
    const room = makeRoom(3, { pendingDraws: 2 });
    const top = plus2("red");
    expect(canPlayCard(num("red", 5), top, room)).toBe(false);
    expect(canPlayCard(skip("red"), top, room)).toBe(false);
    expect(canPlayCard(wild(), top, room)).toBe(false);
  });

  test("playCard accumulates pendingDraws across a stack", () => {
    const room = makeRoom(3, {
      pendingDraws: 2,
      discardPile: [plus2("red")],
    });
    room.players.get("p0")!.hand = [plus2("blue")];
    playCard(room, "p0", 0);
    expect(room.pendingDraws).toBe(4); // 2 + 2
  });
});

// ---------------------------------------------------------------------------
// RULE 2: 4-reverse stack limit
// ---------------------------------------------------------------------------
describe("Rule 2: 4-reverse stack limit", () => {
  test("reverse playable while reverseStackCount < 4", () => {
    const room = makeRoom(3, { reverseStackCount: 3, discardPile: [reverse("red")] });
    expect(canPlayCard(reverse("blue"), getTopCard(room), room)).toBe(true);
  });

  test("5th reverse (count==4) is rejected by canPlayCard", () => {
    const room = makeRoom(3, { reverseStackCount: 4, discardPile: [reverse("red")] });
    expect(canPlayCard(reverse("blue"), getTopCard(room), room)).toBe(false);
  });

  test("playCard throws when reverse stack limit hit", () => {
    const room = makeRoom(3, { reverseStackCount: 4, discardPile: [reverse("red")] });
    room.players.get("p0")!.hand = [reverse("blue")];
    expect(() => playCard(room, "p0", 0)).toThrow("Cannot play this card");
  });
});

// ---------------------------------------------------------------------------
// RULE 3: Skip behavior
// ---------------------------------------------------------------------------
describe("Rule 3: skip advances past the next player", () => {
  // BUG: spec says skip advances by 2 (skip the next player). Code at
  // game-logic.ts:351-352 advances by 3*direction. These tests assert the
  // ACTUAL (buggy) behavior so the suite documents it; see report.
  test("[ACTUAL] skip in 3-player game advances +3 -> wraps back to p0 (spec wanted p2)", () => {
    const room = makeRoom(3, {
      currentPlayerIndex: 0,
      direction: 1,
      discardPile: [skip("red")],
    });
    room.players.get("p0")!.hand = [skip("red"), num("red", 1)];
    playCard(room, "p0", 0);
    // SPEC wanted p2 (skip p1). ACTUAL: +3 wraps 0->0, skipper plays again.
    expect(getCurrentPlayer(room)).toBe("p0");
  });

  test("[ACTUAL] skip in 4-player game (dir=1) lands p3 not p2 (spec wanted p2)", () => {
    const room = makeRoom(4, {
      currentPlayerIndex: 0,
      direction: 1,
      discardPile: [skip("red")],
    });
    room.players.get("p0")!.hand = [skip("red"), num("red", 1)];
    playCard(room, "p0", 0);
    // SPEC wanted p2. ACTUAL: 0 + 3 = p3.
    expect(getCurrentPlayer(room)).toBe("p3");
  });

  test("[ACTUAL] skip respects direction = -1 (4 players): 0 + 3*-1 -> p1 (spec wanted p2)", () => {
    const room = makeRoom(4, {
      currentPlayerIndex: 0,
      direction: -1,
      discardPile: [skip("red")],
    });
    room.players.get("p0")!.hand = [skip("red"), num("red", 1)];
    playCard(room, "p0", 0);
    // SPEC wanted p2. ACTUAL: 0 + 3*-1 = -3 -> p1.
    expect(getCurrentPlayer(room)).toBe("p1");
  });
});

// ---------------------------------------------------------------------------
// RULE 4: Wild color enforcement
// ---------------------------------------------------------------------------
describe("Rule 4: wild color enforcement", () => {
  test("playing wild (8) without chosenColor throws", () => {
    const room = makeRoom(3, { discardPile: [num("red", 5)], lastPlayedColor: "red" });
    room.players.get("p0")!.hand = [wild()];
    expect(() => playCard(room, "p0", 0)).toThrow("Must choose a color");
  });

  test("playing wild with chosenColor sets lastPlayedColor", () => {
    const room = makeRoom(3, { discardPile: [num("red", 5)], lastPlayedColor: "red" });
    room.players.get("p0")!.hand = [wild(), num("red", 1)];
    playCard(room, "p0", 0, "green");
    expect(room.lastPlayedColor).toBe("green");
  });

  test("plus4 without chosenColor throws", () => {
    const room = makeRoom(3, { discardPile: [num("red", 5)], lastPlayedColor: "red" });
    room.players.get("p0")!.hand = [plus4()];
    expect(() => playCard(room, "p0", 0)).toThrow("Must choose a color");
  });

  test("playing plus4 without chosenColor is atomic: hand and discard unchanged", () => {
    // Verify the pre-mutation validation fix: required choices are validated
    // before removing the card or touching discard/pendingDraws.
    const room = makeRoom(3, { discardPile: [num("red", 5)], lastPlayedColor: "red" });
    room.players.get("p0")!.hand = [plus4(), num("red", 1)];
    expect(() => playCard(room, "p0", 0)).toThrow("Must choose a color");
    // No partial mutation after the validation throw:
    expect(room.players.get("p0")!.hand.length).toBe(2);
    expect(getTopCard(room).type).toBe("number");
    expect(room.pendingDraws).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// RULE 5: reverseStackCount reset on draw
// ---------------------------------------------------------------------------
describe("Rule 5: draw resets reverse + pending state", () => {
  test("drawCard resets reverseStackCount to 0", () => {
    const room = makeRoom(3, { reverseStackCount: 3 });
    drawCard(room, "p0");
    expect(room.reverseStackCount).toBe(0);
  });

  test("drawCard with pendingDraws draws N cards and resets pendingDraws", () => {
    const room = makeRoom(3, { pendingDraws: 4 });
    const drawn = drawCard(room, "p0");
    expect(drawn.length).toBe(4);
    expect(room.players.get("p0")!.hand.length).toBe(4);
    expect(room.pendingDraws).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// RULE 6: Swap behavior (report actual)
// ---------------------------------------------------------------------------
describe("Rule 6: swap behavior", () => {
  test("swap exchanges hands with the NEXT player by direction", () => {
    const room = makeRoom(3, {
      currentPlayerIndex: 0,
      direction: 1,
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [swap("red"), num("red", 1)]; // 2 cards after... will swap before removal? check
    room.players.get("p1")!.hand = [num("blue", 2), num("blue", 3), num("blue", 4)];
    // p0 hand after removing swap = [num red 1]; then swaps with p1
    playCard(room, "p0", 0);
    // p0 should now hold p1's 3 cards
    expect(room.players.get("p0")!.hand.length).toBe(3);
    expect(room.players.get("p1")!.hand.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// RULE 7: Win condition
// ---------------------------------------------------------------------------
describe("Rule 7: win condition", () => {
  test("checkWinCondition returns playerId with empty hand", () => {
    const room = makeRoom(3, {}, { p1: [] });
    room.players.get("p0")!.hand = [num("red", 1)];
    room.players.get("p2")!.hand = [num("red", 2)];
    expect(checkWinCondition(room)).toBe("p1");
    expect(room.status).toBe(GameStatus.finished);
  });

  test("checkWinCondition returns null when all hands non-empty", () => {
    const room = makeRoom(3);
    for (const p of room.players.values()) p.hand = [num("red", 1)];
    expect(checkWinCondition(room)).toBeNull();
  });

  test("playCard sets finished + does not advance turn on last card", () => {
    const room = makeRoom(3, { currentPlayerIndex: 0, discardPile: [num("red", 5)], lastPlayedColor: "red" });
    room.players.get("p0")!.hand = [num("red", 1)];
    playCard(room, "p0", 0);
    expect(room.status).toBe(GameStatus.finished);
    expect(room.currentPlayerIndex).toBe(0); // unchanged
  });
});

// ---------------------------------------------------------------------------
// RULE 8: infinite deck
// ---------------------------------------------------------------------------
describe("Rule 8: infinite-deck draw", () => {
  test("generateCard always returns a valid card type", () => {
    const valid = new Set([
      "number", "wild", "plus2", "plus4", "plus20", "plus20color",
      "skip", "reverse", "swap", "pickswap", "wildpickswap", "nope", "rotate", "steal",
      "luckyhand", "godmode",
    ]);
    for (let i = 0; i < 5000; i++) {
      const c = generateCard();
      expect(valid.has(c.type)).toBe(true);
      if (c.type === "number") {
        expect([0, 1, 2, 3, 4, 5, 6, 7, 9]).toContain(c.value);
        expect(c.value).not.toBe(8);
      }
    }
  });

  test("drawCard appends to hand without exhaustion (large repeated draws)", () => {
    const room = makeRoom(3);
    // single draws across many turns shouldn't throw / run out
    for (let i = 0; i < 50; i++) {
      const cur = getCurrentPlayer(room);
      const before = room.players.get(cur)!.hand.length;
      drawCard(room, cur);
      expect(room.players.get(cur)!.hand.length).toBe(before + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// RULE 9: advanceTurn direction + wrap-around
// ---------------------------------------------------------------------------
describe("Rule 9: advanceTurn direction & wrap", () => {
  test("dir=1 advances forward and wraps", () => {
    const room = makeRoom(3, { currentPlayerIndex: 2, direction: 1 });
    advanceTurn(room);
    expect(room.currentPlayerIndex).toBe(0);
  });

  test("dir=-1 advances backward and wraps", () => {
    const room = makeRoom(3, { currentPlayerIndex: 0, direction: -1 });
    advanceTurn(room);
    expect(room.currentPlayerIndex).toBe(2);
  });

  test("reverse flips direction and increments reverseStackCount", () => {
    const room = makeRoom(3, { currentPlayerIndex: 0, direction: 1, discardPile: [reverse("red")], lastPlayedColor: "red" });
    room.players.get("p0")!.hand = [reverse("red"), num("red", 1)];
    playCard(room, "p0", 0);
    expect(room.direction).toBe(-1);
    expect(room.reverseStackCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// RULE 10: Nope / Shield cancels +stacks
// ---------------------------------------------------------------------------
describe("Rule 10: Nope cancels pending +stack", () => {
  test("nope is playable while pendingDraws > 0", () => {
    const room = makeRoom(3, { pendingDraws: 20, discardPile: [plus20()] });
    expect(canPlayCard(nope("blue"), getTopCard(room), room)).toBe(true);
  });

  test("nope zeros pendingDraws", () => {
    const room = makeRoom(3, {
      pendingDraws: 20,
      discardPile: [plus20()],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [nope("red"), num("red", 1)];
    playCard(room, "p0", 0);
    expect(room.pendingDraws).toBe(0);
  });

  test("playing nope advances turn normally", () => {
    const room = makeRoom(3, {
      currentPlayerIndex: 0,
      direction: 1,
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [nope("red"), num("red", 1)];
    playCard(room, "p0", 0);
    expect(getCurrentPlayer(room)).toBe("p1");
  });

  test("nope is NOT playable as normal card without color/type match", () => {
    const room = makeRoom(3, {
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    expect(canPlayCard(nope("blue"), getTopCard(room), room)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RULE 11: Rotate Hands passes every hand one seat in current direction
// ---------------------------------------------------------------------------
describe("Rule 11: Rotate hands", () => {
  test("rotate passes hands clockwise when direction=1", () => {
    const room = makeRoom(4, {
      currentPlayerIndex: 0,
      direction: 1,
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [rotate("red")];
    room.players.get("p1")!.hand = [num("blue", 1)];
    room.players.get("p2")!.hand = [num("green", 2), num("green", 3)];
    room.players.get("p3")!.hand = [num("yellow", 4), num("yellow", 5), num("yellow", 6)];

    playCard(room, "p0", 0);

    // p0 receives p3's hand (3 cards)
    expect(room.players.get("p0")!.hand.length).toBe(3);
    // p1 receives p0's empty hand (rotate card was already removed)
    expect(room.players.get("p1")!.hand.length).toBe(0);
    // p2 receives p1's hand (1 card)
    expect(room.players.get("p2")!.hand.length).toBe(1);
    // p3 receives p2's hand (2 cards)
    expect(room.players.get("p3")!.hand.length).toBe(2);
  });

  test("rotate passes hands counter-clockwise when direction=-1", () => {
    const room = makeRoom(3, {
      currentPlayerIndex: 0,
      direction: -1,
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [rotate("red")];
    room.players.get("p1")!.hand = [num("blue", 1)];
    room.players.get("p2")!.hand = [num("green", 2), num("green", 3)];

    playCard(room, "p0", 0);

    // direction=-1: p[i] gets hand from p[i+1]
    // p0 gets p1's hand (1 card)
    expect(room.players.get("p0")!.hand.length).toBe(1);
    // p1 gets p2's hand (2 cards)
    expect(room.players.get("p1")!.hand.length).toBe(2);
    // p2 gets p0's empty hand
    expect(room.players.get("p2")!.hand.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// RULE 12: Steal takes one random card from next player
// ---------------------------------------------------------------------------
describe("Rule 12: Steal random card", () => {
  test("steal takes exactly one card from next player by direction", () => {
    const room = makeRoom(3, {
      currentPlayerIndex: 0,
      direction: 1,
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [steal("red")];
    room.players.get("p1")!.hand = [num("blue", 1), num("blue", 2), num("blue", 3)];

    playCard(room, "p0", 0);

    expect(room.players.get("p0")!.hand.length).toBe(1); // stolen card replaces the steal card
    expect(room.players.get("p1")!.hand.length).toBe(2);
  });

  test("steal target respects direction=-1", () => {
    const room = makeRoom(3, {
      currentPlayerIndex: 0,
      direction: -1,
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [steal("red")];
    room.players.get("p1")!.hand = [num("blue", 1)];
    room.players.get("p2")!.hand = [num("green", 2), num("green", 3)];

    playCard(room, "p0", 0);

    // direction=-1: next player is p2, not p1
    expect(room.players.get("p2")!.hand.length).toBe(1);
    expect(room.players.get("p1")!.hand.length).toBe(1);
  });

  test("stealing from player with empty hand is a no-op", () => {
    const room = makeRoom(3, {
      currentPlayerIndex: 0,
      direction: 1,
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [steal("red")];
    room.players.get("p1")!.hand = [];

    playCard(room, "p0", 0);

    expect(room.players.get("p0")!.hand.length).toBe(0);
    expect(room.players.get("p1")!.hand.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// RULE 13: generateCard produces new special cards
// ---------------------------------------------------------------------------
describe("Rule 13: generateCard distributions", () => {
  test("generateCard can produce nope, rotate, and steal", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      seen.add(generateCard().type);
      if (seen.has("nope") && seen.has("rotate") && seen.has("steal")) return;
    }
    throw new Error(`Expected nope/rotate/steal types but saw: ${Array.from(seen).join(", ")}`);
  });

  test("valid card types include new special cards", () => {
    const valid = new Set([
      "number", "wild", "plus2", "plus4", "plus20", "plus20color",
      "skip", "reverse", "swap", "pickswap", "wildpickswap", "nope", "rotate", "steal",
      "luckyhand", "godmode",
    ]);
    for (let i = 0; i < 5000; i++) {
      expect(valid.has(generateCard().type)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// startGame
// ---------------------------------------------------------------------------
describe("startGame", () => {
  test("deals 7 cards to each player and sets initial state", () => {
    const room = makeRoom(3, { status: GameStatus.waiting });
    startGame(room);
    for (const p of room.players.values()) expect(p.hand.length).toBe(7);
    expect(room.discardPile.length).toBe(1);
    expect(room.status).toBe(GameStatus.playing);
    expect(room.currentPlayerIndex).toBe(0);
    expect(room.direction).toBe(1);
    // initial card is never an action card
    const top = room.discardPile[0];
    expect([
      "plus2", "plus4", "plus20", "plus20color", "skip", "reverse",
      "swap", "pickswap", "wildpickswap", "nope", "rotate", "steal",
    ]).not.toContain(top.type);
  });

  test("throws with fewer than 3 players", () => {
    const room = makeRoom(2, { status: GameStatus.waiting });
    expect(() => startGame(room)).toThrow("at least 3 players");
  });
});

// ---------------------------------------------------------------------------
// RULE 14: Targeted swap cards
// ---------------------------------------------------------------------------
describe("Rule 14: targeted swap cards", () => {
  test("pickswap requires a target player ID", () => {
    const room = makeRoom(3, {
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [pickswap("red"), num("red", 1)];
    expect(() => playCard(room, "p0", 0)).toThrow("Must choose a player to swap with");
  });

  test("pickswap rejects targeting self", () => {
    const room = makeRoom(3, {
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [pickswap("red"), num("red", 1)];
    expect(() => playCard(room, "p0", 0, undefined, "p0")).toThrow("Cannot swap with yourself");
  });

  test("pickswap rejects targeting a missing player", () => {
    const room = makeRoom(3, {
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [pickswap("red"), num("red", 1)];
    expect(() => playCard(room, "p0", 0, undefined, "p99")).toThrow("Target player not found");
  });

  test("wildpickswap requires both a target and a chosen color", () => {
    // Color is validated before target for the wild-pickswap variant, so a
    // missing color throws first even when a target is supplied.
    const roomNoColor = makeRoom(3, {
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    roomNoColor.players.get("p0")!.hand = [wildpickswap(), num("red", 1)];
    expect(() => playCard(roomNoColor, "p0", 0, undefined, "p1")).toThrow("Must choose a color");

    const roomNoTarget = makeRoom(3, {
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    roomNoTarget.players.get("p0")!.hand = [wildpickswap(), num("red", 1)];
    expect(() => playCard(roomNoTarget, "p0", 0, "red")).toThrow("Must choose a player to swap with");

    // No state mutation when validation throws:
    expect(roomNoTarget.players.get("p0")!.hand.length).toBe(2);
    expect(getTopCard(roomNoTarget).type).toBe("number");
  });

  test("pickswap swaps hands with the chosen target", () => {
    const room = makeRoom(3, {
      currentPlayerIndex: 0,
      direction: 1,
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [pickswap("red"), num("red", 1)];
    room.players.get("p2")!.hand = [num("blue", 2), num("blue", 3), num("blue", 4)];
    playCard(room, "p0", 0, undefined, "p2");
    expect(room.players.get("p0")!.hand.length).toBe(3);
    expect(room.players.get("p2")!.hand.length).toBe(1);
    expect(getCurrentPlayer(room)).toBe("p1");
  });

  test("wildpickswap swaps hands with the chosen target and sets lastPlayedColor", () => {
    const room = makeRoom(3, {
      currentPlayerIndex: 0,
      direction: 1,
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    room.players.get("p0")!.hand = [wildpickswap(), num("red", 1)];
    room.players.get("p2")!.hand = [num("blue", 2)];
    playCard(room, "p0", 0, "green", "p2");
    expect(room.lastPlayedColor).toBe("green");
    expect(room.players.get("p0")!.hand.length).toBe(1);
    expect(room.players.get("p2")!.hand.length).toBe(1);
  });

  test("pickswap is not playable without a color/type match", () => {
    const room = makeRoom(3, {
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    expect(canPlayCard(pickswap("red"), num("red", 5), room)).toBe(true);
    expect(canPlayCard(pickswap("blue"), num("red", 5), room)).toBe(false);
    expect(canPlayCard(pickswap("blue"), pickswap("red"), room)).toBe(true);
  });

  test("wildpickswap is always playable regardless of top card", () => {
    const room = makeRoom(3, {
      discardPile: [num("red", 5)],
      lastPlayedColor: "red",
    });
    expect(canPlayCard(wildpickswap(), num("red", 5), room)).toBe(true);
    expect(canPlayCard(wildpickswap(), plus4(), room)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Turn-ownership guards
// ---------------------------------------------------------------------------
describe("turn ownership", () => {
  test("playCard throws if not your turn", () => {
    const room = makeRoom(3, { currentPlayerIndex: 0, discardPile: [num("red", 5)] });
    room.players.get("p1")!.hand = [num("red", 1)];
    expect(() => playCard(room, "p1", 0)).toThrow("Not your turn");
  });

  test("drawCard throws if not your turn", () => {
    const room = makeRoom(3, { currentPlayerIndex: 0 });
    expect(() => drawCard(room, "p1")).toThrow("Not your turn");
  });
});
