// Game client - handles WebSocket connection, rendering, and user interactions

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
    console.log("✅ Connected to game");
    hideLoading();
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
    console.log("🔌 Disconnected");
    showError("Disconnected from server");
  };
}

// Handle incoming messages
function handleMessage(data: any) {
  console.log("📩 Received:", data);

  switch (data.type) {
    case "state":
      currentGameState = data.gameState;
      renderGameState(data.gameState, data.yourPlayerId);
      break;

    case "cardDrawn":
      handleCardDrawn(data.cards, data.forced);
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

  // Check for winner first
  if (state.winner) {
    const winner = state.players.find((p) => p.id === state.winner);
    showGameOver(winner!.name);
    return;
  }

  // Update turn indicator
  const isYourTurn = state.currentPlayerId === yourPlayerId;
  const turnIndicator = document.getElementById("turnIndicator")!;

  if (isYourTurn) {
    turnIndicator.textContent = "🎯 Your turn!";
    turnIndicator.className = "turn-indicator your-turn";
  } else {
    const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
    turnIndicator.textContent = `${currentPlayer?.name}'s turn`;
    turnIndicator.className = "turn-indicator";
  }

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
  const arrow = state.direction === 1 ? "→" : "←";
  document.getElementById("directionArrow")!.textContent = arrow;

  // Enable/disable draw button based on turn
  const drawBtn = document.getElementById("drawBtn") as HTMLButtonElement;
  drawBtn.disabled = !isYourTurn;
}

// Render opponents
function renderOpponents(
  players: Player[],
  currentPlayerId: string,
  yourId: string
) {
  const container = document.getElementById("opponentsList")!;
  container.innerHTML = "";

  players
    .filter((p) => p.id !== yourId)
    .forEach((player) => {
      const div = document.createElement("div");
      div.className = "opponent-card";
      if (player.id === currentPlayerId) {
        div.classList.add("current-turn");
      }
      if (!player.connected) {
        div.classList.add("disconnected");
      }

      div.innerHTML = `
        <div class="opponent-avatar">${player.avatar}</div>
        <div class="opponent-name">${player.name}</div>
        <div class="opponent-card-count">${player.cardCount} card${player.cardCount !== 1 ? "s" : ""}</div>
      `;

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
  }

  hand.forEach((card, index) => {
    const cardEl = createCardElement(card);
    cardEl.dataset.index = index.toString();

    // Highlight playable cards
    if (isYourTurn && canPlayCardClient(card, topCard, state)) {
      cardEl.classList.add("playable");
      cardEl.onclick = () => handleCardClick(index, card);
    } else {
      cardEl.classList.add("unplayable");
    }

    container.appendChild(cardEl);
  });

  document.getElementById("cardCount")!.textContent = hand.length.toString();
}

// Create card element
function createCardElement(card: Card): HTMLElement {
  const div = document.createElement("div");
  const color = card.color || card.chosenColor || "wild";
  div.className = `card ${color}`;

  let content = "";

  switch (card.type) {
    case "number":
      content = `<span class="card-value">${card.value}</span>`;
      break;
    case "wild":
      content = `<span class="card-value">8</span><span class="card-type">WILD</span>`;
      break;
    case "plus2":
      content = `<span class="card-value">+2</span>`;
      break;
    case "plus4":
      content = `<span class="card-value">+4</span>`;
      break;
    case "plus20":
      content = `<span class="card-value">+20</span>`;
      break;
    case "skip":
      content = `<span class="card-value">⏭️</span><span class="card-type">SKIP</span>`;
      break;
    case "reverse":
      content = `<span class="card-value">🔄</span><span class="card-type">REV</span>`;
      break;
  }

  div.innerHTML = content;
  return div;
}

// Render top card
function renderTopCard(card: Card, lastColor: string | null) {
  const topCard = document.getElementById("topCard")!;
  const displayColor = card.color || lastColor || "wild";
  topCard.className = `card ${displayColor}`;

  let content = "";

  switch (card.type) {
    case "number":
      content = `<span class="card-value">${card.value}</span>`;
      break;
    case "wild":
      content = `<span class="card-value">8</span>`;
      break;
    case "plus2":
      content = `<span class="card-value">+2</span>`;
      break;
    case "plus4":
      content = `<span class="card-value">+4</span>`;
      break;
    case "plus20":
      content = `<span class="card-value">+20</span>`;
      break;
    case "skip":
      content = `<span class="card-value">⏭️</span>`;
      break;
    case "reverse":
      content = `<span class="card-value">🔄</span>`;
      break;
  }

  topCard.innerHTML = content;
}

// Handle card click
function handleCardClick(index: number, card: Card) {
  if (card.type === "wild") {
    // Show color picker
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

  ws.send(
    JSON.stringify({
      action: "play",
      cardIndex: index,
      chosenColor,
    })
  );
}

// Draw card
function drawCards() {
  if (!ws) return;

  ws.send(
    JSON.stringify({
      action: "draw",
    })
  );
}

// Handle card drawn
function handleCardDrawn(cards: Card[], forced: boolean) {
  console.log(`Drew ${cards.length} card(s)`, forced ? "(forced)" : "");

  // Show toast
  const message = forced
    ? `Drew ${cards.length} cards from plus-stack!`
    : `Drew ${cards.length} card${cards.length !== 1 ? "s" : ""}`;

  showToast(message);
}

// Client-side validation (matches server logic)
function canPlayCardClient(card: Card, topCard: Card, state: GameState): boolean {
  // If pendingDraws > 0, only +cards can be played
  if (state.pendingDraws > 0) {
    return card.type === "plus2" || card.type === "plus4" || card.type === "plus20";
  }

  // Wild cards always playable
  if (card.type === "wild") return true;

  // +cards can stack on any +card
  if (
    (card.type === "plus2" || card.type === "plus4" || card.type === "plus20") &&
    (topCard.type === "plus2" || topCard.type === "plus4" || topCard.type === "plus20")
  ) {
    return true;
  }

  // Reverse limit
  if (card.type === "reverse" && state.reverseStackCount >= 4) {
    return false;
  }

  // Get target color
  const targetColor =
    topCard.type === "wild" && state.lastPlayedColor
      ? state.lastPlayedColor
      : topCard.color;

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
