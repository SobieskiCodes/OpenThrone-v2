/**
 * Event emitted when player state changes (economy, level, units, etc.)
 * Gateway listens to this and broadcasts to player's WebSocket room
 */
export class PlayerStateChangedEvent {
  playerId: string;

  // Economy
  gold?: bigint;
  goldInBank?: bigint;
  attackTurns?: number;

  // Stats
  level?: number;
  experience?: bigint;

  // Units (summary for instant updates)
  totalUnits?: number;
  unitsByType?: Record<string, number>; // { OFFENSE: 100, DEFENSE: 50 }

  // Proficiencies
  availablePoints?: number;

  // Buildings
  buildings?: Record<string, number>; // { FORTIFICATION: 3, ARMORY: 2 }
  availableUpgrades?: number;

  // Mail
  unreadMail?: number;

  constructor(partial: Partial<PlayerStateChangedEvent>) {
    Object.assign(this, partial);
  }
}
