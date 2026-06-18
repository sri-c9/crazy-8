// Pure turn-order helpers shared by the game client.
// `players` is the server's stable rotation order; `direction` is +1 or -1.

export interface SeatedPlayer<T extends { id: string }> {
  player: T;
  isCurrent: boolean;
  isNext: boolean;
}

// The id of the player who acts immediately after the current player, honoring
// direction and wrapping around the table. Returns null if the current player
// is not in the list.
export function getNextPlayerId<T extends { id: string }>(
  players: T[],
  currentPlayerId: string,
  direction: number
): string | null {
  const count = players.length;
  if (count === 0) return null;
  const currentIndex = players.findIndex((p) => p.id === currentPlayerId);
  if (currentIndex === -1) return null;
  const step = direction >= 0 ? 1 : -1;
  const nextIndex = (currentIndex + step + count) % count;
  return players[nextIndex].id;
}

// Opponents (everyone except you) in fixed rotation order, walking the stable
// players array forward (cyclically) starting just after your seat. Seating is
// independent of direction — seats never move. Only isNext depends on direction.
export function seatOpponents<T extends { id: string }>(
  players: T[],
  yourId: string,
  currentPlayerId: string,
  direction: number
): SeatedPlayer<T>[] {
  const count = players.length;
  if (count === 0) return [];
  const yourIndex = players.findIndex((p) => p.id === yourId);
  const nextId = getNextPlayerId(players, currentPlayerId, direction);
  // If you're not in the list (spectator/edge), fall back to plain array order.
  const start = yourIndex === -1 ? 0 : yourIndex;

  const seats: SeatedPlayer<T>[] = [];
  for (let offset = 1; offset <= count; offset++) {
    const player = players[(start + offset) % count];
    if (player.id === yourId) continue;
    seats.push({
      player,
      isCurrent: player.id === currentPlayerId,
      isNext: player.id === nextId,
    });
  }
  return seats;
}
