import { test, expect } from '@playwright/test';
import {
  createRoom,
  joinRoom,
  startGame,
  waitForGameReady,
  findCurrentPlayer,
  getRoomCode,
  getPlayerId,
} from './helpers/game-flow';

/**
 * Disconnect tests - Bugs 4/5, 11
 *
 * Verifies disconnect handling:
 * - Bug 4/5: Game auto-advances turn on disconnect
 * - Bug 11: Rejoin after disconnect works correctly
 */

test.describe('Disconnect Handling', () => {
  test('Bug 4/5: game should auto-advance turn when current player disconnects', async ({ browser }) => {
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

      const players = [host, player2, player3];

      // Find whose turn it is
      const currentPlayer = await findCurrentPlayer(players);
      expect(currentPlayer).not.toBeNull();

      if (!currentPlayer) return;

      // Get the remaining players
      const remainingPlayers = players.filter(p => p.playerId !== currentPlayer.playerId);

      // Close the current player's page (simulates disconnect)
      await currentPlayer.page.close();

      // Wait for disconnect to be processed
      await remainingPlayers[0].page.waitForTimeout(1500);

      // One of the remaining players should now have the turn
      const hasPlayer1Turn = await remainingPlayers[0].page.$('.hand-area.your-turn');
      const hasPlayer2Turn = await remainingPlayers[1].page.$('.hand-area.your-turn');

      const turnAdvanced = hasPlayer1Turn !== null || hasPlayer2Turn !== null;
      expect(turnAdvanced).toBe(true);

      // Verify disconnected opponent is marked as disconnected
      const disconnectedOpponent = await remainingPlayers[0].page.$('.opponent-node.disconnected');
      expect(disconnectedOpponent).not.toBeNull();

    } finally {
      // Clean up remaining contexts
      await context1.close().catch(() => {});
      await context2.close().catch(() => {});
      await context3.close().catch(() => {});
    }
  });

  test('Bug 11: rejoin after disconnect should work', async ({ browser }) => {
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

      // Get player2's info before disconnect
      const roomCode = await getRoomCode(player2.page);
      const playerId = player2.playerId;

      // Close player2's page (disconnect)
      await player2.page.close();

      // Wait for disconnect to be processed
      await host.page.waitForTimeout(500);

      // Rejoin with a new page in the same context
      const newPage = await context2.newPage();
      await newPage.goto(`/game.html?room=${roomCode}&player=${playerId}`);

      // Wait for game to be ready
      await waitForGameReady(newPage);

      // Verify cards are visible
      const cards = await newPage.$$('#handCards .card');
      expect(cards.length).toBeGreaterThan(0);

      // Verify card count is displayed
      const cardCountText = await newPage.textContent('#cardCount');
      const cardCount = parseInt(cardCountText || '0');
      expect(cardCount).toBeGreaterThan(0);

      // Verify the opponent nodes are visible
      const opponentNodes = await newPage.$$('.opponent-node');
      expect(opponentNodes.length).toBe(2); // Should see 2 opponents

    } finally {
      await context1.close().catch(() => {});
      await context2.close().catch(() => {});
      await context3.close().catch(() => {});
    }
  });

  test('should mark disconnected player as disconnected in lobby', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    try {
      // Create room with 3 players (but don't start game)
      const host = await createRoom(context1, 'Host', '😎');
      const player2 = await joinRoom(context2, host.roomCode, 'Player 2', '🔥');
      const player3 = await joinRoom(context3, host.roomCode, 'Player 3', '👻');

      // Wait for all players to appear
      await host.page.waitForTimeout(500);

      // Close player2's connection
      await player2.page.close();

      // Wait for disconnect to propagate
      await host.page.waitForTimeout(1000);

      // Host should see player2 as disconnected
      const disconnectedPlayer = await host.page.$('.player-row.disconnected');
      expect(disconnectedPlayer).not.toBeNull();

      // Should still show 3 players total
      const playerCount = await host.page.textContent('#playerCount');
      expect(playerCount).toBe('3');

    } finally {
      await context1.close().catch(() => {});
      await context2.close().catch(() => {});
      await context3.close().catch(() => {});
    }
  });
});
