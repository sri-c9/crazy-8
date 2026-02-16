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

// Render functions
function renderRoomList(rooms: any[]) {
  if (rooms.length === 0) {
    elements.roomsList.innerHTML = '<p class="empty-state">No active rooms</p>';
    return;
  }

  elements.roomsList.innerHTML = rooms.map(room => {
    const isWatching = room.roomCode === watchingRoomCode;
    const avatars = room.players.map((p: any) => p.avatar).join(" ");

    return `
      <div class="room-card ${isWatching ? 'watching' : ''}" data-room-code="${room.roomCode}">
        <div class="room-card-left">
          <span class="room-card-code">${room.roomCode}</span>
          <span class="room-card-status ${room.gameStatus}">${room.gameStatus}</span>
        </div>
        <div class="room-card-right">
          <span class="room-card-players">${room.playerCount} players</span>
          <span class="room-card-avatars">${avatars}</span>
        </div>
      </div>
    `;
  }).join("");

  // Add click handlers
  document.querySelectorAll(".room-card").forEach(card => {
    card.addEventListener("click", () => {
      const roomCode = card.getAttribute("data-room-code");
      if (roomCode) watchRoom(roomCode);
    });
  });
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
  elements.playersGrid.innerHTML = players.map(player => {
    const isCurrent = player.id === currentPlayerId;
    const isDisconnected = !player.connected;

    return `
      <div class="player-card ${isCurrent ? 'current-turn' : ''} ${isDisconnected ? 'disconnected' : ''}">
        <div class="player-avatar">${player.avatar}</div>
        <div class="player-info">
          <div class="player-name">${player.name}</div>
          <div class="player-meta">
            ${player.isHost ? '<span class="host-badge">👑 Host</span>' : ''}
            <span class="card-count">${player.cardCount} cards</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function updatePlayerDropdowns(players: any[]) {
  const playerOptions = players.map(p =>
    `<option value="${p.id}">${p.avatar} ${p.name}</option>`
  ).join("");

  elements.giveCardPlayer.innerHTML = '<option value="">Select player...</option>' + playerOptions;
  elements.forceDrawPlayer.innerHTML = '<option value="">Select player...</option>' + playerOptions;
  elements.setPlayerSelect.innerHTML = '<option value="">Select player...</option>' + playerOptions;
  elements.kickPlayerSelect.innerHTML = '<option value="">Select player...</option>' + playerOptions;
}

function renderAllHands(hands: Record<string, any[]>) {
  if (!currentRoomState) return;

  elements.allHandsContainer.innerHTML = Object.entries(hands).map(([playerId, cards]) => {
    const player = currentRoomState.players.find((p: any) => p.id === playerId);
    if (!player) return "";

    return `
      <div class="hand-row">
        <div class="hand-header">
          <span>${player.avatar} ${player.name}</span>
          <span style="color: #666;">(${cards.length} cards)</span>
        </div>
        <div class="hand-cards">
          ${cards.map((card, idx) => renderMiniCard(card, playerId, idx)).join("")}
        </div>
      </div>
    `;
  }).join("");

  // Add remove card handlers
  document.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const playerId = btn.getAttribute("data-player-id");
      const cardIndex = parseInt(btn.getAttribute("data-card-index") || "0");
      if (playerId) {
        sendAction("adminRemoveCard", { playerId, cardIndex });
      }
    });
  });
}

function renderMiniCard(card: any, playerId: string, cardIndex: number): string {
  const colorClass = getCardColorClass(card);
  const cardText = cardToString(card);

  return `
    <div class="mini-card ${colorClass}">
      ${cardText}
      <button class="remove-btn" data-player-id="${playerId}" data-card-index="${cardIndex}">×</button>
    </div>
  `;
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
  entry.innerHTML = `<span class="log-time">${time}</span>${message}`;
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
