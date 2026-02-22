// Admin Client — Insane Crazy 8

// WebSocket connection
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Admin state
let watchingRoomCode: string | null = null;
let currentRoomState: any = null;
let allHands: Record<string, any[]> = {};

// UI Elements
const elements = {
  statusDot: document.getElementById("admin-status-dot") as HTMLElement,
  statusText: document.getElementById("admin-status-text") as HTMLElement,
  roomsList: document.getElementById("rooms-list") as HTMLElement,
  refreshBtn: document.getElementById("refresh-rooms-btn") as HTMLButtonElement,
  watchedPanel: document.getElementById("watched-room-panel") as HTMLElement,
  watchedCode: document.getElementById("watched-room-code") as HTMLElement,
  watchedStatus: document.getElementById("watched-room-status") as HTMLElement,
  watchedDirection: document.getElementById("watched-direction") as HTMLElement,
  watchedPending: document.getElementById("watched-pending") as HTMLElement,
  unwatchBtn: document.getElementById("unwatch-btn") as HTMLButtonElement,
  playersGrid: document.getElementById("players-grid") as HTMLElement,
  turnInfo: document.getElementById("turn-info") as HTMLElement,
  currentTurnText: document.getElementById("current-turn-text") as HTMLElement,
  actionLog: document.getElementById("action-log") as HTMLElement,

  // Hands panel
  handsPanel: document.getElementById("hands-panel") as HTMLElement,
  allHandsContainer: document.getElementById("all-hands-container") as HTMLElement,

  // Manipulate panel
  manipulatePanel: document.getElementById("manipulate-panel") as HTMLElement,
  giveCardPlayer: document.getElementById("give-card-player") as HTMLSelectElement,
  giveCardType: document.getElementById("give-card-type") as HTMLSelectElement,
  giveCardColor: document.getElementById("give-card-color") as HTMLSelectElement,
  giveCardValue: document.getElementById("give-card-value") as HTMLInputElement,
  giveCardBtn: document.getElementById("give-card-btn") as HTMLButtonElement,
  topCardType: document.getElementById("top-card-type") as HTMLSelectElement,
  topCardColor: document.getElementById("top-card-color") as HTMLSelectElement,
  topCardValue: document.getElementById("top-card-value") as HTMLInputElement,
  setTopCardBtn: document.getElementById("set-top-card-btn") as HTMLButtonElement,

  // Turns panel
  turnsPanel: document.getElementById("turns-panel") as HTMLElement,
  skipTurnBtn: document.getElementById("skip-turn-btn") as HTMLButtonElement,
  reverseDirBtn: document.getElementById("reverse-dir-btn") as HTMLButtonElement,
  forceDrawPlayer: document.getElementById("force-draw-player") as HTMLSelectElement,
  forceDrawCount: document.getElementById("force-draw-count") as HTMLInputElement,
  forceDrawBtn: document.getElementById("force-draw-btn") as HTMLButtonElement,
  setPlayerSelect: document.getElementById("set-player-select") as HTMLSelectElement,
  setPlayerBtn: document.getElementById("set-player-btn") as HTMLButtonElement,

  // Room control panel
  roomControlPanel: document.getElementById("room-control-panel") as HTMLElement,
  kickPlayerSelect: document.getElementById("kick-player-select") as HTMLSelectElement,
  kickPlayerBtn: document.getElementById("kick-player-btn") as HTMLButtonElement,
  forceStartBtn: document.getElementById("force-start-btn") as HTMLButtonElement,
  endGameBtn: document.getElementById("end-game-btn") as HTMLButtonElement,
};

