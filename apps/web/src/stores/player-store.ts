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
  unitsByType: Record<string, number>; // { OFFENSE: 100, DEFENSE: 50 }

  // ─── Buildings ───────────────────────────────────────────────────
  buildings: Record<string, number>; // { FORTIFICATION: 3, ARMORY: 2 }

  // ─── Proficiencies ───────────────────────────────────────────────
  proficiencies: Record<string, number>; // { OFFENSE: 5, SPY: 3 }
  availablePoints: number;

  // ─── Items (equipped summary) ────────────────────────────────────
  equippedItems: Array<{ id: string; type: string; tier: number }>;

  // ─── Unread Counts ───────────────────────────────────────────────
  unreadMail: number;

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
  unitsByType: {},
  buildings: {},
  proficiencies: {},
  availablePoints: 0,
  equippedItems: [],
  unreadMail: 0,
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
    }),
    {
      name: 'player-storage',
    }
  )
);
