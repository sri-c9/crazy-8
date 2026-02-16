import { test, expect } from '@playwright/test';

/**
 * Lobby tests - Bug 10 (JSON.parse safety)
 *
 * Verifies that the lobby handles WebSocket messages safely and
 * doesn't crash on malformed data.
 */

test.describe('Lobby - WebSocket Connection and Safety', () => {
  test('should connect to WebSocket and show Connected status', async ({ page }) => {
    await page.goto('/');

    // Wait for connection status to show "Connected"
    await page.waitForSelector('#connectionStatus:has-text("Connected")', { timeout: 10000 });

    // Verify status dot has connected class
    const statusDot = await page.$('#statusDot.connected');
    expect(statusDot).not.toBeNull();
  });

  test('should create room and display valid room code', async ({ page }) => {
    await page.goto('/');

    // Wait for connection
    await page.waitForSelector('#connectionStatus:has-text("Connected")');

    // Fill in player name
    await page.fill('#playerName', 'Test Player');

    // Click create button
    await page.click('#createBtn');

    // Wait for room code to appear
    await page.waitForSelector('#codeDisplay');
    const roomCode = await page.textContent('#codeDisplay');

    // Room code should be 4 uppercase letters
    expect(roomCode).toMatch(/^[A-Z]{4}$/);

    // Room section should be visible
    const roomSection = await page.$('#roomSection:not(.hidden)');
    expect(roomSection).not.toBeNull();

    // Player list should show 1 player
    const playerCount = await page.textContent('#playerCount');
    expect(playerCount).toBe('1');
  });

  test('should not crash when receiving invalid WebSocket message', async ({ page }) => {
    await page.goto('/');

    // Wait for connection
    await page.waitForSelector('#connectionStatus:has-text("Connected")');

    // Send malformed data through WebSocket
    await page.evaluate(() => {
      const ws = (window as any).ws;
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Send raw string instead of JSON
        ws.send('this is not json');
      }
    });

    // Wait a moment for the message to be processed
    await page.waitForTimeout(1000);

    // Page should still be functional - check that connection status is still visible
    const statusEl = await page.$('#connectionStatus');
    expect(statusEl).not.toBeNull();

    // Verify we can still interact with the page
    await page.fill('#playerName', 'Test');
    const inputValue = await page.inputValue('#playerName');
    expect(inputValue).toBe('Test');
  });

  test('should handle missing fields in JSON messages gracefully', async ({ page }) => {
    await page.goto('/');

    // Wait for connection
    await page.waitForSelector('#connectionStatus:has-text("Connected")');

    // Send valid JSON but with unexpected structure
    await page.evaluate(() => {
      const ws = (window as any).ws;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unknown', data: null }));
      }
    });

    // Wait for processing
    await page.waitForTimeout(500);

    // Page should still work
    const statusEl = await page.$('#connectionStatus');
    expect(statusEl).not.toBeNull();
  });
});