// Initialize WebSocket
function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws?admin=true`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("Admin WebSocket connected");
    updateConnectionStatus(true);
    reconnectAttempts = 0;

    // Request room list on connect
    requestRoomList();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data);
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  };

  ws.onclose = () => {
    console.log("Admin WebSocket disconnected");
    updateConnectionStatus(false);
    attemptReconnect();
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
}

function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logAction("Max reconnect attempts reached", "error");
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);

  logAction(`Reconnecting in ${delay / 1000}s...`, "info");
  setTimeout(connectWebSocket, delay);
}

function updateConnectionStatus(connected: boolean) {
  if (connected) {
    elements.statusDot.className = "status-dot connected";
    elements.statusText.textContent = "Connected";
  } else {
    elements.statusDot.className = "status-dot disconnected";
    elements.statusText.textContent = "Disconnected";
  }
}

// Message handlers
function handleMessage(data: any) {
  switch (data.type) {
    case "adminRoomList":
      renderRoomList(data.rooms);
      break;

    case "adminRoomState":
      currentRoomState = data.room;
      renderRoomState(data.room);
      break;

    case "adminAllHands":
      allHands = data.hands;
      renderAllHands(data.hands);
      break;

    case "adminResult":
      if (data.success) {
        logAction(data.message, "success");
      } else {
        logAction(`Error: ${data.message}`, "error");
      }
      break;

    case "adminGameUpdate":
      // Refresh room state when game updates
      if (watchingRoomCode) {
        // State will be broadcast automatically
      }
      break;

    case "error":
      logAction(`Error: ${data.message}`, "error");
      break;

    default:
      console.log("Unknown message type:", data.type);
  }
}

// Send actions
function sendAction(action: string, payload: any = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    logAction("Not connected to server", "error");
    return;
  }

  ws.send(JSON.stringify({ action, ...payload }));
}

function requestRoomList() {
  sendAction("adminListRooms");
}

function watchRoom(roomCode: string) {
  sendAction("adminWatchRoom", { roomCode });
  watchingRoomCode = roomCode;
  elements.watchedPanel.style.display = "block";
  elements.watchedCode.textContent = roomCode;
}

function unwatchRoom() {
  sendAction("adminUnwatchRoom");
  watchingRoomCode = null;
  currentRoomState = null;
  allHands = {};
  elements.watchedPanel.style.display = "none";

  // Reset all power panels
  elements.handsPanel.style.display = "none";
  elements.manipulatePanel.style.display = "none";
  elements.turnsPanel.style.display = "none";
  elements.roomControlPanel.style.display = "none";

  // Uncheck all toggles
  document.querySelectorAll(".power-toggle input").forEach((input) => {
    (input as HTMLInputElement).checked = false;
  });
}

function togglePower(power: string) {
  sendAction("adminTogglePower", { power });
}

// Helper to create an element with optional class, text, and attributes
function el(tag: string, opts?: { className?: string; text?: string; attrs?: Record<string, string> }): HTMLElement {
  const elem = document.createElement(tag);
  if (opts?.className) elem.className = opts.className;
  if (opts?.text) elem.textContent = opts.text;
  if (opts?.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) elem.setAttribute(k, v);
  }
  return elem;
}

// Render functions
function renderRoomList(rooms: any[]) {
  elements.roomsList.innerHTML = "";

  if (rooms.length === 0) {
    const p = el("p", { className: "empty-state", text: "No active rooms" });
    elements.roomsList.appendChild(p);
    return;
  }

  for (const room of rooms) {
    const isWatching = room.roomCode === watchingRoomCode;
    const avatars = room.players.map((p: any) => p.avatar).join(" ");

    const card = el("div", { className: `room-card ${isWatching ? "watching" : ""}`, attrs: { "data-room-code": room.roomCode } });

    const left = el("div", { className: "room-card-left" });
    left.appendChild(el("span", { className: "room-card-code", text: room.roomCode }));
    left.appendChild(el("span", { className: `room-card-status ${room.gameStatus}`, text: room.gameStatus }));

    const right = el("div", { className: "room-card-right" });
    right.appendChild(el("span", { className: "room-card-players", text: `${room.playerCount} players` }));
    right.appendChild(el("span", { className: "room-card-avatars", text: avatars }));

    card.appendChild(left);
    card.appendChild(right);

    card.addEventListener("click", () => {
      const roomCode = card.getAttribute("data-room-code");
      if (roomCode) watchRoom(roomCode);
    });

    elements.roomsList.appendChild(card);
  }
}

function renderRoomState(room: any) {
  // Update status badge
  elements.watchedStatus.textContent = room.gameStatus;
  elements.watchedStatus.className = `room-status-badge ${room.gameStatus}`;

  // Update direction
  if (room.gameStatus === "playing") {
    elements.watchedDirection.textContent = room.direction === 1 ? "↻" : "↺";
    elements.watchedDirection.title = room.direction === 1 ? "Clockwise" : "Counter-clockwise";
  } else {
    elements.watchedDirection.textContent = "";
  }

  // Update pending draws
  if (room.pendingDraws > 0) {
    elements.watchedPending.textContent = `+${room.pendingDraws}`;
    elements.watchedPending.style.display = "inline-block";
  } else {
    elements.watchedPending.style.display = "none";
  }

  // Render players
  renderPlayers(room.players, room.currentPlayerId);

  // Update turn info
  if (room.gameStatus === "playing" && room.currentPlayerId) {
    const currentPlayer = room.players.find((p: any) => p.id === room.currentPlayerId);
    if (currentPlayer) {
      elements.currentTurnText.textContent = `${currentPlayer.avatar} ${currentPlayer.name}'s turn`;
      elements.turnInfo.style.display = "block";
    }
  } else {
    elements.turnInfo.style.display = "none";
  }

  // Update player dropdowns
  updatePlayerDropdowns(room.players);
}

