// Import types from room-manager
import { GameStatus, type Room, type Player } from "./room-manager";

import { type Card, type CardColor, type GodPower, generateCard, generateBoostedCard, randomColor } from "./cards";
export { type Card, type CardColor, type GodPower, generateCard, generateBoostedCard, randomColor };

// God Mode — Big Bang: pool every hand, shuffle, re-deal preserving hand sizes.
function bigBang(room: Room): void {
  const players = Array.from(room.players.values());
  const sizes = players.map((p) => p.hand.length);
  const pool: Card[] = [];
  for (const p of players) pool.push(...p.hand);
  // Fisher-Yates shuffle.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let idx = 0;
  players.forEach((p, k) => {
    p.hand = pool.slice(idx, idx + sizes[k]);
    idx += sizes[k];
  });
}

// God Mode — Reincarnation: incinerate every hand, deal everyone a fresh 7.
function reincarnation(room: Room): void {
  for (const p of room.players.values()) {
    p.hand = [];
    for (let i = 0; i < 7; i++) p.hand.push(generateCard());
  }
}

// Numeric value of a plus card, used for stacking rules.
// +2 < +4 < +20. Wild +20 and colored +20 share the same value.
function plusCardValue(card: Card): number | null {
  if (card.type === "plus2") return 2;
  if (card.type === "plus4") return 4;
  if (card.type === "plus20" || card.type === "plus20color") return 20;
  return null;
}

