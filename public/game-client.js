// public/game-client.ts
var ws = null;
var yourPlayerId = null;
var roomCode = null;
var pendingWildCardIndex = null;
var currentGameState = null;
function init() {
  const params = new URLSearchParams(window.location.search);
  roomCode = params.get("room");
  yourPlayerId = params.get("player");
  if (!roomCode || !yourPlayerId) {
    alert("Missing room or player ID");
    window.location.href = "/";
    return;
  }
  document.getElementById("roomBadge").textContent = roomCode;
  connectWebSocket();
  setupEventListeners();
}
function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  ws = new WebSocket(`${protocol}//${host}/ws`);
  ws.onopen = () => {
    console.log("✅ Connected to game");
    hideLoading();
  };
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleMessage(data);
  };
  ws.onerror = (err) => {
    console.error("❌ WebSocket error:", err);
    showError("Connection error");
  };
  ws.onclose = () => {
    console.log("\uD83D\uDD0C Disconnected");
    showError("Disconnected from server");
  };
}
function handleMessage(data) {
  console.log("\uD83D\uDCE9 Received:", data);
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
function renderGameState(state, playerId) {
  yourPlayerId = playerId;
  if (state.winner) {
    const winner = state.players.find((p) => p.id === state.winner);
    showGameOver(winner.name);
    return;
  }
  const isYourTurn = state.currentPlayerId === yourPlayerId;
  const turnIndicator = document.getElementById("turnIndicator");
  if (isYourTurn) {
    turnIndicator.textContent = "\uD83C\uDFAF Your turn!";
    turnIndicator.className = "turn-indicator your-turn";
  } else {
    const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
    turnIndicator.textContent = `${currentPlayer?.name}'s turn`;
    turnIndicator.className = "turn-indicator";
  }
  renderOpponents(state.players, state.currentPlayerId, yourPlayerId);
  renderTopCard(state.topCard, state.lastPlayedColor);
  const yourPlayer = state.players.find((p) => p.id === yourPlayerId);
  if (yourPlayer && yourPlayer.hand) {
    renderHand(yourPlayer.hand, state.topCard, state, isYourTurn);
  }
  if (state.pendingDraws > 0) {
    document.getElementById("pendingAlert").classList.remove("hidden");
    document.getElementById("pendingCount").textContent = `+${state.pendingDraws}`;
  } else {
    document.getElementById("pendingAlert").classList.add("hidden");
  }
  const arrow = state.direction === 1 ? "→" : "←";
  document.getElementById("directionArrow").textContent = arrow;
  const drawBtn = document.getElementById("drawBtn");
  drawBtn.disabled = !isYourTurn;
}
function renderOpponents(players, currentPlayerId, yourId) {
  const container = document.getElementById("opponentsList");
  container.innerHTML = "";
  players.filter((p) => p.id !== yourId).forEach((player) => {
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
function renderHand(hand, topCard, state, isYourTurn) {
  const container = document.getElementById("handCards");
  container.innerHTML = "";
  if (hand.length === 0) {
    container.innerHTML = '<p class="empty-hand">No cards</p>';
  }
  hand.forEach((card, index) => {
    const cardEl = createCardElement(card);
    cardEl.dataset.index = index.toString();
    if (isYourTurn && canPlayCardClient(card, topCard, state)) {
      cardEl.classList.add("playable");
      cardEl.onclick = () => handleCardClick(index, card);
    } else {
      cardEl.classList.add("unplayable");
    }
    container.appendChild(cardEl);
  });
  document.getElementById("cardCount").textContent = hand.length.toString();
}
function createCardElement(card) {
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
      content = `<span class="card-value">\uD83D\uDD04</span><span class="card-type">REV</span>`;
      break;
  }
  div.innerHTML = content;
  return div;
}
function renderTopCard(card, lastColor) {
  const topCard = document.getElementById("topCard");
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
      content = `<span class="card-value">\uD83D\uDD04</span>`;
      break;
  }
  topCard.innerHTML = content;
}
function handleCardClick(index, card) {
  if (card.type === "wild") {
    pendingWildCardIndex = index;
    showColorPicker();
  } else {
    playCard(index);
  }
}
function playCard(index, chosenColor) {
  if (!ws)
    return;
  ws.send(JSON.stringify({
    action: "play",
    cardIndex: index,
    chosenColor
  }));
}
function drawCards() {
  if (!ws)
    return;
  ws.send(JSON.stringify({
    action: "draw"
  }));
}
function handleCardDrawn(cards, forced) {
  console.log(`Drew ${cards.length} card(s)`, forced ? "(forced)" : "");
  const message = forced ? `Drew ${cards.length} cards from plus-stack!` : `Drew ${cards.length} card${cards.length !== 1 ? "s" : ""}`;
  showToast(message);
}
function canPlayCardClient(card, topCard, state) {
  if (state.pendingDraws > 0) {
    return card.type === "plus2" || card.type === "plus4" || card.type === "plus20";
  }
  if (card.type === "wild")
    return true;
  if ((card.type === "plus2" || card.type === "plus4" || card.type === "plus20") && (topCard.type === "plus2" || topCard.type === "plus4" || topCard.type === "plus20")) {
    return true;
  }
  if (card.type === "reverse" && state.reverseStackCount >= 4) {
    return false;
  }
  const targetColor = topCard.type === "wild" && state.lastPlayedColor ? state.lastPlayedColor : topCard.color;
  if (card.color === targetColor)
    return true;
  if (card.type === "number" && topCard.type === "number" && card.value === topCard.value) {
    return true;
  }
  return false;
}
function showColorPicker() {
  document.getElementById("colorPicker").classList.remove("hidden");
}
function hideColorPicker() {
  document.getElementById("colorPicker").classList.add("hidden");
  pendingWildCardIndex = null;
}
function showGameOver(winnerName) {
  document.getElementById("winnerName").textContent = winnerName;
  document.getElementById("gameOver").classList.remove("hidden");
}
function showError(message) {
  showToast(`❌ ${message}`, true);
}
function showToast(message, isError = false) {
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
function hideLoading() {
  document.getElementById("loadingOverlay").classList.add("hidden");
}
function setupEventListeners() {
  document.getElementById("drawBtn").onclick = () => {
    drawCards();
  };
  document.querySelectorAll(".color-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const color = e.target.dataset.color;
      if (pendingWildCardIndex !== null && color) {
        playCard(pendingWildCardIndex, color);
        hideColorPicker();
      }
    });
  });
  document.getElementById("colorPickerOverlay")?.addEventListener("click", () => {
    hideColorPicker();
  });
  document.getElementById("backToLobbyBtn").onclick = () => {
    window.location.href = "/";
  };
  document.getElementById("menuBtn").onclick = () => {
    if (confirm("Leave game and return to lobby?")) {
      window.location.href = "/";
    }
  };
}
init();
