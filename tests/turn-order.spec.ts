import { test, expect } from "@playwright/test";
import {
  createRoom,
  joinRoom,
  startGame,
  waitForGameReady,
} from "./helpers/game-flow";

// Players join in order Alice (host) -> Bob -> Cara, so the server's stable
// rotation order is [Alice, Bob, Cara]. On Alice's board the opponents, seated
// in rotation order starting after her, must be Bob then Cara.
async function expectSeatingFromAlice(viewport: { width: number; height: number }) {
  return async ({ browser }: { browser: import("@playwright/test").Browser }) => {
    const ctxA = await browser.newContext({ viewport });
    const ctxB = await browser.newContext({ viewport });
    const ctxC = await browser.newContext({ viewport });
    try {
      const alice = await createRoom(ctxA, "Alice", "😎");
      await joinRoom(ctxB, alice.roomCode, "Bob", "🔥");
      await joinRoom(ctxC, alice.roomCode, "Cara", "👻");
      await startGame(alice.page);
      await waitForGameReady(alice.page);

      const names = await alice.page
        .locator("#opponentsList .opponent-node .opponent-name")
        .allTextContents();
      expect(names).toEqual(["Bob", "Cara"]);

      // At most one current-turn marker on opponents (0 if it's Alice's turn, 1 if
      // an opponent is current); at most one next-turn marker.
      const currentCount = await alice.page
        .locator("#opponentsList .opponent-node.current-turn")
        .count();
      expect(currentCount).toBeLessThanOrEqual(1);
      const nextCount = await alice.page
        .locator("#opponentsList .opponent-node.next-turn")
        .count();
      expect(nextCount).toBeLessThanOrEqual(1);
    } finally {
      await ctxA.close();
      await ctxB.close();
      await ctxC.close();
    }
  };
}

test.describe("turn order clarity", () => {
  test(
    "opponents seat in rotation order on mobile",
    async ({ browser }) => (await expectSeatingFromAlice({ width: 390, height: 844 }))({ browser })
  );

  test(
    "opponents seat in rotation order on desktop",
    async ({ browser }) => (await expectSeatingFromAlice({ width: 1280, height: 800 }))({ browser })
  );
});
