import { test, expect } from '@playwright/test';
import { createRoom, joinRoom, startGame, waitForGameReady, isMyTurn } from './helpers/game-flow';

/**
 * Game Setup tests - Full 3-player flow
 *
 * Foundation test for other specs. Verifies the complete flow:
 * - Host creates room
 * - 2 players join
 * - Host starts game
 * - All players land on game.html with cards dealt
 */

test.describe('Game Setup - 3-Player Flow', () => {
  test('should complete full 3-player create/join/start flow', async ({ browser }) => {
    // Create 3 independent browser contexts (simulate 3 different devices)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    try {
      // Player 1 creates room
      const host = await createRoom(context1, 'Host Player', '😎');
      expect(host.roomCode).toMatch(/^[A-Z]{4}$/);
      expect(host.playerId).toBeTruthy();

      // Player 2 joins
      const player2 = await joinRoom(context2, host.roomCode, 'Player Two', '🔥');
      expect(player2.playerId).toBeTruthy();
      expect(player2.playerId).not.toBe(host.playerId);

      // Player 3 joins
      const player3 = await joinRoom(context3, host.roomCode, 'Player Three', '👻');
      expect(player3.playerId).toBeTruthy();
      expect(player3.playerId).not.toBe(host.playerId);
      expect(player3.playerId).not.toBe(player2.playerId);

      // Verify all players see 3 players in lobby
      for (const player of [host, player2, player3]) {
        const count = await player.page.textContent('#playerCount');
        expect(count).toBe('3');
      }

      // Start game (from host's page)
      await startGame(host.page);

      // Wait for all players to navigate to game page
      await player2.page.waitForURL(/\/game\.html\?room=.*&player=.*/);
      await player3.page.waitForURL(/\/game\.html\?room=.*&player=.*/);

      // Wait for game to be ready for all players
      await waitForGameReady(host.page);
      await waitForGameReady(player2.page);
      await waitForGameReady(player3.page);

      // Verify each player has 7 cards
      for (const player of [host, player2, player3]) {
        const cardCount = await player.page.textContent('#cardCount');
        expect(parseInt(cardCount || '0')).toBe(7);

        // Verify cards are visible
        const cards = await player.page.$$('#handCards .card');
        expect(cards.length).toBe(7);
      }

      // Verify exactly one player has the turn
      const hostTurn = await isMyTurn(host.page);
      const player2Turn = await isMyTurn(player2.page);
      const player3Turn = await isMyTurn(player3.page);

      const turnCount = [hostTurn, player2Turn, player3Turn].filter(Boolean).length;
      expect(turnCount).toBe(1);

      // Verify top card is visible
      const topCard = await host.page.$('#topCard .card-value');
      expect(topCard).not.toBeNull();

    } finally {
      // Clean up contexts
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });

  test('should not allow starting game with fewer than 3 players', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    try {
      // Player 1 creates room
      const host = await createRoom(context1, 'Host', '😎');

      // Initially, start button should be hidden (only 1 player)
      let startBtn = await host.page.$('#startGameBtn:not(.hidden)');
      expect(startBtn).toBeNull();

      // Player 2 joins
      await joinRoom(context2, host.roomCode, 'Player Two', '🔥');

      // Wait for player list update
      await host.page.waitForTimeout(500);

      // With 2 players, start button should still be hidden
      startBtn = await host.page.$('#startGameBtn:not(.hidden)');
      expect(startBtn).toBeNull();

      // Waiting message should show
      const waitingMsg = await host.page.textContent('#waitingMessage');
      expect(waitingMsg).toContain('Need 1 more player');

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should allow non-host players to see waiting message', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    try {
      // Create room with 3 players
      const host = await createRoom(context1, 'Host', '😎');
      const player2 = await joinRoom(context2, host.roomCode, 'Player Two', '🔥');
      const player3 = await joinRoom(context3, host.roomCode, 'Player Three', '👻');

      // Wait for updates
      await player2.page.waitForTimeout(500);

      // Host should see Start Game button
      const hostStartBtn = await host.page.$('#startGameBtn:not(.hidden)');
      expect(hostStartBtn).not.toBeNull();

      // Non-host players should see waiting message
      const player2WaitingMsg = await player2.page.$('#waitingMessage:not(.hidden)');
      expect(player2WaitingMsg).not.toBeNull();

      const player3WaitingMsg = await player3.page.$('#waitingMessage:not(.hidden)');
      expect(player3WaitingMsg).not.toBeNull();

      // Non-host players should NOT see start button
      const player2StartBtn = await player2.page.$('#startGameBtn:not(.hidden)');
      expect(player2StartBtn).toBeNull();

    } finally {
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });
});