function renderPlayers(players: any[], currentPlayerId: string | null) {
  elements.playersGrid.innerHTML = "";

  for (const player of players) {
    const isCurrent = player.id === currentPlayerId;
    const isDisconnected = !player.connected;

    const card = el("div", { className: `player-card ${isCurrent ? "current-turn" : ""} ${isDisconnected ? "disconnected" : ""}` });
    card.appendChild(el("div", { className: "player-avatar", text: player.avatar }));

    const info = el("div", { className: "player-info" });
    info.appendChild(el("div", { className: "player-name", text: player.name }));

    const meta = el("div", { className: "player-meta" });
    if (player.isHost) {
      meta.appendChild(el("span", { className: "host-badge", text: "\u{1F451} Host" }));
    }
    meta.appendChild(el("span", { className: "card-count", text: `${player.cardCount} cards` }));
    info.appendChild(meta);

    card.appendChild(info);
    elements.playersGrid.appendChild(card);
  }
}

function populatePlayerSelect(select: HTMLSelectElement, players: any[]) {
  select.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Select player...";
  select.appendChild(defaultOpt);

  for (const p of players) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.avatar} ${p.name}`;
    select.appendChild(opt);
  }
}

function updatePlayerDropdowns(players: any[]) {
  populatePlayerSelect(elements.giveCardPlayer, players);
  populatePlayerSelect(elements.forceDrawPlayer, players);
  populatePlayerSelect(elements.setPlayerSelect, players);
  populatePlayerSelect(elements.kickPlayerSelect, players);
}

function renderAllHands(hands: Record<string, any[]>) {
  if (!currentRoomState) return;

  elements.allHandsContainer.innerHTML = "";

  for (const [playerId, cards] of Object.entries(hands)) {
    const player = currentRoomState.players.find((p: any) => p.id === playerId);
    if (!player) continue;

    const row = el("div", { className: "hand-row" });

    const header = el("div", { className: "hand-header" });
    header.appendChild(el("span", { text: `${player.avatar} ${player.name}` }));
    header.appendChild(el("span", { text: `(${cards.length} cards)`, attrs: { style: "color: #666;" } }));
    row.appendChild(header);

    const cardsContainer = el("div", { className: "hand-cards" });
    cards.forEach((card, idx) => {
      cardsContainer.appendChild(renderMiniCard(card, playerId, idx));
    });
    row.appendChild(cardsContainer);

    elements.allHandsContainer.appendChild(row);
  }
}

function renderMiniCard(card: any, playerId: string, cardIndex: number): HTMLElement {
  const colorClass = getCardColorClass(card);
  const cardText = cardToString(card);

  const miniCard = el("div", { className: `mini-card ${colorClass}` });
  miniCard.appendChild(document.createTextNode(cardText));

  const removeBtn = el("button", { className: "remove-btn", text: "\u00d7", attrs: { "data-player-id": playerId, "data-card-index": String(cardIndex) } });
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sendAction("adminRemoveCard", { playerId, cardIndex });
  });
  miniCard.appendChild(removeBtn);

  return miniCard;
}

function getCardColorClass(card: any): string {
  if (card.type === "wild") return "wild";
  if (card.type === "plus4" || card.type === "plus20") return card.type;
  return card.color || "";
}

function cardToString(card: any): string {
  switch (card.type) {
    case "number":
      return card.value.toString();
    case "wild":
      return "8";
    case "plus2":
      return "+2";
    case "plus4":
      return "+4";
    case "plus20":
      return "+20";
    case "skip":
      return "⏭";
    case "reverse":
      return "🔄";
    default:
      return "?";
  }
}

function logAction(message: string, type: "success" | "error" | "info" = "info") {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  const timeSpan = el("span", { className: "log-time", text: time });
  entry.appendChild(timeSpan);
  entry.appendChild(document.createTextNode(message));
  elements.actionLog.prepend(entry);

  // Keep only last 50 entries
  while (elements.actionLog.children.length > 50) {
    elements.actionLog.removeChild(elements.actionLog.lastChild!);
  }
}

// Event listeners
elements.refreshBtn.addEventListener("click", requestRoomList);
elements.unwatchBtn.addEventListener("click", unwatchRoom);

// Power toggles
document.querySelectorAll(".power-toggle input").forEach(checkbox => {
  checkbox.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    const power = target.getAttribute("data-power");
    if (power) {
      togglePower(power);

      // Show/hide corresponding panel
      const isChecked = target.checked;
      switch (power) {
        case "seeAllHands":
          elements.handsPanel.style.display = isChecked ? "block" : "none";
          if (isChecked) sendAction("adminGetAllHands");
          break;
        case "manipulateCards":
          elements.manipulatePanel.style.display = isChecked ? "block" : "none";
          break;
        case "controlTurns":
          elements.turnsPanel.style.display = isChecked ? "block" : "none";
          break;
        case "roomControl":
          elements.roomControlPanel.style.display = isChecked ? "block" : "none";
          break;
      }
    }
  });
});

// Card type change handlers (show/hide color/value inputs)
elements.giveCardType.addEventListener("change", () => {
  const type = elements.giveCardType.value;
  const needsColor = ["number", "plus2", "skip", "reverse"].includes(type);
  const needsValue = type === "number";

  elements.giveCardColor.style.display = needsColor ? "block" : "none";
  elements.giveCardValue.style.display = needsValue ? "block" : "none";
});

elements.topCardType.addEventListener("change", () => {
  const type = elements.topCardType.value;
  const needsColor = ["number", "plus2", "skip", "reverse"].includes(type);
  const needsValue = type === "number";

  elements.topCardColor.style.display = needsColor ? "block" : "none";
  elements.topCardValue.style.display = needsValue ? "block" : "none";
});

// Give card action
elements.giveCardBtn.addEventListener("click", () => {
  const playerId = elements.giveCardPlayer.value;
  if (!playerId) {
    logAction("Select a player", "error");
    return;
  }

  const type = elements.giveCardType.value;

  if (type === "random") {
    sendAction("adminGiveCard", { playerId });
    return;
  }

  const card: any = { type };

  if (["number", "plus2", "skip", "reverse"].includes(type)) {
    card.color = elements.giveCardColor.value;
  }

  if (type === "number") {
    const value = parseInt(elements.giveCardValue.value);
    if (isNaN(value) || value < 0 || value > 9) {
      logAction("Invalid card value (0-9)", "error");
      return;
    }
    card.value = value;
  }

  sendAction("adminGiveCard", { playerId, card });
});

// Set top card action
elements.setTopCardBtn.addEventListener("click", () => {
  const type = elements.topCardType.value;
  const card: any = { type };

  if (["number", "plus2", "skip", "reverse"].includes(type)) {
    card.color = elements.topCardColor.value;
  }

  if (type === "number") {
    const value = parseInt(elements.topCardValue.value);
    if (isNaN(value) || value < 0 || value > 9) {
      logAction("Invalid card value (0-9)", "error");
      return;
    }
    card.value = value;
  }

  if (type === "wild") {
    card.chosenColor = null;
  }

  sendAction("adminSetTopCard", { card });
});

// Turn control actions
elements.skipTurnBtn.addEventListener("click", () => {
  sendAction("adminSkipTurn");
});

elements.reverseDirBtn.addEventListener("click", () => {
  sendAction("adminReverseDirection");
});

elements.forceDrawBtn.addEventListener("click", () => {
  const playerId = elements.forceDrawPlayer.value;
  const count = parseInt(elements.forceDrawCount.value);

  if (!playerId) {
    logAction("Select a player", "error");
    return;
  }

  if (isNaN(count) || count < 1) {
    logAction("Invalid draw count", "error");
    return;
  }

  sendAction("adminForceDraw", { playerId, count });
});

elements.setPlayerBtn.addEventListener("click", () => {
  const playerId = elements.setPlayerSelect.value;

  if (!playerId) {
    logAction("Select a player", "error");
    return;
  }

  sendAction("adminSetCurrentPlayer", { playerId });
});

// Room control actions
elements.kickPlayerBtn.addEventListener("click", () => {
  const playerId = elements.kickPlayerSelect.value;

  if (!playerId) {
    logAction("Select a player", "error");
    return;
  }

  if (confirm("Are you sure you want to kick this player?")) {
    sendAction("adminKickPlayer", { playerId });
  }
});

elements.forceStartBtn.addEventListener("click", () => {
  if (confirm("Force-start game (bypasses 3-player minimum)?")) {
    sendAction("adminForceStart");
  }
});

elements.endGameBtn.addEventListener("click", () => {
  if (confirm("End the current game?")) {
    sendAction("adminEndGame");
  }
});

// Auto-refresh room list every 5 seconds
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    requestRoomList();
  }
}, 5000);

// Initialize connection on load
connectWebSocket();
