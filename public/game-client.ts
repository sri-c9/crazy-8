// Game client - handles WebSocket connection, rendering, and user interactions
import { haptic } from "./haptics";
import { seatOpponents } from "./turn-order";

interface Card {
  type: string;
  color?: string;
  value?: number;
  chosenColor?: string | null;
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  connected: boolean;
  cardCount: number;
  hand?: Card[];
}

interface GameState {
  currentPlayerId: string;
  topCard: Card;
  lastPlayedColor: string | null;
  direction: number;
  pendingDraws: number;
  reverseStackCount: number;
  revealHands?: boolean;
  luckyDrawPlayerId?: string | null;
  players: Player[];
  winner: string | null;
}

// Global state
let ws: WebSocket | null = null;
let yourPlayerId: string | null = null;
let roomCode: string | null = null;
let pendingWildCardIndex: number | null = null;
let pendingWildCardEl: HTMLElement | null = null;
let pendingWildTargetPlayerId: string | null = null;
let pendingTargetCardIndex: number | null = null;
let pendingTargetCardEl: HTMLElement | null = null;
let pendingTargetCardType: string | null = null;
let pendingGodCardIndex: number | null = null;
let pendingGodCardEl: HTMLElement | null = null;
let currentGameState: GameState | null = null;
let previousGameState: GameState | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let gameOver = false;
let isPlayPending = false;
let isReconnecting = false;
let previousHandLength = 0;
let wasYourTurn = false;

// Compare two cards for equality (used for diff-based animations)
function cardsEqual(a: Card | undefined, b: Card | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.type === b.type &&
    a.color === b.color &&
    a.value === b.value &&
    a.chosenColor === b.chosenColor
  );
}

// Safe WebSocket send helper
function safeSend(data: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  } else {
    console.warn("WebSocket not ready, cannot send:", data);
  }
}

// Initialize
function init() {
  // Get room and player from URL params
  const params = new URLSearchParams(window.location.search);
  roomCode = params.get("room");
  yourPlayerId = params.get("player");

  if (!roomCode || !yourPlayerId) {
    alert("Missing room or player ID");
    window.location.href = "/";
    return;
  }

  document.getElementById("roomBadge")!.textContent = roomCode;

  connectWebSocket();
  setupEventListeners();
}

