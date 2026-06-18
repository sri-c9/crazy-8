import { playCard, startGame } from "./game-logic";
import { type Room, GameStatus, type Player } from "./room-manager";
import { type Card } from "./cards";

function makePlayer(id: string, name: string, hand: Card[]): Player {
  return {
    id,
    sessionToken: "tok-" + id,
    name,
    avatar: "🧪",
    connected: true,
    hand,
  };
}

function makeTestRoom(): Room {
  return {
    code: "TEST",
    players: new Map<string, Player>(),
    hostId: "p1",
    status: GameStatus.waiting,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    currentPlayerIndex: 0,
    direction: 1,
    discardPile: [],
    pendingDraws: 0,
    reverseStackCount: 0,
    lastPlayedColor: null,
  };
}

function cardOf(type: any, color?: any, value?: any): Card {
  if (type === "number") return { type, color, value };
  if (type === "wild") return { type, chosenColor: null };
  if (type === "plus2") return { type, color };
  if (type === "plus4") return { type };
  if (type === "plus20") return { type };
  if (type === "plus20color") return { type, color };
  if (type === "skip") return { type, color };
  if (type === "reverse") return { type, color };
  if (type === "swap") return { type, color };
  if (type === "pickswap") return { type, color };
  if (type === "wildpickswap") return { type };
  if (type === "nope") return { type, color };
  if (type === "rotate") return { type, color };
  if (type === "steal") return { type, color };
  throw new Error("unknown type " + type);
}

function main() {
  const room = makeTestRoom();

  // 3 players
  room.players.set("p1", makePlayer("p1", "Alice", [cardOf("swap", "red")]));
  room.players.set("p2", makePlayer("p2", "Bob", [cardOf("number", "blue", 5), cardOf("number", "blue", 6)]));
  room.players.set("p3", makePlayer("p3", "Carol", [cardOf("number", "green", 3)]));

  // Set up discard pile
  room.discardPile = [cardOf("number", "red", 2)];
  room.status = GameStatus.playing;
  room.lastPlayedColor = "red";

  console.log("Before swap:");
  console.log("  p1 hand:", JSON.stringify(room.players.get("p1")!.hand));
  console.log("  p2 hand:", JSON.stringify(room.players.get("p2")!.hand));
  console.log("  currentPlayerIndex:", room.currentPlayerIndex);

  playCard(room, "p1", 0);

  console.log("After swap:");
  console.log("  p1 hand:", JSON.stringify(room.players.get("p1")!.hand));
  console.log("  p2 hand:", JSON.stringify(room.players.get("p2")!.hand));
  console.log("  currentPlayerIndex:", room.currentPlayerIndex);
  console.log("  currentPlayer:", Array.from(room.players.keys())[room.currentPlayerIndex]);

  // Pickswap test
  room.players.clear();
  room.players.set("p1", makePlayer("p1", "Alice", [cardOf("pickswap", "red")]));
  room.players.set("p2", makePlayer("p2", "Bob", [cardOf("number", "blue", 5)]));
  room.players.set("p3", makePlayer("p3", "Carol", [cardOf("number", "green", 3)]));
  room.discardPile = [cardOf("number", "red", 2)];
  room.status = GameStatus.playing;
  room.currentPlayerIndex = 0;
  room.direction = 1;
  room.lastPlayedColor = "red";

  console.log("\nBefore pickswap:");
  console.log("  p1 hand:", JSON.stringify(room.players.get("p1")!.hand));
  console.log("  p3 hand:", JSON.stringify(room.players.get("p3")!.hand));

  playCard(room, "p1", 0, undefined, "p3");

  console.log("After pickswap (target p3):");
  console.log("  p1 hand:", JSON.stringify(room.players.get("p1")!.hand));
  console.log("  p3 hand:", JSON.stringify(room.players.get("p3")!.hand));
}

main();
