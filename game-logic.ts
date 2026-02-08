// Import types from room-manager
import type { Room, Player, GameStatus } from "./room-manager";

// Define card types
export type CardColor = "red" | "blue" | "green" | "yellow";

export interface NumberCard {
  type: "number";
  color: CardColor;
  value: number;
}

export interface WildCard {
  type: "wild";
  chosenColor: CardColor | null;
}

export interface Plus2Card {
  type: "plus2";
  color: CardColor;
}

export interface Plus4Card {
  type: "plus4";
}

export interface Plus20Card {
  type: "plus20";
}

export interface SkipCard {
  type: "skip";
  color: CardColor;
}

export interface ReverseCard {
  type: "reverse";
  color: CardColor;
}

export type Card =
  | NumberCard
  | WildCard
  | Plus2Card
  | Plus4Card
  | Plus20Card
  | SkipCard
  | ReverseCard;

const COLORS: CardColor[] = ["red", "blue", "green", "yellow"];
const NUMBER_VALUES: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 9];

// Helper to get random color
function randomColor(): CardColor {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// Helper to get random number value
function randomNumberValue(): number {
  return NUMBER_VALUES[Math.floor(Math.random() * NUMBER_VALUES.length)];
}

// Generate random card with proper distribution
export function generateCard(): Card {
  const rand = Math.random();

  // 60% number cards (0-7, 9)
  if (rand < 0.6) {
    return {
      type: "number",
      color: randomColor(),
      value: randomNumberValue(),
    };
  }
  // 10% wild (8)
  else if (rand < 0.7) {
    return {
      type: "wild",
      chosenColor: null,
    };
  }
  // 15% +2
  else if (rand < 0.85) {
    return {
      type: "plus2",
      color: randomColor(),
    };
  }
  // 5% +4
  else if (rand < 0.9) {
    return { type: "plus4" };
  }
  // 2% +20
  else if (rand < 0.92) {
    return { type: "plus20" };
  }
  // 4% skip
  else if (rand < 0.96) {
    return {
      type: "skip",
      color: randomColor(),
    };
  }
  // 4% reverse
  else {
    return {
      type: "reverse",
      color: randomColor(),
    };
  }
}

// Check if card can be played (Phase 2 - basic rules, Phase 3 will extend)
export function canPlayCard(
  card: Card,
  topCard: Card,
  room: Room
): boolean {
  // Phase 3: If pendingDraws > 0, only +cards can be played
  if (room.pendingDraws > 0) {
    return card.type === "plus2" || card.type === "plus4" || card.type === "plus20";
  }

  // Wild cards always playable
  if (card.type === "wild") {
    return true;
  }

  // Phase 3: +cards can stack on any +card (ignore color)
  if (
    (card.type === "plus2" || card.type === "plus4" || card.type === "plus20") &&
    (topCard.type === "plus2" || topCard.type === "plus4" || topCard.type === "plus20")
  ) {
    return true;
  }

  // Phase 3: Reverse limit - max 4 in a row
  if (card.type === "reverse" && room.reverseStackCount >= 4) {
    return false;
  }

  // Get target color to match
  const targetColor =
    topCard.type === "wild" && room.lastPlayedColor
      ? room.lastPlayedColor
      : "color" in topCard
        ? topCard.color
        : null;

  // Match color OR number
  if (card.type === "number" && topCard.type === "number") {
    return card.color === targetColor || card.value === topCard.value;
  }

  // Match color for special cards
  return "color" in card && card.color === targetColor;
}

// Start game - deal cards, set initial state
export function startGame(room: Room): void {
  // Validate
  if (room.players.size < 3) {
    throw new Error("Need at least 3 players to start");
  }

  if (room.gameStatus !== "waiting") {
    throw new Error("Game already started");
  }

  // Deal 7 cards to each player
  for (const player of room.players.values()) {
    player.hand = [];
    for (let i = 0; i < 7; i++) {
      player.hand.push(generateCard());
    }
  }

  // Generate initial discard pile card (can't be plus card to avoid starting with penalty)
  let initialCard: Card;
  do {
    initialCard = generateCard();
  } while (
    initialCard.type === "plus2" ||
    initialCard.type === "plus4" ||
    initialCard.type === "plus20"
  );

  // Initialize game state
  room.discardPile = [initialCard];
  room.currentPlayerIndex = 0;
  room.direction = 1;
  room.pendingDraws = 0;
  room.reverseStackCount = 0;

  if (initialCard.type === "wild") {
    room.lastPlayedColor = randomColor(); // Random color for initial wild
  } else if ("color" in initialCard) {
    room.lastPlayedColor = initialCard.color;
  } else {
    room.lastPlayedColor = null;
  }

  room.gameStatus = "playing";
}

// Get current player ID
export function getCurrentPlayer(room: Room): string {
  const playerArray = Array.from(room.players.keys());
  return playerArray[room.currentPlayerIndex];
}

// Get top card from discard pile
export function getTopCard(room: Room): Card {
  return room.discardPile[room.discardPile.length - 1];
}

// Advance turn (respects direction)
export function advanceTurn(room: Room): void {
  const playerArray = Array.from(room.players.keys());
  const count = playerArray.length;

  if (room.direction === 1) {
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % count;
  } else {
    room.currentPlayerIndex = (room.currentPlayerIndex - 1 + count) % count;
  }
}

// Play a card
export function playCard(
  room: Room,
  playerId: string,
  cardIndex: number,
  chosenColor?: CardColor
): void {
  // Validate it's player's turn
  const currentPlayer = getCurrentPlayer(room);
  if (currentPlayer !== playerId) {
    throw new Error("Not your turn");
  }

  const player = room.players.get(playerId);
  if (!player) {
    throw new Error("Player not found");
  }

  if (cardIndex < 0 || cardIndex >= player.hand.length) {
    throw new Error("Invalid card index");
  }

  const card = player.hand[cardIndex];
  const topCard = getTopCard(room);

  // Validate card can be played
  if (!canPlayCard(card, topCard, room)) {
    throw new Error("Cannot play this card");
  }

  // Remove card from hand
  player.hand.splice(cardIndex, 1);

  // Add to discard pile
  room.discardPile.push(card);

  // Handle special card effects (Phase 3)

  // Plus cards: accumulate draws
  if (card.type === "plus2") {
    room.pendingDraws += 2;
  } else if (card.type === "plus4") {
    room.pendingDraws += 4;
  } else if (card.type === "plus20") {
    room.pendingDraws += 20;
  }

  // Skip: advance by 3 instead of 1 (skips next 2 players)
  if (card.type === "skip") {
    const playerArray = Array.from(room.players.keys());
    const count = playerArray.length;
    room.currentPlayerIndex =
      (room.currentPlayerIndex + 3 * room.direction + count) % count;
    // Don't call advanceTurn() - already advanced
    return;
  }

  // Reverse: flip direction, increment counter
  if (card.type === "reverse") {
    room.direction = room.direction === 1 ? -1 : 1;
    room.reverseStackCount++;
  } else {
    // Reset reverse counter if non-reverse played
    room.reverseStackCount = 0;
  }

  // Wild card: set chosen color
  if (card.type === "wild" && chosenColor) {
    room.lastPlayedColor = chosenColor;
  } else if ("color" in card) {
    room.lastPlayedColor = card.color;
  }

  // Check win condition
  if (player.hand.length === 0) {
    room.gameStatus = "finished";
    return; // Don't advance turn if game over
  }

  // Advance turn
  advanceTurn(room);
}

// Draw card(s)
export function drawCard(room: Room, playerId: string): Card[] {
  const currentPlayer = getCurrentPlayer(room);
  if (currentPlayer !== playerId) {
    throw new Error("Not your turn");
  }

  const player = room.players.get(playerId);
  if (!player) {
    throw new Error("Player not found");
  }

  const drawnCards: Card[] = [];

  // Multi-draw if pendingDraws > 0 (Phase 3)
  if (room.pendingDraws > 0) {
    const count = room.pendingDraws;
    for (let i = 0; i < count; i++) {
      const card = generateCard();
      player.hand.push(card);
      drawnCards.push(card);
    }
    room.pendingDraws = 0; // Reset after drawing
  } else {
    // Normal single draw
    const card = generateCard();
    player.hand.push(card);
    drawnCards.push(card);
  }

  // Advance turn after drawing
  advanceTurn(room);

  return drawnCards;
}

// Check win condition
export function checkWinCondition(room: Room): string | null {
  for (const [playerId, player] of room.players) {
    if (player.hand.length === 0) {
      room.gameStatus = "finished";
      return playerId;
    }
  }
  return null;
}
