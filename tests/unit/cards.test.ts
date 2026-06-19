import { test, expect, describe } from "bun:test";
import {
  generateCard,
  generateBoostedCard,
  CARD_DISTRIBUTION,
  type Card,
} from "../../cards";

describe("card distribution", () => {
  test("CARD_DISTRIBUTION weights sum to 1.0", () => {
    const sum = CARD_DISTRIBUTION.reduce((s, e) => s + e.weight, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.0001);
  });

  test("luckyhand and godmode are in the distribution", () => {
    const types = CARD_DISTRIBUTION.map((e) => e.type);
    expect(types).toContain("luckyhand");
    expect(types).toContain("godmode");
  });

  test("generateCard can produce the new colored cards", () => {
    // Generate many; just assert the generators produce well-formed cards.
    const lucky = CARD_DISTRIBUTION.find((e) => e.type === "luckyhand")!.generate();
    const god = CARD_DISTRIBUTION.find((e) => e.type === "godmode")!.generate();
    expect(lucky.type).toBe("luckyhand");
    expect(["red", "blue", "green", "yellow"]).toContain((lucky as any).color);
    expect(god.type).toBe("godmode");
    expect(["red", "blue", "green", "yellow"]).toContain((god as any).color);
  });
});

describe("generateBoostedCard", () => {
  test("yields a special card ~90% of the time", () => {
    const N = 20000;
    let special = 0;
    for (let i = 0; i < N; i++) {
      if (generateBoostedCard().type !== "number") special++;
    }
    const frac = special / N;
    expect(frac).toBeGreaterThan(0.86);
    expect(frac).toBeLessThan(0.94);
  });
});
