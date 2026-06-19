import { test, expect } from '@playwright/test';
import {
  createRoom,
  joinRoom,
  startGame,
  waitForGameReady,
} from './helpers/game-flow';

// This test requires the server to be started with RIG_GODMODE=1 so that the
// host is dealt a red God Mode card on a matching red discard.
test.skip(!process.env.RIG_GODMODE, 'Requires RIG_GODMODE env var');

test('God Mode power picker opens and a power resolves', async ({ browser }) => {
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const context3 = await browser.newContext();

  try {
    // Set up a 3-player game.
    const host = await createRoom(context1, 'Host', '😎');
    const player2 = await joinRoom(context2, host.roomCode, 'Player 2', '🔥');
    const player3 = await joinRoom(context3, host.roomCode, 'Player 3', '👻');

    await startGame(host.page);
    await player2.page.waitForURL(/\/game\.html/);
    await player3.page.waitForURL(/\/game\.html/);

    await waitForGameReady(host.page);
    await waitForGameReady(player2.page);
    await waitForGameReady(player3.page);

    // The host has a rigged red God Mode card (⚡ glyph).
    await host.page.getByText('⚡', { exact: false }).first().click();

    // The power picker should appear.
    await expect(host.page.locator('#godPowerPicker')).toBeVisible();

    // Choose All-Seeing Eye.
    await host.page.locator('.god-power-btn[data-power="allSeeingEye"]').click();

    // Picker closes, effect toast appears, no error toast is shown, and hands are revealed.
    await expect(host.page.locator('#godPowerPicker')).toBeHidden();
    await expect(host.page.getByText('All-Seeing Eye')).toBeVisible();
    await expect(host.page.locator('.toast.error')).toHaveCount(0);
    await expect(host.page.locator('.opponent-revealed-hand .mini-card').first()).toBeVisible();
  } finally {
    await context1.close();
    await context2.close();
    await context3.close();
  }
});