// Connect to WebSocket
function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  ws = new WebSocket(`${protocol}//${host}/ws`);

  ws.onopen = () => {
    console.log("Connected to game");
    reconnectAttempts = 0;
    isReconnecting = false;
    isPlayPending = false;
    hideLoading();

    // Identify ourselves to the server
    const sessionToken = sessionStorage.getItem("crazy8_sessionToken") || "";
    ws!.send(JSON.stringify({
      action: "rejoin",
      roomCode: roomCode,
      playerId: yourPlayerId,
      sessionToken,
    }));
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data);
    } catch (error) {
      console.error("Failed to parse message:", error);
      showError("Received invalid data from server");
    }
  };

  ws.onerror = (err) => {
    console.error("❌ WebSocket error:", err);
    showError("Connection error");
  };

  ws.onclose = () => {
    console.log("Disconnected");
    isReconnecting = true;
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 15000);
      reconnectAttempts++;
      showToast(`Reconnecting... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      setTimeout(() => connectWebSocket(), delay);
    } else {
      isReconnecting = false;
      showError("Connection lost. Refresh to try again.");
    }
  };
}

// Handle incoming messages
function handleMessage(data: any) {
  console.log("📩 Received:", data);

  switch (data.type) {
    case "rejoined":
      console.log("Rejoined room:", data.roomCode);
      break;

    case "playerList":
      console.log("Player list updated:", data.players);
      break;

    case "state":
      isPlayPending = false;
      previousGameState = currentGameState;
      currentGameState = data.gameState;
      renderGameState(data.gameState, data.yourPlayerId);
      break;

    case "cardDrawn":
      handleCardDrawn(data.cards, data.forced);
      break;

    case "gameStarted":
      console.log("Game started!");
      break;

    case "cardEffect":
      handleCardEffect(data.effect, data.targetPlayerId);
      break;

    case "error":
      showError(data.message);
      // Redirect to lobby on fatal rejoin errors (e.g. server restarted)
      if (data.message === "Room not found" || data.message === "Player not found in room" || data.message === "Invalid session") {
        setTimeout(() => { window.location.href = "/"; }, 2000);
      }
      isPlayPending = false;
      const drawBtn = document.getElementById("drawBtn") as HTMLButtonElement;
      if (drawBtn) drawBtn.disabled = false;
      break;

    default:
      console.log("Unknown message type:", data.type);
  }
}

// Render complete game state
function renderGameState(state: GameState, playerId: string) {
  yourPlayerId = playerId;

  // Update turn indicator and hand area
  const isYourTurn = state.currentPlayerId === yourPlayerId;
  const handArea = document.querySelector(".hand-area") as HTMLElement;
  handArea.classList.toggle("your-turn", isYourTurn);

  // Pulse animation and toast when it first becomes your turn
  if (isYourTurn && !wasYourTurn) {
    handArea.classList.remove("turn-just-changed");
    // Force reflow to restart animation if already applied
    void (handArea as HTMLElement).offsetWidth;
    handArea.classList.add("turn-just-changed");
    setTimeout(() => handArea.classList.remove("turn-just-changed"), 650);

    showToast("Your turn!");
    try { navigator.vibrate([50, 30, 50]); } catch {}
  }
  wasYourTurn = isYourTurn;

  // Lock the hand area after playing Lucky Hand: only the boosted draw is allowed.
  handArea.classList.toggle("hand-locked", state.luckyDrawPlayerId === playerId);

  // Render opponents
  renderOpponents(state.players, state.currentPlayerId, yourPlayerId, state.direction, state.revealHands === true);

  // Render top card
  renderTopCard(state.topCard, state.lastPlayedColor);

  // Render your hand
  const yourPlayer = state.players.find((p) => p.id === yourPlayerId);
  if (yourPlayer && yourPlayer.hand) {
    renderHand(yourPlayer.hand, state.topCard, state, isYourTurn);
  }

  // Update pending draws alert (only show for current player)
  if (state.pendingDraws > 0 && isYourTurn) {
    document.getElementById("pendingAlert")!.classList.remove("hidden");
    document.getElementById("pendingCount")!.textContent = `+${state.pendingDraws}`;
  } else {
    document.getElementById("pendingAlert")!.classList.add("hidden");
  }

  // Update direction indicator
  const directionIndicator = document.getElementById("directionIndicator")!;
  const directionArrow = document.getElementById("directionArrow")!;
  directionArrow.textContent = ""; // Clear old text content

  if (state.direction === 1) {
    directionIndicator.classList.add("clockwise");
    directionIndicator.classList.remove("counter-clockwise");
  } else {
    directionIndicator.classList.add("counter-clockwise");
    directionIndicator.classList.remove("clockwise");
  }

  // Enable/disable draw button based on turn
  const drawBtn = document.getElementById("drawBtn") as HTMLButtonElement;
  drawBtn.disabled = !isYourTurn || isPlayPending;
  drawBtn.textContent = state.pendingDraws > 0 ? `Draw +${state.pendingDraws}` : "Draw";

  // Diff-based transient animations (skip on first render)
  if (previousGameState && yourPlayerId) {
    const topChanged = !cardsEqual(previousGameState.topCard, state.topCard);

    // Opponent play fly-over
    if (topChanged) {
      const prevOpponents = previousGameState.players.filter((p) => p.id !== yourPlayerId);
      const currOpponents = state.players.filter((p) => p.id !== yourPlayerId);
      for (const prevOpp of prevOpponents) {
        const currOpp = currOpponents.find((p) => p.id === prevOpp.id);
        if (currOpp && currOpp.cardCount < prevOpp.cardCount) {
          const oppNode = document.querySelector(
            `.opponent-node[data-player-id="${currOpp.id}"] .opponent-avatar-circle`
          ) as HTMLElement | null;
          if (oppNode) animateOpponentPlayToDiscard(oppNode);
          break;
        }
      }
    }

    // Discard pile pop
    if (topChanged) {
      const topCardEl = document.getElementById("topCard")!;
      topCardEl.classList.remove("discard-pop");
      void topCardEl.offsetWidth;
      topCardEl.classList.add("discard-pop");
      topCardEl.addEventListener("animationend", () => topCardEl.classList.remove("discard-pop"), { once: true });
    }

    // Direction spin
    if (previousGameState.direction !== state.direction) {
      const dirInd = document.getElementById("directionIndicator")!;
      dirInd.classList.remove("direction-spin");
      void dirInd.offsetWidth;
      dirInd.classList.add("direction-spin");
      dirInd.addEventListener("animationend", () => dirInd.classList.remove("direction-spin"), { once: true });
    }

    // Pending draws bump
    if (state.pendingDraws > previousGameState.pendingDraws && isYourTurn) {
      const pendingAlert = document.getElementById("pendingAlert")!;
      pendingAlert.classList.remove("pending-bump");
      void pendingAlert.offsetWidth;
      pendingAlert.classList.add("pending-bump");
      pendingAlert.addEventListener("animationend", () => pendingAlert.classList.remove("pending-bump"), { once: true });

      drawBtn.classList.add("draw-pile-flash");
      drawBtn.addEventListener("animationend", () => drawBtn.classList.remove("draw-pile-flash"), { once: true });

      const drawPileStack = document.querySelector(".draw-pile-stack") as HTMLElement | null;
      if (drawPileStack) {
        drawPileStack.classList.add("draw-pile-flash");
        drawPileStack.addEventListener("animationend", () => drawPileStack.classList.remove("draw-pile-flash"), { once: true });
      }
    }
  }

  // Show disconnected player indicator when it's an offline player's turn
  const currentTurnPlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const disconnectedAlert = document.getElementById("disconnectedAlert")!;
  if (!isYourTurn && currentTurnPlayer && !currentTurnPlayer.connected) {
    disconnectedAlert.classList.remove("hidden");
    document.getElementById("disconnectedName")!.textContent = currentTurnPlayer.name;
  } else {
    disconnectedAlert.classList.add("hidden");
  }

  // Check for winner after rendering all game state (show modal on top of final board)
  if (state.winner) {
    if (state.winner === "__admin__") {
      showGameOver("Game ended by admin", false);
    } else {
      const winner = state.players.find((p) => p.id === state.winner);
      showGameOver((winner ? winner.name : "Unknown player") + " wins!");
    }
  }
}

// Render opponents
function renderOpponents(
  players: Player[],
  currentPlayerId: string,
  yourId: string,
  direction: number,
  revealHands: boolean = false,
) {
  const container = document.getElementById("opponentsList")!;
  container.innerHTML = "";

  // Seat opponents in true rotation order from the local player; the helper
  // also flags the current player and the player who is up next.
  const seats = seatOpponents(players, yourId, currentPlayerId, direction);
  if (seats.length === 0) return;

  // Calculate semicircular arc positions (160deg to 20deg, left to right)
  const startAngle = 160; // deg
  const endAngle = 20; // deg
  const totalArc = startAngle - endAngle; // 140 degrees

  seats.forEach((seat, index) => {
    const player = seat.player;
    const div = document.createElement("div");
    div.className = "opponent-node";
    div.dataset.playerId = player.id;
    if (seat.isCurrent) {
      div.classList.add("current-turn");
    }
    if (seat.isNext) {
      div.classList.add("next-turn");
    }
    if (!player.connected) {
      div.classList.add("disconnected");
    }

    // Calculate angle for this opponent
    let angle: number;
    if (seats.length === 1) {
      angle = 90; // Center top
    } else {
      const step = totalArc / (seats.length - 1);
      angle = startAngle - (step * index);
    }

    // Convert angle to position on semicircle
    const angleRad = (angle * Math.PI) / 180;
    const radius = 40; // percentage of container width/height
    const centerX = 50; // center of screen
    const centerY = 45; // slightly above vertical center

    const x = centerX + radius * Math.cos(angleRad);
    const y = centerY - radius * Math.sin(angleRad);

    // Position the opponent node
    div.style.left = `${x}%`;
    div.style.top = `${y}%`;
    div.style.transform = "translate(-50%, -50%)";

    const avatarCircle = document.createElement("div");
    avatarCircle.className = "opponent-avatar-circle";
    avatarCircle.textContent = player.avatar;
    div.appendChild(avatarCircle);

    // "NEXT" badge on whoever plays immediately after the current player.
    if (seat.isNext) {
      const nextBadge = document.createElement("div");
      nextBadge.className = "next-badge";
      nextBadge.textContent = "NEXT";
      div.appendChild(nextBadge);
    }

    const nameDiv = document.createElement("div");
    nameDiv.className = "opponent-name";
    nameDiv.textContent = player.name;
    div.appendChild(nameDiv);

    if (revealHands && player.hand && player.hand.length > 0) {
      const revealRow = document.createElement("div");
      revealRow.className = "opponent-revealed-hand";
      player.hand.forEach((card) => {
        const mini = createCardElement(card);
        mini.classList.add("mini-card");
        revealRow.appendChild(mini);
      });
      div.appendChild(revealRow);
    } else {
      const countDiv = document.createElement("div");
      countDiv.className = "opponent-card-count";
      countDiv.textContent = `${player.cardCount} card${player.cardCount !== 1 ? "s" : ""}`;
      div.appendChild(countDiv);
    }

    container.appendChild(div);
  });
}

// Render your hand
function renderHand(
  hand: Card[],
  topCard: Card,
  state: GameState,
  isYourTurn: boolean
) {
  const container = document.getElementById("handCards")!;
  container.innerHTML = "";

  if (hand.length === 0) {
    container.innerHTML = '<p class="empty-hand">No cards</p>';
    previousHandLength = 0;
    return;
  }

  // Newly drawn cards are appended to the end of the hand array
  const newCardStartIndex = hand.length > previousHandLength ? previousHandLength : hand.length;
  previousHandLength = hand.length;

  const count = hand.length;
  const useScrollLayout = count > 12;

  // Toggle layout mode class on the container
  container.classList.toggle("scroll-layout", useScrollLayout);

  if (useScrollLayout) {
    // Horizontal scroll layout for large hands
    hand.forEach((card, index) => {
      const cardEl = createCardElement(card);
      cardEl.dataset.index = index.toString();

      const isPlayable = isYourTurn && canPlayCardClient(card, topCard, state);
      if (isPlayable) {
        cardEl.classList.add("playable");
        cardEl.onclick = (e) => handleCardClick(index, card, e.currentTarget as HTMLElement);
      } else {
        cardEl.classList.add("unplayable");
      }

      cardEl.style.zIndex = index.toString();

      container.appendChild(cardEl);

      if (index >= newCardStartIndex) {
        setDrawAnimation(cardEl, index - newCardStartIndex);
      }
    });
  } else {
    // Fan layout for <= 12 cards
    const cardSpacing = Math.min(48, 280 / count);
    const maxRotation = 40; // degrees

    hand.forEach((card, index) => {
      const cardEl = createCardElement(card);
      cardEl.dataset.index = index.toString();

      const isPlayable = isYourTurn && canPlayCardClient(card, topCard, state);
      if (isPlayable) {
        cardEl.classList.add("playable");
        cardEl.onclick = (e) => handleCardClick(index, card, e.currentTarget as HTMLElement);
      } else {
        cardEl.classList.add("unplayable");
      }

      // Calculate fan layout positioning
      const normalizedIndex = count === 1 ? 0 : (index / (count - 1)) - 0.5;
      const rotation = normalizedIndex * maxRotation;

      // Arc effect: edges lower than center
      const arcDepth = 20;
      const yOffset = Math.abs(normalizedIndex) * 2 * arcDepth;

      // Playable cards get lifted 8px higher
      const playableLift = isPlayable ? 8 : 0;

      // Position from left
      const leftPosition = (count - 1) * cardSpacing / 2 - index * cardSpacing;

      // Z-index increases left to right
      const zIndex = index;

      cardEl.style.left = `calc(50% - ${leftPosition}px)`;
      cardEl.style.bottom = `${10 + playableLift - yOffset}px`;
      cardEl.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
      cardEl.style.zIndex = zIndex.toString();

      container.appendChild(cardEl);

      if (index >= newCardStartIndex) {
        setDrawAnimation(cardEl, index - newCardStartIndex);
      }
    });
  }

  document.getElementById("cardCount")!.textContent = hand.length.toString();
}

// Set draw-from-pile animation on a newly-added card element.
// Must be called AFTER the element is in the DOM so getBoundingClientRect works.
function setDrawAnimation(cardEl: HTMLElement, staggerIndex = 0) {
  const drawBtn = document.getElementById("drawBtn");
  if (drawBtn) {
    const drawBtnRect = drawBtn.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();
    const offsetX = drawBtnRect.left + drawBtnRect.width / 2 - (cardRect.left + cardRect.width / 2);
    const offsetY = drawBtnRect.top + drawBtnRect.height / 2 - (cardRect.top + cardRect.height / 2);
    cardEl.style.setProperty("--draw-offset-x", `${offsetX}px`);
    cardEl.style.setProperty("--draw-offset-y", `${offsetY}px`);
  }
  cardEl.style.setProperty("--draw-stagger", `${staggerIndex * 80}ms`);
  cardEl.classList.add("card-entering");
}

// Animate a card clone from the player's hand to the discard pile.
// Purely cosmetic; server state remains authoritative.
function animateCardToDiscard(sourceEl: HTMLElement): void {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof Element === "undefined" || !Element.prototype.animate) return;

  const topCard = document.getElementById("topCard");
  if (!topCard) return;

  const sourceRect = sourceEl.getBoundingClientRect();
  const targetRect = topCard.getBoundingClientRect();
  const clone = sourceEl.cloneNode(true) as HTMLElement;
  clone.style.position = "fixed";
  clone.style.left = `${sourceRect.left}px`;
  clone.style.top = `${sourceRect.top}px`;
  clone.style.width = `${sourceRect.width}px`;
  clone.style.height = `${sourceRect.height}px`;
  clone.style.margin = "0";
  clone.style.zIndex = "1000";
  clone.style.pointerEvents = "none";
  document.body.appendChild(clone);

  const deltaX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
  const deltaY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);

  const animation = clone.animate(
    [
      { transform: "translate(0, 0) rotate(0deg) scale(1)" },
      {
        transform: `translate(${deltaX * 0.5}px, ${deltaY * 0.3}px) rotate(${deltaX > 0 ? 8 : -8}deg) scale(1.05)`,
        offset: 0.5,
      },
      { transform: `translate(${deltaX}px, ${deltaY}px) rotate(0deg) scale(0.92)` },
    ],
    {
      duration: 350,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    }
  );

  animation.onfinish = () => clone.remove();
}

// Animate a face-down card from an opponent's avatar to the discard pile.
function animateOpponentPlayToDiscard(sourceEl: HTMLElement): void {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof Element === "undefined" || !Element.prototype.animate) return;

  const topCard = document.getElementById("topCard");
  if (!topCard) return;

  const sourceRect = sourceEl.getBoundingClientRect();
  const targetRect = topCard.getBoundingClientRect();
  const rootStyles = getComputedStyle(document.documentElement);
  const cardWidth = parseFloat(rootStyles.getPropertyValue("--card-width")) || 68;
  const cardHeight = parseFloat(rootStyles.getPropertyValue("--card-height")) || 100;

  const clone = document.createElement("div");
  clone.className = "card-back opponent-play-clone";
  clone.style.width = `${cardWidth}px`;
  clone.style.height = `${cardHeight}px`;
  clone.style.left = `${sourceRect.left + sourceRect.width / 2 - cardWidth / 2}px`;
  clone.style.top = `${sourceRect.top + sourceRect.height / 2 - cardHeight / 2}px`;
  document.body.appendChild(clone);

  const deltaX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
  const deltaY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);

  const animation = clone.animate(
    [
      { transform: "translate(0, 0) rotate(0deg) scale(1)" },
      {
        transform: `translate(${deltaX * 0.6}px, ${deltaY * 0.2}px) rotate(12deg) scale(1.05)`,
        offset: 0.5,
      },
      { transform: `translate(${deltaX}px, ${deltaY}px) rotate(0deg) scale(0.95)` },
    ],
    {
      duration: 350,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    }
  );

  animation.onfinish = () => clone.remove();
}

// ============================================================
// Special-card effect animations (swap / rotate / reverse)
// All purely cosmetic; server state stays authoritative.
// ============================================================

// True when the browser can animate and the user hasn't opted out.
function motionEnabled(): boolean {
  if (typeof Element === "undefined" || !Element.prototype.animate) return false;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return true;
}

// Screen-space anchor point for a player's "hand": the bottom hand area for
// yourself, or the opponent's avatar circle for everyone else.
function getPlayerScreenPoint(playerId: string): { x: number; y: number } | null {
  if (playerId === yourPlayerId) {
    const hand = document.querySelector(".hand-area") as HTMLElement | null;
    if (!hand) return null;
    const r = hand.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.28 };
  }
  const node = document.querySelector(
    `.opponent-node[data-player-id="${playerId}"] .opponent-avatar-circle`
  ) as HTMLElement | null;
  if (!node) return null;
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Fly a small fanned stack of face-down cards from one point to another along
// an arced path. `arc` bulges the midpoint perpendicular to the travel line
// (sign follows travel direction, so opposing trips curve to opposite sides).
function flyHandStack(
  from: { x: number; y: number },
  to: { x: number; y: number },
  opts: { arc?: number; delay?: number; duration?: number; tint?: string; spin?: number } = {}
): void {
  if (!motionEnabled()) return;

  const { arc = 0, delay = 0, duration = 640, tint, spin = 0 } = opts;

  const stack = document.createElement("div");
  stack.className = "fx-hand-stack";
  stack.innerHTML = "<i></i><i></i><i></i>";
  if (tint) stack.style.setProperty("--fx-tint", tint);
  stack.style.left = `${from.x}px`;
  stack.style.top = `${from.y}px`;
  document.body.appendChild(stack);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len; // perpendicular unit vector
  const py = dx / len;
  const midX = dx * 0.5 + px * arc;
  const midY = dy * 0.5 + py * arc;

  const anim = stack.animate(
    [
      { transform: "translate(-50%, -50%) translate(0px, 0px) scale(0.55) rotate(0deg)", opacity: 0 },
      { transform: "translate(-50%, -50%) translate(0px, 0px) scale(1) rotate(0deg)", opacity: 1, offset: 0.14 },
      { transform: `translate(-50%, -50%) translate(${midX}px, ${midY}px) scale(1.08) rotate(${spin * 0.5}deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.66) rotate(${spin}deg)`, opacity: 0 },
    ],
    { duration, delay, easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "forwards" }
  );
  const cleanup = () => stack.remove();
  anim.onfinish = cleanup;
  anim.oncancel = cleanup;
}

// Glow pulse on a player's anchor (avatar circle or hand area).
function pulseEndpoint(playerId: string, color: string, delay = 0): void {
  if (!motionEnabled()) return;
  const el =
    playerId === yourPlayerId
      ? (document.querySelector(".hand-area") as HTMLElement | null)
      : (document.querySelector(
          `.opponent-node[data-player-id="${playerId}"] .opponent-avatar-circle`
        ) as HTMLElement | null);
  if (!el) return;
  window.setTimeout(() => {
    el.style.setProperty("--fx-glow", color);
    el.classList.remove("fx-endpoint-glow");
    void el.offsetWidth;
    el.classList.add("fx-endpoint-glow");
    el.addEventListener("animationend", () => el.classList.remove("fx-endpoint-glow"), { once: true });
  }, delay);
}

// Expanding ring pulse centered on a screen point.
function emitRingPulse(point: { x: number; y: number }, color: string, delay = 0): void {
  if (!motionEnabled()) return;
  const ring = document.createElement("div");
  ring.className = "fx-ring-pulse";
  ring.style.left = `${point.x}px`;
  ring.style.top = `${point.y}px`;
  ring.style.setProperty("--fx-glow", color);
  document.body.appendChild(ring);
  const anim = ring.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.3)", opacity: 0.85 },
      { transform: "translate(-50%, -50%) scale(2.6)", opacity: 0 },
    ],
    { duration: 700, delay, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
  );
  const cleanup = () => ring.remove();
  anim.onfinish = cleanup;
  anim.oncancel = cleanup;
}

// Center point of the discard/board area (fallback to viewport center).
function getBoardCenter(): { x: number; y: number } {
  const el = document.getElementById("topCard") || document.querySelector(".piles-container");
  if (el) {
    const r = (el as HTMLElement).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

// Swap: two hand stacks cross past each other on opposite arcs, both ends glow.
function playSwapAnimation(otherPlayerId: string): void {
  if (!yourPlayerId) return;
  const me = getPlayerScreenPoint(yourPlayerId);
  const other = getPlayerScreenPoint(otherPlayerId);
  if (!me || !other) return;
  flyHandStack(me, other, { arc: 70, spin: 360, tint: "rgba(255, 204, 0, 0.85)" });
  flyHandStack(other, me, { arc: 70, spin: -360, tint: "rgba(90, 200, 250, 0.9)" });
  pulseEndpoint(yourPlayerId, "rgba(255, 204, 0, 0.85)");
  pulseEndpoint(otherPlayerId, "rgba(90, 200, 250, 0.9)");
}

// Rotate: every seat passes its hand to the next seat in the play direction.
function playRotateAnimation(): void {
  const state = currentGameState;
  if (!state) return;
  const players = state.players;
  const n = players.length;
  if (n < 2) return;
  const dir = state.direction >= 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const from = getPlayerScreenPoint(players[i].id);
    const to = getPlayerScreenPoint(players[(i + dir + n) % n].id);
    if (!from || !to) continue;
    flyHandStack(from, to, {
      arc: 60 * dir,
      delay: i * 70,
      spin: dir * 200,
      tint: "rgba(52, 199, 89, 0.9)",
    });
  }
  emitRingPulse(getBoardCenter(), "rgba(52, 199, 89, 0.8)");
}

// Reverse: a glow ripple sweeps around the seating order the new way.
function playReverseAnimation(): void {
  const state = currentGameState;
  const color = "rgba(255, 159, 10, 0.9)"; // warning orange
  emitRingPulse(getBoardCenter(), color);
  if (!state) return;
  const players = state.players;
  const n = players.length;
  const dir = state.direction >= 0 ? 1 : -1;
  // Walk the ring in the (new) direction so the ripple reads as a reversal.
  for (let step = 0; step < n; step++) {
    const idx = ((step * dir) % n + n) % n;
    pulseEndpoint(players[idx].id, color, step * 90);
  }
}

// 🍀 Lucky Hand: gold ring + sparkle over the draw pile; pile glows until you draw.
function playLuckyHandAnimation(): void {
  const drawPile = document.getElementById("drawPile") || document.querySelector(".piles-container");
  if (drawPile) {
    (drawPile as HTMLElement).classList.add("draw-pile-lucky");
  }
  if (!motionEnabled()) return;
  const center = getBoardCenter();
  emitRingPulse(center, "rgba(255,210,80,0.9)");
  emitRingPulse(center, "rgba(255,235,160,0.7)", 120);
}

// Remove the lucky glow once the draw resolves (called from handleCardDrawn).
function clearLuckyGlow(): void {
  document.querySelectorAll(".draw-pile-lucky").forEach((el) => el.classList.remove("draw-pile-lucky"));
}

// 👁 All-Seeing Eye: violet iris ring + blinking eye; pulse every player.
function playAllSeeingEyeAnimation(): void {
  if (!motionEnabled()) return;
  const center = getBoardCenter();
  emitRingPulse(center, "rgba(168,85,247,0.9)");
  const eye = document.createElement("div");
  eye.className = "fx-eye";
  eye.textContent = "👁";
  eye.style.left = `${center.x}px`;
  eye.style.top = `${center.y}px`;
  document.body.appendChild(eye);
  eye.addEventListener("animationend", () => eye.remove(), { once: true });
  (currentGameState?.players ?? []).forEach((p, i) => pulseEndpoint(p.id, "rgba(168,85,247,0.9)", i * 60));
}

// 💥 Big Bang: flash + shockwave, hands implode to center then scatter back out.
function playBigBangAnimation(): void {
  if (!motionEnabled()) return;
  const center = getBoardCenter();
  const flash = document.createElement("div");
  flash.className = "fx-flash";
  document.body.appendChild(flash);
  flash.addEventListener("animationend", () => flash.remove(), { once: true });
  emitRingPulse(center, "rgba(255,179,71,0.95)");
  const players = currentGameState?.players ?? [];
  players.forEach((p, i) => {
    const pt = getPlayerScreenPoint(p.id);
    if (!pt) return;
    flyHandStack(pt, center, { arc: 30, delay: i * 40, duration: 420, tint: "#ffb347" });        // implode
    flyHandStack(center, pt, { arc: -30, delay: 460 + i * 40, duration: 520, tint: "#ffd27a" });  // scatter
  });
}

// ♻️ Reincarnation: hands burn away upward, then fresh stacks deal out to everyone.
function playReincarnationAnimation(): void {
  if (!motionEnabled()) return;
  const center = getBoardCenter();
  const players = currentGameState?.players ?? [];
  players.forEach((p, i) => {
    const pt = getPlayerScreenPoint(p.id);
    if (!pt) return;
    // Incinerate: rise and dissolve.
    flyHandStack(pt, { x: pt.x, y: pt.y - 120 }, { arc: 0, delay: i * 40, duration: 460, tint: "#ff5a36", spin: 40 });
    // Rebirth: deal fresh cards from center.
    flyHandStack(center, pt, { arc: 20, delay: 520 + i * 50, duration: 560, tint: "#34d399" });
    pulseEndpoint(p.id, "rgba(52,211,153,0.9)", 520 + i * 50);
  });
}

// Create card element
function createCardElement(card: Card): HTMLElement {
  const div = document.createElement("div");
  const color = card.color || card.chosenColor || "wild";
  div.className = `card ${color}`;

  let content = "";
  let cornerValue = "";

  switch (card.type) {
    case "number":
      content = `<span class="card-value">${card.value}</span>`;
      cornerValue = card.value!.toString();
      break;
    case "wild":
      content = `<span class="card-value">8</span><span class="card-type">WILD</span>`;
      cornerValue = "8";
      break;
    case "plus2":
      content = `<span class="card-value">+2</span>`;
      cornerValue = "+2";
      break;
    case "plus4":
      content = `<span class="card-value">+4</span>`;
      cornerValue = "+4";
      break;
    case "plus20":
      content = `<span class="card-value">+20</span>`;
      cornerValue = "+20";
      break;
    case "plus20color":
      content = `<span class="card-value">+20</span>`;
      cornerValue = "+20";
      break;
    case "skip":
      content = `<span class="card-value">⊘</span><span class="card-type">SKIP</span>`;
      cornerValue = "⊘";
      break;
    case "reverse":
      content = `<span class="card-value">⇄</span><span class="card-type">REV</span>`;
      cornerValue = "⇄";
      break;
    case "swap":
      content = `<span class="card-value">⇅</span><span class="card-type">SWAP</span>`;
      cornerValue = "⇅";
      break;
    case "nope":
      content = `<span class="card-value">🛡</span><span class="card-type">NOPE</span>`;
      cornerValue = "N";
      break;
    case "rotate":
      content = `<span class="card-value">🔄</span><span class="card-type">ROT</span>`;
      cornerValue = "R";
      break;
    case "steal":
      content = `<span class="card-value">🦹</span><span class="card-type">STEAL</span>`;
      cornerValue = "S";
      break;
    case "pickswap":
      content = `<span class="card-value">⇆</span><span class="card-type">SWAP</span>`;
      cornerValue = "⇆";
      break;
    case "wildpickswap":
      content = `<span class="card-value">⇆</span><span class="card-type">SWAP</span>`;
      cornerValue = "⇆";
      break;
    case "luckyhand":
      content = `<span class="card-value">🍀</span><span class="card-type">LUCKY</span>`;
      cornerValue = "🍀";
      break;
    case "godmode":
      content = `<span class="card-value">⚡</span><span class="card-type">GOD</span>`;
      cornerValue = "⚡";
      break;
  }

  // Add corner numbers
  div.innerHTML = `
    <span class="card-corner card-corner-tl">${cornerValue}</span>
    ${content}
    <span class="card-corner card-corner-br">${cornerValue}</span>
  `;

  return div;
}

// Render top card
function renderTopCard(card: Card, lastColor: string | null) {
  const topCard = document.getElementById("topCard")!;
  const displayColor = card.color || lastColor || "wild";
  topCard.className = `card ${displayColor}`;

  let content = "";
  let cornerValue = "";

  switch (card.type) {
    case "number":
      content = `<span class="card-value">${card.value}</span>`;
      cornerValue = card.value!.toString();
      break;
    case "wild":
      content = `<span class="card-value">8</span>`;
      cornerValue = "8";
      break;
    case "plus2":
      content = `<span class="card-value">+2</span>`;
      cornerValue = "+2";
      break;
    case "plus4":
      content = `<span class="card-value">+4</span>`;
      cornerValue = "+4";
      break;
    case "plus20":
      content = `<span class="card-value">+20</span>`;
      cornerValue = "+20";
      break;
    case "plus20color":
      content = `<span class="card-value">+20</span>`;
      cornerValue = "+20";
      break;
    case "skip":
      content = `<span class="card-value">⊘</span>`;
      cornerValue = "⊘";
      break;
    case "reverse":
      content = `<span class="card-value">⇄</span>`;
      cornerValue = "⇄";
      break;
    case "swap":
      content = `<span class="card-value">⇅</span>`;
      cornerValue = "⇅";
      break;
    case "nope":
      content = `<span class="card-value">🛡</span>`;
      cornerValue = "N";
      break;
    case "rotate":
      content = `<span class="card-value">🔄</span>`;
      cornerValue = "R";
      break;
    case "steal":
      content = `<span class="card-value">🦹</span>`;
      cornerValue = "S";
      break;
    case "pickswap":
      content = `<span class="card-value">⇆</span>`;
      cornerValue = "⇆";
      break;
    case "wildpickswap":
      content = `<span class="card-value">⇆</span>`;
      cornerValue = "⇆";
      break;
    case "luckyhand":
      content = `<span class="card-value">🍀</span>`;
      cornerValue = "🍀";
      break;
    case "godmode":
      content = `<span class="card-value">⚡</span>`;
      cornerValue = "⚡";
      break;
  }

  // Add corner numbers
  topCard.innerHTML = `
    <span class="card-corner card-corner-tl">${cornerValue}</span>
    ${content}
    <span class="card-corner card-corner-br">${cornerValue}</span>
  `;
}

// Handle card click
function handleCardClick(index: number, card: Card, sourceEl: HTMLElement) {
  if (gameOver) return; // Don't allow interactions after game over
  if (isPlayPending) return; // Prevent double-play while waiting for server response
  if (isReconnecting) return; // Prevent actions while reconnecting

  // After Lucky Hand the only legal action is the boosted draw.
  if (currentGameState?.luckyDrawPlayerId === yourPlayerId) return;

  if (card.type === "pickswap" || card.type === "wildpickswap") {
    // Choose target opponent first (then color for the wild variant)
    pendingTargetCardIndex = index;
    pendingTargetCardEl = sourceEl;
    pendingTargetCardType = card.type;
    showTargetPicker();
  } else if (card.type === "wild" || card.type === "plus4" || card.type === "plus20") {
    // Show color picker for cards that require color selection
    pendingWildCardIndex = index;
    pendingWildCardEl = sourceEl;
    pendingWildTargetPlayerId = null;
    showColorPicker();
  } else if (card.type === "godmode") {
    pendingGodCardIndex = index;
    pendingGodCardEl = sourceEl;
    showGodPowerPicker();
  } else {
    // Play card immediately
    animateCardToDiscard(sourceEl);
    playCard({ index });
  }
}

// Play a card
function playCard(options: { index: number; chosenColor?: string; targetPlayerId?: string; godPower?: string }) {
  if (!ws) return;

  isPlayPending = true;

  // Light haptic feedback on card play
  try {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    } else {
      haptic();
    }
  } catch {}

  safeSend({
    action: "play",
    cardIndex: options.index,
    chosenColor: options.chosenColor,
    targetPlayerId: options.targetPlayerId,
    godPower: options.godPower,
  });
}

// Draw card
function drawCards() {
  if (!ws) return;
  if (gameOver) return; // Don't allow interactions after game over
  if (isPlayPending) return; // Prevent double-draw
  if (isReconnecting) return; // Prevent actions while reconnecting

  isPlayPending = true;
  const drawBtn = document.getElementById("drawBtn") as HTMLButtonElement;
  if (drawBtn) drawBtn.disabled = true;
  safeSend({
    action: "draw",
  });
}

// Trigger haptic feedback for forced draws
function triggerDrawHaptic(cardCount: number) {
  try {
    if (cardCount <= 2) {
      haptic(); // Single pulse for +2
    } else if (cardCount <= 4) {
      haptic.confirm(); // Two rapid pulses for +4
    } else {
      haptic.error(); // Three rapid pulses for +20 or stacked combos
    }
  } catch {
    // Silently ignore on unsupported platforms
  }
}

// Handle card drawn
function handleCardDrawn(cards: Card[], forced: boolean) {
  clearLuckyGlow();

  console.log(`Drew ${cards.length} card(s)`, forced ? "(forced)" : "");

  // Trigger haptic feedback for forced draws
  if (forced && cards.length > 1) {
    triggerDrawHaptic(cards.length);
  }

  // Show toast
  const message = forced
    ? `Drew ${cards.length} cards from plus-stack!`
    : `Drew ${cards.length} card${cards.length !== 1 ? "s" : ""}`;

  showToast(message);
}

// Handle card effects (skip/reverse/swap)
function handleCardEffect(effect: string, targetPlayerId?: string) {
  try {
    if (effect === "skipped") {
      haptic(); // Single pulse — you got skipped
      showToast("You were skipped!");
    } else if (effect === "reversed") {
      navigator.vibrate?.(30) || haptic(); // Light buzz — direction changed
      playReverseAnimation();
      showToast("Direction reversed!");
    } else if (effect === "youSwapped") {
      // Sent only to the swapper; targetPlayerId is the player they swapped with.
      haptic();
      if (targetPlayerId) playSwapAnimation(targetPlayerId);
      showToast("Hands swapped!");
    } else if (effect === "swapped") {
      // Sent only to the player whose hand was taken; targetPlayerId is the swapper.
      haptic(); // Haptic feedback for being swapped
      if (targetPlayerId) playSwapAnimation(targetPlayerId);
      showToast("Your hand was swapped!");
    } else if (effect === "nope") {
      showToast("🛡 Stack cancelled!");
    } else if (effect === "rotate") {
      playRotateAnimation();
      showToast("🔄 Hands rotated!");
    } else if (effect === "youStole" && targetPlayerId) {
      showToast("🦹 You stole a card!");
    } else if (effect === "stolen") {
      // Sent only to the victim; targetPlayerId is the thief.
      haptic();
      showToast("🦹 A card was stolen from you!");
    } else if (effect === "luckyHand") {
      haptic.confirm?.() || haptic();
      playLuckyHandAnimation();
      showToast("🍀 Lucky Hand — your draw is blessed!");
    } else if (effect === "luckyHandPlayed") {
      // Seen by everyone else; light cue only.
      showToast("🍀 Lucky Hand played!");
    } else if (effect === "allSeeingEye") {
      haptic();
      playAllSeeingEyeAnimation();
      showToast("👁 All-Seeing Eye — all hands revealed!");
    } else if (effect === "bigBang") {
      haptic.error?.() || haptic();
      playBigBangAnimation();
      showToast("💥 Big Bang — all hands reshuffled!");
    } else if (effect === "reincarnation") {
      haptic.error?.() || haptic();
      playReincarnationAnimation();
      showToast("♻️ Reincarnation — everyone reborn with 7 fresh cards!");
    }
  } catch {}
}

// Numeric value of a plus card for stacking rules on the client.
function plusCardValueClient(card: Card): number | null {
  if (card.type === "plus2") return 2;
  if (card.type === "plus4") return 4;
  if (card.type === "plus20" || card.type === "plus20color") return 20;
  return null;
}

// Client-side validation (matches server logic)
function canPlayCardClient(card: Card, topCard: Card, state: GameState): boolean {
  // If pendingDraws > 0, only higher/equal +cards (or a Nope) can be played.
  // Examples: +20 can be stacked on +2, but +2 cannot be stacked on +20.
  if (state.pendingDraws > 0) {
    // Nope cancels the stack regardless of value.
    if (card.type === "nope") {
      return true;
    }

    const stackValue = plusCardValueClient(card);
    const topValue = plusCardValueClient(topCard);

    // Only +cards can be played, and only if their value is >= the top card's value.
    if (stackValue !== null && topValue !== null) {
      return stackValue >= topValue;
    }

    return false;
  }

  // Wild/swap cards always playable (no color restrictions)
  if (card.type === "wild" || card.type === "plus4" || card.type === "plus20" || card.type === "swap" || card.type === "wildpickswap") return true;

  // Reverse limit
  if (card.type === "reverse" && state.reverseStackCount >= 4) {
    return false;
  }

  // Get target color
  const targetColor =
    topCard.type === "wild"
      ? state.lastPlayedColor
      : topCard.color || state.lastPlayedColor; // +4/+20 don't have color property; use the color chosen when played

  // Match color
  if (card.color === targetColor) return true;

  // Match number
  if (card.type === "number" && topCard.type === "number" && card.value === topCard.value) {
    return true;
  }

  // Type-matching: same special card type can always be played regardless of color
  const typeMatchable = ["skip", "reverse", "plus2", "plus20color", "pickswap", "nope", "rotate", "steal"] as const;
  if (card.type === topCard.type && typeMatchable.includes(card.type as typeof typeMatchable[number])) {
    return true;
  }

  return false;
}

// Show color picker
function showColorPicker() {
  document.getElementById("colorPicker")!.classList.remove("hidden");
}

// Hide color picker
function hideColorPicker() {
  document.getElementById("colorPicker")!.classList.add("hidden");
  pendingWildCardIndex = null;
  pendingWildCardEl = null;
  pendingWildTargetPlayerId = null;
}

// Show target picker
function showTargetPicker() {
  const picker = document.getElementById("targetPicker")!;
  const list = document.getElementById("targetList")!;
  list.innerHTML = "";

  if (!currentGameState || !yourPlayerId) {
    picker.classList.remove("hidden");
    return;
  }

  const opponents = currentGameState.players.filter((p) => p.id !== yourPlayerId);
  for (const opp of opponents) {
    const row = document.createElement("div");
    row.className = "target-row";
    row.dataset.playerId = opp.id;
    row.innerHTML = `<span class="target-avatar">${opp.avatar}</span><span class="target-name">${escapeHtml(opp.name)}</span>`;
    row.addEventListener("click", () => {
      // Capture the pending card BEFORE hiding the picker — hideTargetPicker()
      // clears these fields, so reading them afterwards would always be null
      // and the swap would silently do nothing.
      const index = pendingTargetCardIndex;
      const el = pendingTargetCardEl;
      const type = pendingTargetCardType;
      hideTargetPicker();
      if (index === null || !el || !type) return;

      if (type === "wildpickswap") {
        pendingWildCardIndex = index;
        pendingWildCardEl = el;
        pendingWildTargetPlayerId = opp.id;
        showColorPicker();
      } else {
        animateCardToDiscard(el);
        playCard({ index, targetPlayerId: opp.id });
      }
    });
    list.appendChild(row);
  }

  picker.classList.remove("hidden");
}

// Hide target picker
function hideTargetPicker() {
  document.getElementById("targetPicker")!.classList.add("hidden");
  pendingTargetCardIndex = null;
  pendingTargetCardEl = null;
  pendingTargetCardType = null;
}

// Show God Mode power picker
function showGodPowerPicker() {
  document.getElementById("godPowerPicker")!.classList.remove("hidden");
}

// Hide God Mode power picker
function hideGodPowerPicker() {
  document.getElementById("godPowerPicker")!.classList.add("hidden");
}

function selectGodPower(power: string) {
  if (pendingGodCardIndex === null) return;
  const index = pendingGodCardIndex;
  const el = pendingGodCardEl;
  pendingGodCardIndex = null;
  pendingGodCardEl = null;
  hideGodPowerPicker();
  if (el) animateCardToDiscard(el);
  playCard({ index, godPower: power });
}

// Escape HTML for safe rendering of player names
function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Show game over
function showGameOver(winnerName: string, showCelebration = true) {
  gameOver = true; // Lock the game board
  hideColorPicker(); // Dismiss any open wild card color picker
  hideTargetPicker(); // Dismiss any open target picker
  document.getElementById("winnerName")!.textContent = winnerName;
  const gameOverModal = document.getElementById("gameOver")!;
  gameOverModal.classList.remove("hidden");
  gameOverModal.classList.toggle("celebrating", showCelebration);
}

// Show error toast
function showError(message: string) {
  showToast(`❌ ${message}`, true);
}

// Toast queue — displays notifications sequentially to prevent overwrites
const toastQueue: Array<{ message: string; isError: boolean }> = [];
let isShowingToast = false;

function showToast(message: string, isError: boolean = false) {
  if (isError) {
    // Error toasts get priority: clear queue and interrupt any current toast
    toastQueue.length = 0;
    isShowingToast = false;
    document.querySelectorAll(".toast").forEach((t) => t.remove());
  }
  toastQueue.push({ message, isError });
  processToastQueue();
}

function processToastQueue() {
  if (isShowingToast || toastQueue.length === 0) return;

  isShowingToast = true;
  const { message, isError } = toastQueue.shift()!;

  const toast = document.createElement("div");
  toast.className = `toast ${isError ? "error" : ""}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);

  // Shorten display time when more toasts are queued up
  const pending = toastQueue.length;
  const displayDuration = pending >= 3 ? 1200 : pending >= 1 ? 1500 : 3000;

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
      isShowingToast = false;
      processToastQueue();
    }, 300);
  }, displayDuration);
}

