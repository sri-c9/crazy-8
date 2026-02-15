// Game client - handles WebSocket connection, rendering, and user interactions
import { haptic } from "ios-haptics";

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
  players: Player[];
  winner: string | null;
}

// Global state
let ws: WebSocket | null = null;
let yourPlayerId: string | null = null;
let roomCode: string | null = null;
let pendingWildCardIndex: number | null = null;
let currentGameState: GameState | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

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
    hideLoading();

    // Identify ourselves to the server
    ws!.send(JSON.stringify({
      action: "rejoin",
      roomCode: roomCode,
      playerId: yourPlayerId,
    }));
  };

  ws.onmessage = (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    handleMessage(data);
  };

  ws.onerror = (err) => {
    console.error("❌ WebSocket error:", err);
    showError("Connection error");
  };

  ws.onclose = () => {
    console.log("Disconnected");
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 15000);
      reconnectAttempts++;
      showToast(`Reconnecting... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      setTimeout(() => connectWebSocket(), delay);
    } else {
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
      currentGameState = data.gameState;
      renderGameState(data.gameState, data.yourPlayerId);
      break;

    case "cardDrawn":
      handleCardDrawn(data.cards, data.forced);
      break;

    case "cardEffect":
      handleCardEffect(data.effect, data.targetPlayerId);
      break;

    case "error":
      showError(data.message);
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

  // Render opponents
  renderOpponents(state.players, state.currentPlayerId, yourPlayerId);

  // Render top card
  renderTopCard(state.topCard, state.lastPlayedColor);

  // Render your hand
  const yourPlayer = state.players.find((p) => p.id === yourPlayerId);
  if (yourPlayer && yourPlayer.hand) {
    renderHand(yourPlayer.hand, state.topCard, state, isYourTurn);
  }

  // Update pending draws alert
  if (state.pendingDraws > 0) {
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
  drawBtn.disabled = !isYourTurn;
  drawBtn.textContent = state.pendingDraws > 0 ? `Draw +${state.pendingDraws}` : "Draw";

  // Check for winner after rendering all game state (show modal on top of final board)
  if (state.winner) {
    if (state.winner === "__admin__") {
      showGameOver("Game ended by admin");
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
  yourId: string
) {
  const container = document.getElementById("opponentsList")!;
  container.innerHTML = "";

  const opponents = players.filter((p) => p.id !== yourId);
  if (opponents.length === 0) return;

  // Calculate semicircular arc positions (160deg to 20deg, left to right)
  const startAngle = 160; // deg
  const endAngle = 20; // deg
  const totalArc = startAngle - endAngle; // 140 degrees

  opponents.forEach((player, index) => {
    const div = document.createElement("div");
    div.className = "opponent-node";
    if (player.id === currentPlayerId) {
      div.classList.add("current-turn");
    }
    if (!player.connected) {
      div.classList.add("disconnected");
    }

    // Calculate angle for this opponent
    let angle: number;
    if (opponents.length === 1) {
      angle = 90; // Center top
    } else {
      const step = totalArc / (opponents.length - 1);
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

    const nameDiv = document.createElement("div");
    nameDiv.className = "opponent-name";
    nameDiv.textContent = player.name;
    div.appendChild(nameDiv);

    const countDiv = document.createElement("div");
    countDiv.className = "opponent-card-count";
    countDiv.textContent = `${player.cardCount} card${player.cardCount !== 1 ? "s" : ""}`;
    div.appendChild(countDiv);

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
    return;
  }

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
        cardEl.onclick = () => handleCardClick(index, card);
      } else {
        cardEl.classList.add("unplayable");
      }

      cardEl.style.zIndex = index.toString();

      container.appendChild(cardEl);
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
        cardEl.onclick = () => handleCardClick(index, card);
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
    });
  }

  document.getElementById("cardCount")!.textContent = hand.length.toString();
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
  }

  // Add corner numbers
  topCard.innerHTML = `
    <span class="card-corner card-corner-tl">${cornerValue}</span>
    ${content}
    <span class="card-corner card-corner-br">${cornerValue}</span>
  `;
}

// Handle card click
function handleCardClick(index: number, card: Card) {
  if (card.type === "wild" || card.type === "plus4" || card.type === "plus20") {
    // Show color picker for cards that require color selection
    pendingWildCardIndex = index;
    showColorPicker();
  } else {
    // Play card immediately
    playCard(index);
  }
}

// Play a card
function playCard(index: number, chosenColor?: string) {
  if (!ws) return;

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
    cardIndex: index,
    chosenColor,
  });
}

// Draw card
function drawCards() {
  if (!ws) return;

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
      showToast("Direction reversed!");
    } else if (effect === "youSwapped" && targetPlayerId === yourPlayerId) {
      showToast("Hands swapped!");
    } else if (effect === "swapped" && targetPlayerId === yourPlayerId) {
      haptic(); // Haptic feedback for being swapped
      showToast("Your hand was swapped!");
    }
  } catch {}
}

// Client-side validation (matches server logic)
function canPlayCardClient(card: Card, topCard: Card, state: GameState): boolean {
  // If pendingDraws > 0, only +cards can be played
  if (state.pendingDraws > 0) {
    return card.type === "plus2" || card.type === "plus4" || card.type === "plus20" || card.type === "plus20color";
  }

  // Wild cards always playable
  if (card.type === "wild") return true;

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
}

// Show game over
function showGameOver(winnerName: string) {
  document.getElementById("winnerName")!.textContent = winnerName;
  document.getElementById("gameOver")!.classList.remove("hidden");
}

// Show error toast
function showError(message: string) {
  showToast(`❌ ${message}`, true);
}

// Show toast notification
function showToast(message: string, isError: boolean = false) {
  const toast = document.createElement("div");
  toast.className = `toast ${isError ? "error" : ""}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Hide loading overlay
function hideLoading() {
  document.getElementById("loadingOverlay")!.classList.add("hidden");
}

// Setup event listeners
function setupEventListeners() {
  // Draw button
  document.getElementById("drawBtn")!.onclick = () => {
    drawCards();
  };

  // Color picker buttons
  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const color = (e.target as HTMLElement).dataset.color;
      if (pendingWildCardIndex !== null && color) {
        playCard(pendingWildCardIndex, color);
        hideColorPicker();
      }
    });
  });

  // Color picker overlay (click to cancel)
  document.getElementById("colorPickerOverlay")?.addEventListener("click", () => {
    hideColorPicker();
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
