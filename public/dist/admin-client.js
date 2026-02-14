// public/admin-client.ts
var ws = null;
var reconnectAttempts = 0;
var MAX_RECONNECT_ATTEMPTS = 5;
var watchingRoomCode = null;
var currentRoomState = null;
var allHands = {};
var elements = {
  statusDot: document.getElementById("admin-status-dot"),
  statusText: document.getElementById("admin-status-text"),
  roomsList: document.getElementById("rooms-list"),
  refreshBtn: document.getElementById("refresh-rooms-btn"),
  watchedPanel: document.getElementById("watched-room-panel"),
  watchedCode: document.getElementById("watched-room-code"),
  watchedStatus: document.getElementById("watched-room-status"),
  watchedDirection: document.getElementById("watched-direction"),
  watchedPending: document.getElementById("watched-pending"),
  unwatchBtn: document.getElementById("unwatch-btn"),
  playersGrid: document.getElementById("players-grid"),
  turnInfo: document.getElementById("turn-info"),
  currentTurnText: document.getElementById("current-turn-text"),
  actionLog: document.getElementById("action-log"),
  handsPanel: document.getElementById("hands-panel"),
  allHandsContainer: document.getElementById("all-hands-container"),
  manipulatePanel: document.getElementById("manipulate-panel"),
  giveCardPlayer: document.getElementById("give-card-player"),
  giveCardType: document.getElementById("give-card-type"),
  giveCardColor: document.getElementById("give-card-color"),
  giveCardValue: document.getElementById("give-card-value"),
  giveCardBtn: document.getElementById("give-card-btn"),
  topCardType: document.getElementById("top-card-type"),
  topCardColor: document.getElementById("top-card-color"),
  topCardValue: document.getElementById("top-card-value"),
  setTopCardBtn: document.getElementById("set-top-card-btn"),
  turnsPanel: document.getElementById("turns-panel"),
  skipTurnBtn: document.getElementById("skip-turn-btn"),
  reverseDirBtn: document.getElementById("reverse-dir-btn"),
  forceDrawPlayer: document.getElementById("force-draw-player"),
  forceDrawCount: document.getElementById("force-draw-count"),
  forceDrawBtn: document.getElementById("force-draw-btn"),
  setPlayerSelect: document.getElementById("set-player-select"),
  setPlayerBtn: document.getElementById("set-player-btn"),
  roomControlPanel: document.getElementById("room-control-panel"),
  kickPlayerSelect: document.getElementById("kick-player-select"),
  kickPlayerBtn: document.getElementById("kick-player-btn"),
  forceStartBtn: document.getElementById("force-start-btn"),
  endGameBtn: document.getElementById("end-game-btn")
};
function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws?admin=true`;
  ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    console.log("Admin WebSocket connected");
    updateConnectionStatus(true);
    reconnectAttempts = 0;
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
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 1e4);
  logAction(`Reconnecting in ${delay / 1000}s...`, "info");
  setTimeout(connectWebSocket, delay);
}
function updateConnectionStatus(connected) {
  if (connected) {
    elements.statusDot.className = "status-dot connected";
    elements.statusText.textContent = "Connected";
  } else {
    elements.statusDot.className = "status-dot disconnected";
    elements.statusText.textContent = "Disconnected";
  }
}
function handleMessage(data) {
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
      if (watchingRoomCode) {}
      break;
    case "error":
      logAction(`Error: ${data.message}`, "error");
      break;
    default:
      console.log("Unknown message type:", data.type);
  }
}
function sendAction(action, payload = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    logAction("Not connected to server", "error");
    return;
  }
  ws.send(JSON.stringify({ action, ...payload }));
}
function requestRoomList() {
  sendAction("adminListRooms");
}
function watchRoom(roomCode) {
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
  elements.handsPanel.style.display = "none";
  elements.manipulatePanel.style.display = "none";
  elements.turnsPanel.style.display = "none";
  elements.roomControlPanel.style.display = "none";
  document.querySelectorAll(".power-toggle input").forEach((input) => {
    input.checked = false;
  });
}
function togglePower(power) {
  sendAction("adminTogglePower", { power });
}
function renderRoomList(rooms) {
  if (rooms.length === 0) {
    elements.roomsList.innerHTML = '<p class="empty-state">No active rooms</p>';
    return;
  }
  elements.roomsList.innerHTML = rooms.map((room) => {
    const isWatching = room.roomCode === watchingRoomCode;
    const avatars = room.players.map((p) => p.avatar).join(" ");
    return `
      <div class="room-card ${isWatching ? "watching" : ""}" data-room-code="${room.roomCode}">
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
  document.querySelectorAll(".room-card").forEach((card) => {
    card.addEventListener("click", () => {
      const roomCode = card.getAttribute("data-room-code");
      if (roomCode)
        watchRoom(roomCode);
    });
  });
}
function renderRoomState(room) {
  elements.watchedStatus.textContent = room.gameStatus;
  elements.watchedStatus.className = `room-status-badge ${room.gameStatus}`;
  if (room.gameStatus === "playing") {
    elements.watchedDirection.textContent = room.direction === 1 ? "↻" : "↺";
    elements.watchedDirection.title = room.direction === 1 ? "Clockwise" : "Counter-clockwise";
  } else {
    elements.watchedDirection.textContent = "";
  }
  if (room.pendingDraws > 0) {
    elements.watchedPending.textContent = `+${room.pendingDraws}`;
    elements.watchedPending.style.display = "inline-block";
  } else {
    elements.watchedPending.style.display = "none";
  }
  renderPlayers(room.players, room.currentPlayerId);
  if (room.gameStatus === "playing" && room.currentPlayerId) {
    const currentPlayer = room.players.find((p) => p.id === room.currentPlayerId);
    if (currentPlayer) {
      elements.currentTurnText.textContent = `${currentPlayer.avatar} ${currentPlayer.name}'s turn`;
      elements.turnInfo.style.display = "block";
    }
  } else {
    elements.turnInfo.style.display = "none";
  }
  updatePlayerDropdowns(room.players);
}
function renderPlayers(players, currentPlayerId) {
  elements.playersGrid.innerHTML = players.map((player) => {
    const isCurrent = player.id === currentPlayerId;
    const isDisconnected = !player.connected;
    return `
      <div class="player-card ${isCurrent ? "current-turn" : ""} ${isDisconnected ? "disconnected" : ""}">
        <div class="player-avatar">${player.avatar}</div>
        <div class="player-info">
          <div class="player-name">${player.name}</div>
          <div class="player-meta">
            ${player.isHost ? '<span class="host-badge">\uD83D\uDC51 Host</span>' : ""}
            <span class="card-count">${player.cardCount} cards</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}
function updatePlayerDropdowns(players) {
  const playerOptions = players.map((p) => `<option value="${p.id}">${p.avatar} ${p.name}</option>`).join("");
  elements.giveCardPlayer.innerHTML = '<option value="">Select player...</option>' + playerOptions;
  elements.forceDrawPlayer.innerHTML = '<option value="">Select player...</option>' + playerOptions;
  elements.setPlayerSelect.innerHTML = '<option value="">Select player...</option>' + playerOptions;
  elements.kickPlayerSelect.innerHTML = '<option value="">Select player...</option>' + playerOptions;
}
function renderAllHands(hands) {
  if (!currentRoomState)
    return;
  elements.allHandsContainer.innerHTML = Object.entries(hands).map(([playerId, cards]) => {
    const player = currentRoomState.players.find((p) => p.id === playerId);
    if (!player)
      return "";
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
  document.querySelectorAll(".remove-btn").forEach((btn) => {
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
function renderMiniCard(card, playerId, cardIndex) {
  const colorClass = getCardColorClass(card);
  const cardText = cardToString(card);
  return `
    <div class="mini-card ${colorClass}">
      ${cardText}
      <button class="remove-btn" data-player-id="${playerId}" data-card-index="${cardIndex}">×</button>
    </div>
  `;
}
function getCardColorClass(card) {
  if (card.type === "wild")
    return "wild";
  if (card.type === "plus4" || card.type === "plus20")
    return card.type;
  return card.color || "";
}
function cardToString(card) {
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
      return "\uD83D\uDD04";
    default:
      return "?";
  }
}
function logAction(message, type = "info") {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span class="log-time">${time}</span>${message}`;
  elements.actionLog.prepend(entry);
  while (elements.actionLog.children.length > 50) {
    elements.actionLog.removeChild(elements.actionLog.lastChild);
  }
}
elements.refreshBtn.addEventListener("click", requestRoomList);
elements.unwatchBtn.addEventListener("click", unwatchRoom);
document.querySelectorAll(".power-toggle input").forEach((checkbox) => {
  checkbox.addEventListener("change", (e) => {
    const target = e.target;
    const power = target.getAttribute("data-power");
    if (power) {
      togglePower(power);
      const isChecked = target.checked;
      switch (power) {
        case "seeAllHands":
          elements.handsPanel.style.display = isChecked ? "block" : "none";
          if (isChecked)
            sendAction("adminGetAllHands");
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
  const card = { type };
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
elements.setTopCardBtn.addEventListener("click", () => {
  const type = elements.topCardType.value;
  const card = { type };
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
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    requestRoomList();
  }
}, 5000);
connectWebSocket();
