import { BrowserContext, Page, expect } from '@playwright/test';

/**
 * Multi-player game flow helpers for Playwright tests.
 * All helpers extract state via DOM selectors and page.evaluate() to avoid
 * relying on module-scoped variables.
 */

export interface RoomInfo {
  page: Page;
  roomCode: string;
  playerId: string;
}

/**
 * Creates a new room and returns the host's page, room code, and player ID.
 */
export async function createRoom(
  context: BrowserContext,
  playerName: string,
  avatar: string = '😎'
): Promise<RoomInfo> {
  const page = await context.newPage();
  await page.goto('/');

  // Wait for WebSocket connection
  await page.waitForSelector('#connectionStatus:has-text("Connected")');

  // Select avatar
  await page.click(`button.avatar-btn[data-avatar="${avatar}"]`);

  // Fill name and create room
  await page.fill('#playerName', playerName);
  await page.click('#createBtn');

  // Wait for room code to appear
  await page.waitForSelector('#codeDisplay');
  const roomCode = await page.textContent('#codeDisplay');

  if (!roomCode || !/^[A-Z]{4}$/.test(roomCode)) {
    throw new Error(`Invalid room code: ${roomCode}`);
  }

  // Extract player ID from page global variable
  const playerId = await page.evaluate(() => {
    return (window as any).currentPlayerId;
  });

  if (!playerId) {
    throw new Error('Player ID not set after room creation');
  }

  return { page, roomCode, playerId };
}

/**
 * Joins an existing room and returns the player's page and player ID.
 */
export async function joinRoom(
  context: BrowserContext,
  roomCode: string,
  playerName: string,
  avatar: string = '🔥'
): Promise<RoomInfo> {
  const page = await context.newPage();
  await page.goto('/');

  // Wait for WebSocket connection
  await page.waitForSelector('#connectionStatus:has-text("Connected")');

  // Select avatar
  await page.click(`button.avatar-btn[data-avatar="${avatar}"]`);

  // Fill name and room code, then join
  await page.fill('#playerName', playerName);
  await page.fill('#joinCode', roomCode);
  await page.click('#joinBtn');

  // Wait for room section to appear
  await page.waitForSelector('#roomSection:not(.hidden)');

  // Verify room code matches
  const displayedCode = await page.textContent('#codeDisplay');
  if (displayedCode !== roomCode) {
    throw new Error(`Room code mismatch: expected ${roomCode}, got ${displayedCode}`);
  }

  // Extract player ID
  const playerId = await page.evaluate(() => {
    return (window as any).currentPlayerId;
  });

  if (!playerId) {
    throw new Error('Player ID not set after joining room');
  }

  return { page, roomCode, playerId };
}

/**
 * Starts the game from the host's page. Waits for navigation to game.html.
 */
export async function startGame(hostPage: Page): Promise<void> {
  // Click start game button
  await hostPage.click('#startGameBtn');

  // Wait for navigation to game page
  await hostPage.waitForURL(/\/game\.html\?room=.*&player=.*/);
}

/**
 * Waits for the game to be fully loaded and ready:
 * - Loading overlay is hidden
 * - Cards are rendered in hand
 */
export async function waitForGameReady(page: Page): Promise<void> {
  // Wait for loading overlay to be hidden (state: 'hidden' means not visible)
  await page.waitForSelector('#loadingOverlay', { state: 'hidden', timeout: 10000 });

  // Wait for hand cards to be rendered
  await page.waitForSelector('#handCards .card', { timeout: 5000 });

  // Additional wait for state to settle
  await page.waitForTimeout(500);
}

/**
 * Checks if it's currently this player's turn by looking at the hand-area class.
 */
export async function isMyTurn(page: Page): Promise<boolean> {
  const handArea = await page.$('.hand-area.your-turn');
  return handArea !== null;
}

/**
 * Finds which player's turn it is by checking each page.
 * Returns the page and player ID of the current player.
 */
export async function findCurrentPlayer(
  players: RoomInfo[]
): Promise<RoomInfo | null> {
  for (const player of players) {
    if (await isMyTurn(player.page)) {
      return player;
    }
  }
  return null;
}

/**
 * Plays the first playable card in the current player's hand.
 * If the card is a wild card, randomly selects a color.
 * Returns true if a card was played, false if no playable cards.
 */
export async function playFirstPlayableCard(page: Page): Promise<boolean> {
  // Find first playable card
  const playableCard = await page.$('#handCards .card.playable');

  if (!playableCard) {
    return false;
  }

  // Click the card
  await playableCard.click();

  // Check if color picker appeared (wild card)
  const colorPicker = await page.$('#colorPicker:not(.hidden)');
  if (colorPicker) {
    // Choose a random color
    const colors = ['red', 'blue', 'green', 'yellow'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    await page.click(`button.color-btn[data-color="${randomColor}"]`);
  }

  // Wait for the play to process
  await page.waitForTimeout(300);

  return true;
}

/**
 * Clicks the draw button to draw a card.
 */
export async function drawCard(page: Page): Promise<void> {
  await page.click('#drawBtn');
  await page.waitForTimeout(300);
}

/**
 * Gets the number of cards in the player's hand.
 */
export async function getHandSize(page: Page): Promise<number> {
  const countText = await page.textContent('#cardCount');
  return parseInt(countText || '0', 10);
}

/**
 * Gets the current room code from the game page.
 */
export async function getRoomCode(page: Page): Promise<string> {
  const url = new URL(page.url());
  return url.searchParams.get('room') || '';
}

/**
 * Gets the current player ID from the game page.
 */
export async function getPlayerId(page: Page): Promise<string> {
  return await page.evaluate(() => {
    // Try game page first
    const gameState = (window as any).gameState;
    if (gameState && gameState.currentPlayerId) {
      return gameState.currentPlayerId;
    }
    // Fall back to lobby page
    return (window as any).currentPlayerId || '';
  });
}
