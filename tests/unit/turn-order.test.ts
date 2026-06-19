import { describe, test, expect } from "bun:test";
import { seatOpponents, getNextPlayerId } from "../../public/turn-order";

// Stable rotation order as the server sends it.
const P = (id: string) => ({ id });
const players = [P("a"), P("b"), P("c"), P("d")];

describe("getNextPlayerId", () => {
  test("forward direction advances by one", () => {
    expect(getNextPlayerId(players, "b", 1)).toBe("c");
  });

  test("reverse direction goes back by one", () => {
    expect(getNextPlayerId(players, "b", -1)).toBe("a");
  });

  test("forward wraps from the last seat to the first", () => {
    expect(getNextPlayerId(players, "d", 1)).toBe("a");
  });

  test("reverse wraps from the first seat to the last", () => {
    expect(getNextPlayerId(players, "a", -1)).toBe("d");
  });

  test("returns null when the current player is unknown", () => {
    expect(getNextPlayerId(players, "zzz", 1)).toBe(null);
  });
});

describe("seatOpponents", () => {
  test("orders opponents by rotation starting just after you", () => {
    // you = b (index 1) -> forward walk skipping you: c, d, a
    const seats = seatOpponents(players, "b", "c", 1);
    expect(seats.map((s) => s.player.id)).toEqual(["c", "d", "a"]);
  });

  test("excludes you from the seats", () => {
    const seats = seatOpponents(players, "b", "c", 1);
    expect(seats.some((s) => s.player.id === "b")).toBe(false);
  });

  test("seating is identical regardless of direction (stable seats)", () => {
    const fwd = seatOpponents(players, "b", "c", 1).map((s) => s.player.id);
    const rev = seatOpponents(players, "b", "c", -1).map((s) => s.player.id);
    expect(rev).toEqual(fwd);
  });

  test("flags the current player", () => {
    const seats = seatOpponents(players, "b", "c", 1);
    expect(seats.find((s) => s.isCurrent)?.player.id).toBe("c");
  });

  test("flags the next opponent using direction", () => {
    // current = c, forward -> next = d
    const seats = seatOpponents(players, "b", "c", 1);
    expect(seats.find((s) => s.isNext)?.player.id).toBe("d");
  });

  test("flags no opponent as next when you are the next player", () => {
    // you = c, current = b, forward -> next = c (you) -> no opponent flagged
    const seats = seatOpponents(players, "c", "b", 1);
    expect(seats.some((s) => s.isNext)).toBe(false);
  });

  test("wraps the next flag around the end of the array", () => {
    // you = c, current = d, forward -> next = a
    const seats = seatOpponents(players, "c", "d", 1);
    expect(seats.find((s) => s.isNext)?.player.id).toBe("a");
  });
});
