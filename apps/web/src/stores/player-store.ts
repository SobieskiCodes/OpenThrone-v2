import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface PlayerState {
  // ─── Identity ────────────────────────────────────────────────────
  id: string;
  displayName: string;
  level: number;
  experience: bigint;
  race: string;

  // ─── Economy ─────────────────────────────────────────────────────
  gold: bigint;
  goldInBank: bigint;
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
  setState: (partial: Partial<PlayerState>) => void;
  mergeState: (partial: Partial<PlayerState>) => void;
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
  experience: 0n,
  race: 'UNDEAD',
  gold: 0n,
  goldInBank: 0n,
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
  devtools(
    persist(
      (set) => ({
        ...initialState,

        // Full replace (for initial hydration)
        setState: (partial) => set(partial),

        // Merge delta (for WebSocket updates)
        mergeState: (partial) => set((state) => ({ ...state, ...partial })),

        // Gold helpers
        addGold: (delta) => set((s) => ({ gold: s.gold + delta })),
        subtractGold: (amount) => set((s) => ({ gold: s.gold - amount })),

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
        name: 'openthrone-player-state',
        // Serialize BigInt to string for localStorage
        serialize: (state) => {
          return JSON.stringify(state, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v
          );
        },
        deserialize: (str) => {
          const parsed = JSON.parse(str);
          // Convert gold strings back to BigInt
          if (parsed.state.gold)
            parsed.state.gold = BigInt(parsed.state.gold);
          if (parsed.state.goldInBank)
            parsed.state.goldInBank = BigInt(parsed.state.goldInBank);
          if (parsed.state.experience)
            parsed.state.experience = BigInt(parsed.state.experience);
          return parsed;
        },
      }
    ),
    {
      name: 'PlayerStore',
      // Custom serializer for devtools to handle BigInt
      serialize: {
        replacer: (_, value) => (typeof value === 'bigint' ? value.toString() + 'n' : value),
      },
    }
  )
);