// Hide loading overlay
function hideLoading() {
  document.getElementById("loadingOverlay")!.classList.add("hidden");
}

// Setup event listeners
function setupEventListeners() {
  // Draw button
  const drawBtn = document.getElementById("drawBtn") as HTMLButtonElement;
  drawBtn.onclick = () => {
    drawCards();
  };

  // Draw pile tap feedback
  const drawPileStack = document.querySelector(".draw-pile-stack") as HTMLElement | null;
  function setDrawPileTapped(tapped: boolean) {
    drawPileStack?.classList.toggle("tapped", tapped);
  }
  [drawBtn, drawPileStack].forEach((el) => {
    if (!el) return;
    el.addEventListener("pointerdown", () => setDrawPileTapped(true));
    el.addEventListener("pointerup", () => setDrawPileTapped(false));
    el.addEventListener("pointerleave", () => setDrawPileTapped(false));
    el.addEventListener("pointercancel", () => setDrawPileTapped(false));
  });

  // Color picker buttons
  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const color = (e.target as HTMLElement).dataset.color;
      if (pendingWildCardIndex !== null && color) {
        if (pendingWildCardEl) animateCardToDiscard(pendingWildCardEl);
        playCard({ index: pendingWildCardIndex, chosenColor: color, targetPlayerId: pendingWildTargetPlayerId ?? undefined });
        hideColorPicker();
      }
    });
  });

  // Color picker overlay (click to cancel)
  document.getElementById("colorPickerOverlay")?.addEventListener("click", () => {
    hideColorPicker();
  });

  // Target picker overlay (click to cancel)
  document.getElementById("targetPickerOverlay")?.addEventListener("click", () => {
    hideTargetPicker();
  });

  // God Mode power picker buttons
  document.querySelectorAll(".god-power-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const power = (btn as HTMLElement).dataset.power;
      if (power) selectGodPower(power);
    });
  });
  document.getElementById("godPowerPickerOverlay")?.addEventListener("click", () => {
    pendingGodCardIndex = null;
    pendingGodCardEl = null;
    hideGodPowerPicker();
  });

  // Back to lobby button
  document.getElementById("backToLobbyBtn")!.onclick = () => {
    window.location.href = "/";
  };

  // Menu button
  document.getElementById("menuBtn")!.onclick = () => {
    if (confirm("Leave game and return to lobby?")) {
      window.location.href = "/";
    }
  };
}

// Start the game client
init();
