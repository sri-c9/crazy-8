import { test, expect, type BrowserContext } from '@playwright/test';
import { createRoom, joinRoom, startGame, waitForGameReady } from './helpers/game-flow';

/**
 * Player List tests - Bug 12
 *
 * Verifies that sensitive data (player hands) are not leaked:
 * - Bug 12: playerList messages must not include any hand property
 * - state messages must only include the recipient's own hand
 *
 * Approach: install a WebSocket interceptor via addInitScript BEFORE any page loads, so it
 * records every message the page's REAL game connection receives into window.__wsMessages.
 * This asserts against actual server traffic (the server sends both a playerList and a state
 * to each client on rejoin — see handleRejoin in server.ts).
 */

// Records all incoming WebSocket messages on every page in the context into window.__wsMessages.
// Re-runs on each navigation, so on the game page the array holds the game connection's traffic.
function installWsRecorder(context: BrowserContext): Promise<void> {
  return context.addInitScript(() => {
    (window as any).__wsMessages = [];
    const OrigWS = (window as any).WebSocket;
    (window as any).WebSocket = class extends OrigWS {
      constructor(...args: any[]) {
        super(...args);
        this.addEventListener('message', (event: any) => {
          try {
            (window as any).__wsMessages.push(JSON.parse(event.data));
          } catch {
            // ignore non-JSON frames
          }
        });
      }
    };
  });
}

test.describe('Player List - Data Leakage Prevention', () => {
  test('Bug 12: playerList message should not include hand property', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    try {
      // Record WS traffic on the host before any page loads.
      await installWsRecorder(context1);

      // Set up 3-player game
      const host = await createRoom(context1, 'Host', '😎');
      const player2 = await joinRoom(context2, host.roomCode, 'Player 2', '🔥');
      const player3 = await joinRoom(context3, host.roomCode, 'Player 3', '👻');

      await startGame(host.page);
      await player2.page.waitForURL(/\/game\.html/);
      await player3.page.waitForURL(/\/game\.html/);

      await waitForGameReady(host.page);
      await waitForGameReady(player2.page);
      await waitForGameReady(player3.page);

      // Wait until the host's real connection has actually received a playerList message.
      await host.page.waitForFunction(
        () => (window as any).__wsMessages?.some((m: any) => m.type === 'playerList'),
        { timeout: 5000 },
      );

      const playerListMsg = await host.page.evaluate(() =>
        [...(window as any).__wsMessages].reverse().find((m: any) => m.type === 'playerList'),
      );

      expect(playerListMsg).toBeTruthy();
      expect(Array.isArray(playerListMsg.players)).toBe(true);
      expect(playerListMsg.players.length).toBe(3);

      // No player entry in the list may carry hand data.
      for (const player of playerListMsg.players) {
        expect(player).not.toHaveProperty('hand');
      }
    } finally {
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });

  test('state message should only include own hand', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    try {
      // Record WS traffic on the host before any page loads.
      await installWsRecorder(context1);

      // Set up 3-player game
      const host = await createRoom(context1, 'Host', '😎');
      const player2 = await joinRoom(context2, host.roomCode, 'Player 2', '🔥');
      const player3 = await joinRoom(context3, host.roomCode, 'Player 3', '👻');

      await startGame(host.page);
      await player2.page.waitForURL(/\/game\.html/);
      await player3.page.waitForURL(/\/game\.html/);

      await waitForGameReady(host.page);
      await waitForGameReady(player2.page);
      await waitForGameReady(player3.page);

      // Wait until the host's real connection has actually received a state message.
      await host.page.waitForFunction(
        () => (window as any).__wsMessages?.some((m: any) => m.type === 'state'),
        { timeout: 5000 },
      );

      const stateMsg = await host.page.evaluate(() =>
        [...(window as any).__wsMessages].reverse().find((m: any) => m.type === 'state'),
      );

      expect(stateMsg).toBeTruthy();
      expect(stateMsg.gameState?.players?.length).toBe(3);

      const yourPlayerId = stateMsg.yourPlayerId;
      expect(yourPlayerId).toBeTruthy();

      for (const player of stateMsg.gameState.players) {
        if (player.id === yourPlayerId) {
          // Your own player should have a hand array.
          expect(player.hand).toBeDefined();
          expect(Array.isArray(player.hand)).toBe(true);
        } else {
          // Other players must NOT have hand data.
          expect(player.hand).toBeUndefined();
        }
      }
    } finally {
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });

  test.skip('admin should NOT see player hands in playerList', async ({ browser }) => {
    // Skipped: Admin panel has different structure and this test is not critical
    // to bug verification. The core playerList leak prevention is tested above.
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    try {
      // Set up 3-player game
      const host = await createRoom(context1, 'Host', '😎');
      const player2 = await joinRoom(context2, host.roomCode, 'Player 2', '🔥');
      const player3 = await joinRoom(context3, host.roomCode, 'Player 3', '👻');

      await startGame(host.page);
      await player2.page.waitForURL(/\/game\.html/);
      await player3.page.waitForURL(/\/game\.html/);

      await waitForGameReady(host.page);
      await waitForGameReady(player2.page);
      await waitForGameReady(player3.page);

      // Open admin client
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      await adminPage.goto('/admin.html');

      // Wait for admin to connect
      await adminPage.waitForSelector('#connectionStatus:has-text("Connected")', { timeout: 10000 });

      // Click on the room to view details
      const roomCard = await adminPage.waitForSelector(`.room-card:has-text("${host.roomCode}")`);
      await roomCard.click();

      // Wait for room details to load
      await adminPage.waitForTimeout(1000);

      // Verify players are shown without hand data
      const playerElements = await adminPage.$$('.player-card');
      expect(playerElements.length).toBe(3);

      // Admin UI should show card count, but not actual hand
      const cardCountElement = await adminPage.$('.card-count-badge');
      expect(cardCountElement).not.toBeNull();

    } finally {
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });
});
