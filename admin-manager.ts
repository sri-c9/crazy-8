// Admin Manager - God mode power management

interface GodModePowers {
  seeAllHands: boolean;
  manipulateCards: boolean;
  controlTurns: boolean;
  roomControl: boolean;
}

interface AdminSession {
  watchedRoom: string | null;
  powers: GodModePowers;
}

const adminSessions = new Map<string, AdminSession>();

// Create admin session
export function createAdminSession(adminId: string): void {
  adminSessions.set(adminId, {
    watchedRoom: null,
    powers: {
      seeAllHands: false,
      manipulateCards: false,
      controlTurns: false,
      roomControl: false,
    },
  });
}

// Toggle a god mode power
export function togglePower(adminId: string, power: keyof GodModePowers): boolean {
  const session = adminSessions.get(adminId);
  if (!session) {
    throw new Error("Admin session not found");
  }

  session.powers[power] = !session.powers[power];
  return session.powers[power];
}

// Check if admin has a specific power enabled
export function hasPower(adminId: string, power: keyof GodModePowers): boolean {
  const session = adminSessions.get(adminId);
  return session?.powers[power] || false;
}

// Set watched room
export function setWatchedRoom(adminId: string, roomCode: string | null): void {
  const session = adminSessions.get(adminId);
  if (!session) {
    throw new Error("Admin session not found");
  }
  session.watchedRoom = roomCode;
}

// Get watched room
export function getWatchedRoom(adminId: string): string | null {
  return adminSessions.get(adminId)?.watchedRoom || null;
}

// Get admin session
export function getAdminSession(adminId: string): AdminSession | undefined {
  return adminSessions.get(adminId);
}

// Validate admin has power before action
export function validatePower(adminId: string, power: keyof GodModePowers): void {
  if (!hasPower(adminId, power)) {
    throw new Error(`Power "${power}" is not enabled`);
  }
}