// Check if card can be played (Phase 2 - basic rules, Phase 3 will extend)
export function canPlayCard(
  card: Card,
  topCard: Card,
  room: Room
): boolean {
  // Phase 3: If pendingDraws > 0, only higher/equal +cards (or a Nope) can be played.
  // Examples: +20 can be stacked on +2, but +2 cannot be stacked on +20.
  if (room.pendingDraws > 0) {
    // Nope cancels the stack regardless of value.
    if (card.type === "nope") {
      return true;
    }

    const stackValue = plusCardValue(card);
    const topValue = plusCardValue(topCard);

    // Only +cards can be played, and only if their value is >= the top card's value.
    if (stackValue !== null && topValue !== null) {
      return stackValue >= topValue;
    }

    return false;
  }

  // Wild/swap cards always playable (wild, plus4, plus20, swap, wildpickswap have no color restrictions)
  if (card.type === "wild" || card.type === "plus4" || card.type === "plus20" || card.type === "swap" || card.type === "wildpickswap") {
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
        : room.lastPlayedColor;

  // Match color OR number
  if (card.type === "number" && topCard.type === "number") {
    return card.color === targetColor || card.value === topCard.value;
  }

  // Type-matching: same special card type can always be played regardless of color
  const typeMatchable = ["skip", "reverse", "plus2", "plus20color", "pickswap", "nope", "rotate", "steal"] as const;
  if (card.type === topCard.type && typeMatchable.includes(card.type as typeof typeMatchable[number])) {
    return true;
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

  if (room.status !== GameStatus.waiting) {
    throw new Error("Game already started");
  }

  // Deal 7 cards to each player
  for (const player of room.players.values()) {
    player.hand = [];
    for (let i = 0; i < 7; i++) {
      player.hand.push(generateCard());
    }
  }

  // Generate initial discard pile card (can't be plus/skip/reverse/swap to avoid starting with effects)
  let initialCard: Card;
  do {
    initialCard = generateCard();
  } while (
    initialCard.type === "plus2" ||
    initialCard.type === "plus4" ||
    initialCard.type === "plus20" ||
    initialCard.type === "plus20color" ||
    initialCard.type === "skip" ||
    initialCard.type === "reverse" ||
    initialCard.type === "swap" ||
    initialCard.type === "pickswap" ||
    initialCard.type === "wildpickswap" ||
    initialCard.type === "rotate" ||
    initialCard.type === "steal" ||
    initialCard.type === "luckyhand" ||
    initialCard.type === "godmode" ||
    initialCard.type === "nope"
  );

  // Initialize game state
  room.discardPile = [initialCard];
  room.currentPlayerIndex = 0;
  room.direction = 1;
  room.pendingDraws = 0;
  room.reverseStackCount = 0;
  room.luckyDrawPlayerId = null;
  room.revealHandsOwnerId = null;

  if (initialCard.type === "wild") {
    room.lastPlayedColor = randomColor(); // Random color for initial wild
  } else if ("color" in initialCard) {
    room.lastPlayedColor = initialCard.color;
  } else {
    room.lastPlayedColor = null;
  }

  // TEMP DEBUG RIG (env-gated) — deterministic God Mode / Lucky Hand scenario.
  if (process.env.RIG_GODMODE) {
    const first = Array.from(room.players.values())[0];
    first.hand = [
      { type: "godmode", color: "red" } as Card,
      { type: "luckyhand", color: "red" } as Card,
      { type: "number", color: "red", value: 5 } as Card,
    ];
    room.discardPile = [{ type: "number", color: "red", value: 2 } as Card];
    room.lastPlayedColor = "red";
  }

  room.status = GameStatus.playing;
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
  chosenColor?: CardColor,
  targetPlayerId?: string,
  godPower?: GodPower,
): void {
  // Validate it's player's turn
  const currentPlayer = getCurrentPlayer(room);
  if (currentPlayer !== playerId) {
    throw new Error("Not your turn");
  }

  // Lucky Hand: after playing it the turn stays put, but the only legal action
  // is the (boosted) draw — reject any further play until that draw happens.
  if (room.luckyDrawPlayerId === playerId) {
    throw new Error("You must draw after Lucky Hand");
  }

  // All-Seeing Eye lasts one lap: clear it when the owner takes their next action.
  if (room.revealHandsOwnerId === playerId) {
    room.revealHandsOwnerId = null;
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

  // Validate any required choices before mutating state so the function is atomic.
  if (card.type === "godmode") {
    if (
      !godPower ||
      (godPower !== "allSeeingEye" && godPower !== "bigBang" && godPower !== "reincarnation")
    ) {
      throw new Error("Must choose a God Mode power");
    }
  }
  if (
    (card.type === "wild" || card.type === "plus4" || card.type === "plus20" || card.type === "wildpickswap") &&
    !chosenColor
  ) {
    throw new Error("Must choose a color");
  }
  if (card.type === "pickswap" || card.type === "wildpickswap") {
    if (!targetPlayerId) {
      throw new Error("Must choose a player to swap with");
    }
    if (targetPlayerId === playerId) {
      throw new Error("Cannot swap with yourself");
    }
    if (!room.players.has(targetPlayerId)) {
      throw new Error("Target player not found");
    }
  }

  // Remove card from hand
  player.hand.splice(cardIndex, 1);

  // Add to discard pile (keep only top card to prevent unbounded growth)
  room.discardPile = [card];

  // Handle special card effects (Phase 3)

  // Plus cards: accumulate draws
  if (card.type === "plus2") {
    room.pendingDraws += 2;
  } else if (card.type === "plus4") {
    room.pendingDraws += 4;
  } else if (card.type === "plus20") {
    room.pendingDraws += 20;
  } else if (card.type === "plus20color") {
    room.pendingDraws += 20;
  }

  // Nope: cancel any pending +stack
  if (card.type === "nope") {
    room.pendingDraws = 0;
  }

  // Reverse: flip direction, increment counter
  if (card.type === "reverse") {
    room.direction = room.direction === 1 ? -1 : 1;
    room.reverseStackCount++;
  } else {
    // Reset reverse counter if non-reverse played
    room.reverseStackCount = 0;
  }

  // Targeted swap cards: exchange hands with chosen opponent
  if (card.type === "pickswap" || card.type === "wildpickswap") {
    const targetPlayer = room.players.get(targetPlayerId!);

    const tempHand = player.hand;
    player.hand = targetPlayer!.hand;
    targetPlayer!.hand = tempHand;
  }

  // Swap: exchange hands with next player
  if (card.type === "swap") {
    const playerArray = Array.from(room.players.keys());
    const count = playerArray.length;
    const nextPlayerIndex = (room.currentPlayerIndex + room.direction + count) % count;
    const nextPlayerId = playerArray[nextPlayerIndex];
    const nextPlayer = room.players.get(nextPlayerId);

    if (nextPlayer) {
      // Swap the hands
      const tempHand = player.hand;
      player.hand = nextPlayer.hand;
      nextPlayer.hand = tempHand;
    }
  }

  // Rotate: pass every hand one seat in the current direction
  if (card.type === "rotate") {
    const playerValues = Array.from(room.players.values());
    const count = playerValues.length;
    const oldHands = playerValues.map((p) => p.hand);

    for (let i = 0; i < count; i++) {
      const sourceIndex = (i - room.direction + count) % count;
      playerValues[i].hand = oldHands[sourceIndex];
    }
  }

  // Steal: take one random card from the next player
  if (card.type === "steal") {
    const playerArray = Array.from(room.players.keys());
    const count = playerArray.length;
    const nextPlayerIndex = (room.currentPlayerIndex + room.direction + count) % count;
    const nextPlayerId = playerArray[nextPlayerIndex];
    const nextPlayer = room.players.get(nextPlayerId);

    if (nextPlayer && nextPlayer.hand.length > 0) {
      const stolenIndex = Math.floor(Math.random() * nextPlayer.hand.length);
      const stolenCard = nextPlayer.hand.splice(stolenIndex, 1)[0];
      player.hand.push(stolenCard);
    }
  }

  // God Mode: resolve one table-wide power (affects everyone, caster included).
  if (card.type === "godmode") {
    if (godPower === "allSeeingEye") {
      room.revealHandsOwnerId = playerId;
    } else if (godPower === "bigBang") {
      bigBang(room);
    } else if (godPower === "reincarnation") {
      reincarnation(room);
    }
  }

  // Update lastPlayedColor for all card types
  if (card.type === "wild" || card.type === "plus4" || card.type === "plus20" || card.type === "wildpickswap") {
    room.lastPlayedColor = chosenColor!;
  } else if ("color" in card) {
    room.lastPlayedColor = card.color;
  }

  // Check win condition
  if (player.hand.length === 0) {
    room.status = GameStatus.finished;
    return; // Don't advance turn if game over
  }

  // Advance turn: Lucky Hand keeps the turn (the boosted draw advances it),
  // skip cards advance by 3, everything else advances by 1.
  if (card.type === "luckyhand") {
    room.luckyDrawPlayerId = playerId;
  } else if (card.type === "skip") {
    const playerArray = Array.from(room.players.keys());
    const count = playerArray.length;
    room.currentPlayerIndex =
      (room.currentPlayerIndex + 3 * room.direction + count) % count;
  } else {
    advanceTurn(room);
  }
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

  // All-Seeing Eye lasts one lap: clear it when the owner takes their next action.
  if (room.revealHandsOwnerId === playerId) {
    room.revealHandsOwnerId = null;
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
    // Single draw — boosted (~90% special) if a Lucky Hand draw is pending.
    const useBoost = room.luckyDrawPlayerId === playerId;
    const card = useBoost ? generateBoostedCard() : generateCard();
    player.hand.push(card);
    drawnCards.push(card);
  }

  // A Lucky Hand boost is consumed by exactly one draw.
  room.luckyDrawPlayerId = null;

  // Reset reverse stack on draw (drawing breaks the chain)
  room.reverseStackCount = 0;

  // Advance turn after drawing
  advanceTurn(room);

  return drawnCards;
}

// Check win condition
export function checkWinCondition(room: Room): string | null {
  for (const [playerId, player] of room.players) {
    if (player.hand.length === 0) {
      room.status = GameStatus.finished;
      return playerId;
    }
  }
  return null;
}
