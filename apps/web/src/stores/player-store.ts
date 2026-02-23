import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerState {
  // ─── Identity ────────────────────────────────────────────────────
  id: string;
  displayName: string;
  level: number;
  experience: string; // stored as string, use getExperience() for BigInt
  race: string;

  // ─── Economy ─────────────────────────────────────────────────────
  gold: string; // stored as string, use getGold() for BigInt
  goldInBank: string; // stored as string, use getGoldInBank() for BigInt
  attackTurns: number;

  // ─── Units (summary for header/nav) ──────────────────────────────
  totalUnits: number;
  citizens: number; // Explicit field for citizens (CITIZEN unit type)
  unitsByType: Record<string, number>; // { OFFENSE: 100, DEFENSE: 50 }

  // ─── Buildings ───────────────────────────────────────────────────
  buildings: Record<string, number>; // { FORTIFICATION: 3, ARMORY: 2 }

  // ─── Proficiencies ───────────────────────────────────────────────
  proficiencies: Record<string, number>; // { OFFENSE: 5, SPY: 3 }
  availablePoints: number;

  // ─── Items (equipped summary) ────────────────────────────────────
  equippedItems: Array<{ id: string; type: string; tier: number }>;

  // ─── Notifications ───────────────────────────────────────────────
  unreadMail: number;
  availableUpgrades: number;

  // ─── Actions ─────────────────────────────────────────────────────
  setState: (partial: Partial<Omit<PlayerState, 'setState' | 'mergeState' | 'addGold' | 'subtractGold' | 'setGold' | 'setGoldInBank' | 'setExperience' | 'getGold' | 'getGoldInBank' | 'getExperience' | 'setBuilding' | 'setProficiency' | 'reset'>>) => void;
  mergeState: (partial: Partial<Omit<PlayerState, 'setState' | 'mergeState' | 'addGold' | 'subtractGold' | 'setGold' | 'setGoldInBank' | 'setExperience' | 'getGold' | 'getGoldInBank' | 'getExperience' | 'setBuilding' | 'setProficiency' | 'reset'>>) => void;

  // BigInt helpers (accept/return BigInt, store as string)
  getGold: () => bigint;
  getGoldInBank: () => bigint;
  getExperience: () => bigint;
  setGold: (value: bigint) => void;
  setGoldInBank: (value: bigint) => void;
  setExperience: (value: bigint) => void;
  addGold: (delta: bigint) => void;
  subtractGold: (amount: bigint) => void;

  setBuilding: (type: string, level: number) => void;
  setProficiency: (type: string, level: number) => void;
  reset: () => void;

  // Helper to update from backend PlayerStateSnapshot
  updateFromSnapshot: (snapshot: any) => void;
}

const initialState = {
  id: '',
  displayName: '',
  level: 1,
  experience: '0',
  race: 'UNDEAD',
  gold: '0',
  goldInBank: '0',
  attackTurns: 0,
  totalUnits: 0,
  citizens: 0,
  unitsByType: {},
  buildings: {},
  proficiencies: {},
  availablePoints: 0,
  equippedItems: [],
  unreadMail: 0,
  availableUpgrades: 0,
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Full replace (for initial hydration)
      setState: (partial) => set(partial),

      // Merge delta (for WebSocket updates)
      mergeState: (partial) => set((state) => ({ ...state, ...partial })),

      // BigInt getters (convert string → BigInt)
      getGold: () => BigInt(get().gold),
      getGoldInBank: () => BigInt(get().goldInBank),
      getExperience: () => BigInt(get().experience),

      // BigInt setters (convert BigInt → string)
      setGold: (value) => set({ gold: value.toString() }),
      setGoldInBank: (value) => set({ goldInBank: value.toString() }),
      setExperience: (value) => set({ experience: value.toString() }),

      // Gold helpers (work with BigInt)
      addGold: (delta) => set((s) => ({ gold: (BigInt(s.gold) + delta).toString() })),
      subtractGold: (amount) => set((s) => ({ gold: (BigInt(s.gold) - amount).toString() })),

      // Building helpers
      setBuilding: (type, level) =>
        set((s) => ({
          buildings: { ...s.buildings, [type]: level },
        })),

      // Proficiency helpers
      setProficiency: (type, level) =>
        set((s) => ({
          proficiencies: { ...s.proficiencies, [type]: level },
        })),

      // Reset (logout)
      reset: () => set(initialState),

      // Update from backend PlayerStateSnapshot (handles all common fields)
      updateFromSnapshot: (snapshot) => {
        const updates: any = {};

        // Economy fields
        if (snapshot.gold) updates.gold = snapshot.gold;
        if (snapshot.goldInBank) updates.goldInBank = snapshot.goldInBank;
        if (snapshot.attackTurns !== undefined) updates.attackTurns = snapshot.attackTurns;

        // Level/XP fields
        if (snapshot.level !== undefined) updates.level = snapshot.level;
        if (snapshot.experience !== undefined) updates.experience = snapshot.experience.toString();

        // Units (if provided)
        if (snapshot.updatedUnits) {
          updates.totalUnits = snapshot.updatedUnits.reduce((sum: number, u: any) => sum + u.quantity, 0);
          updates.unitsByType = snapshot.updatedUnits.reduce((acc: any, u: any) => {
            acc[u.unitType] = (acc[u.unitType] || 0) + u.quantity;
            return acc;
          }, {});
          // Extract citizens explicitly for easy access
          updates.citizens = updates.unitsByType.CITIZEN || 0;
        }

        // Buildings (if provided)
        if (snapshot.updatedBuildings) {
          updates.buildings = snapshot.updatedBuildings.reduce((acc: any, b: any) => {
            acc[b.type] = b.level;
            return acc;
          }, {});
        }

        // Proficiencies (if provided)
        if (snapshot.proficiencies) {
          updates.proficiencies = snapshot.proficiencies.reduce((acc: any, p: any) => {
            acc[p.type] = p.level;
            return acc;
          }, {});
        }

        // Proficiency points
        if (snapshot.availablePoints !== undefined) updates.availablePoints = snapshot.availablePoints;

        // Building upgrades availability
        if (snapshot.availableUpgrades !== undefined) updates.availableUpgrades = snapshot.availableUpgrades;

        // Notifications
        if (snapshot.unreadMail !== undefined) updates.unreadMail = snapshot.unreadMail;

        // Equipped items (if provided)
        if (snapshot.equippedItems) {
          updates.equippedItems = snapshot.equippedItems.map((item: any) => ({
            id: item.id,
            type: item.type,
            tier: item.tier,
          }));
        }

        set((state) => ({ ...state, ...updates }));
      },
    }),
    {
      name: 'player-storage',
    }
  )
);
