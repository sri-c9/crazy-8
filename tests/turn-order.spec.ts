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

      // If Alice is currently playing, her current-turn indicator is on the hand area,
      // not on an opponent node — so we expect 0. Otherwise exactly 1 opponent is current.
      const isAliceTurn = (await alice.page.locator(".hand-area.your-turn").count()) > 0;
      const expectedCurrentCount = isAliceTurn ? 0 : 1;
      const actualCurrentCount = await alice.page
        .locator("#opponentsList .opponent-node.current-turn")
        .count();
      expect(actualCurrentCount).toBe(expectedCurrentCount);
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
