# OpenThrone v2 - State Architecture Refactor Plan

> **Problem:** Cache synchronization issues causing delayed UI updates, race conditions, and growing technical debt from manual cache invalidation across pages.
>
> **Solution:** Two-phase approach inspired by event-driven architecture from Aquarium Autobattler.

---

## 🎯 Goals

1. **Eliminate cache sync issues** - Single source of truth for player state
2. **Instant UI updates** - No more stale gold/level/turns across pages
3. **Real-time capabilities** - Server pushes state changes to clients
4. **AI agent support** - Bots can connect via WebSocket and play the game

---

## 📚 Architecture Analysis: Aquarium Autobattler

**Repository:** https://github.com/Fishbone-Aquatics/aquarium-autobattler

### Key Patterns

#### 1. WebSocket-Driven State (Aquarium Pattern)
- Every game action = WebSocket event (`train:units`, `attack:player`, `upgrade:building`)
- Server is source of truth
- Client receives state updates, never manages state locally

**Aquarium Example:**
```typescript
// Actions: shop:buy, tank:update, battle:start
socket.emit('shop:buy', { pieceId: 'fish-1', shopIndex: 0 });
socket.on('game:state:update', (gameState) => {
  // Full state update
});
```

**OpenThrone Equivalent:**
```typescript
// Actions: train, attack, spy, upgrade
socket.emit('action:train', { unitType: 'OFFENSE', quantity: 10 });
socket.on('state:update', (delta) => {
  // Delta state update (only changed fields)
});
```

#### 2. Single State Object (Aquarium Pattern)

**Aquarium Example:**
```typescript
interface GameState {
  phase: 'shop' | 'placement' | 'battle';
  gold: number;
  round: number;
  playerTank: Tank;
  opponentTank: Tank;
  shop: GamePiece[];
  // ... everything in ONE object
}
```

**OpenThrone Equivalent:**
```typescript
interface PlayerState {
  // Identity
  id: string;
  displayName: string;
  level: number;
  race: string;

  // Economy
  gold: bigint;
  goldInBank: bigint;
  attackTurns: number;

  // Military
  units: { type: string; level: number; quantity: number }[];
  totalOffense: number;
  totalDefense: number;

  // Structures
  buildings: Record<string, number>; // { FORTIFICATION: 3 }
  proficiencies: Record<string, number>; // { OFFENSE: 5 }

  // Meta
  unreadMail: number;
  availablePoints: number;
}
```

#### 3. Server Flow (Every Action)
```typescript
// Aquarium example (shop buying pieces)
async handleShopBuy(data, client: Socket) {
  const gameState = await this.gameService.getSession(client.id);
  gameState.gold -= piece.cost;
  gameState.playerTank.pieces.push(piece);
  this.updateGameState(client.id, gameState);
  client.emit('game:state:update', gameState);
}

// OpenThrone equivalent (training units)
async handleTrain(playerId: string, dto: TrainDto) {
  const result = await this.prisma.$transaction(async (tx) => {
    // Deduct gold, add units
    const economy = await tx.playerEconomy.update({...});
    const units = await tx.playerUnit.upsert({...});
    return { economy, units };
  });

  // Emit event → Gateway broadcasts to client
  this.eventEmitter.emit('player.economy.changed', {
    playerId,
    gold: result.economy.gold,
    totalUnits: result.units.quantity,
  });
}
```

#### 4. Client Flow
```typescript
// Client receives state update and renders
socket.on('state:update', (delta) => {
  // Update Zustand store
  usePlayerStore.getState().mergeState({
    gold: BigInt(delta.gold),
    totalUnits: delta.totalUnits,
  });
});
```

**Why This Works:**
- ✅ No cache sync issues (no cache!)
- ✅ Instant UI updates (server pushes state)
- ✅ Real-time by design
- ✅ AI agents can connect and play

---

## 🚀 Phase 1: Zustand Global Store (Week 1-2) — ✅ IN PROGRESS

**Goal:** Replace TanStack Query cache with single Zustand store for core player state

### Why Zustand?
- Lightweight (1KB)
- No boilerplate
- Works seamlessly with React
- Built-in DevTools support
- LocalStorage persistence out of the box

### Step 1.1: Install & Create Store ✅ DONE

```bash
pnpm add zustand
```

**File:** `apps/web/src/stores/player-store.ts`

**⚠️ CRITICAL: BigInt Serialization Issue**

Initial implementation used `BigInt` for gold/experience but hit serialization errors:
- `localStorage` (persist middleware) can't serialize BigInt
- React DevTools can't serialize BigInt
- `JSON.stringify()` throws "Do not know how to serialize a BigInt"

**✅ SOLUTION: Store as strings, expose BigInt helpers**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerState {
  // ─── Identity ────────────────────────────────────────────────────
  id: string;
  displayName: string;
  level: number;
  experience: string; // Stored as string, use getExperience() for BigInt
  race: string;

  // ─── Economy ─────────────────────────────────────────────────────
  gold: string; // Stored as string, use getGold() for BigInt
  goldInBank: string; // Stored as string, use getGoldInBank() for BigInt
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

  // BigInt helpers (accept/return BigInt, store as string internally)
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
      setBuilding: (type, level) => set((s) => ({
        buildings: { ...s.buildings, [type]: level },
      })),

      // Proficiency helpers
      setProficiency: (type, level) => set((s) => ({
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
```

**Why this works:**
- ✅ Strings serialize to localStorage without issues
- ✅ Helper methods provide type-safe BigInt interface
- ✅ Persist middleware works out of the box
- ✅ Cross-tab sync works via localStorage events

### Step 1.2: Hydrate Store on Login ✅ DONE

**File:** `apps/web/src/app/(game)/layout.tsx`

```typescript
const { data: meData } = useQuery<MeData>({
  queryKey: ['player', 'me'],
  queryFn: () => api.get('/player/me'),
  enabled: isReady,
  refetchInterval: 120000, // Still fetch every 2min as backup
});

// Hydrate Zustand store when data loads
useEffect(() => {
  if (meData) {
    // Calculate derived state
    const totalUnits = meData.units?.reduce((sum, u) => sum + u.quantity, 0) ?? 0;
    const unitsByType = meData.units?.reduce((acc, u) => {
      acc[u.unitType] = u.quantity;
      return acc;
    }, {} as Record<string, number>) ?? {};
    const buildings = buildingsData?.buildings?.reduce((acc, b) => {
      acc[b.buildingType] = b.currentLevel;
      return acc;
    }, {} as Record<string, number>) ?? {};

    // Hydrate store (gold stored as strings)
    usePlayerStore.getState().setState({
      id: meData.id ?? '',
      displayName: meData.displayName ?? '',
      level: meData.level ?? 1,
      experience: meData.stats?.experience?.toString() ?? '0',
      race: meData.race ?? 'UNDEAD',
      gold: meData.economy?.gold?.toString() ?? '0',
      goldInBank: meData.economy?.goldInBank?.toString() ?? '0',
      attackTurns: meData.economy?.attackTurns ?? 0,
      totalUnits,
      unitsByType,
      buildings,
      availablePoints: meData.availablePoints ?? 0,
      unreadMail: unreadCount,
      proficiencies: {}, // TODO: add when available
      equippedItems: [], // TODO: add when available
    });
  }
}, [meData, buildingsData, unreadCount]);

// Reset store on logout
const handleLogout = async () => {
  usePlayerStore.getState().reset();
  await signOut({ redirect: false });
  router.push('/login');
};
```

### Step 1.3: Update Store on Mutations ✅ DONE (3 pages migrated)

**Pattern for ALL mutations:**

```typescript
import { usePlayerStore } from '@/stores/player-store';

// Example: Armory equip mutation
const equipMutation = useMutation({
  mutationFn: (item) => api.post('/armory/equip', item),
  onSuccess: (data) => {
    // 1. Update Zustand store INSTANTLY (use setGold helper)
    if (data.playerState?.gold) {
      usePlayerStore.getState().setGold(BigInt(data.playerState.gold));
    }

    // 2. Still invalidate queries for background re-sync
    queryClient.invalidateQueries({ queryKey: ['armory'] });
    queryClient.invalidateQueries({ queryKey: ['player'] });

    // 3. Show notification
    notifications.show({ title: 'Equipped', message: 'Items purchased!', color: 'green' });
  },
});
```

**Example: Bank deposit/withdraw**

```typescript
const depositMutation = useMutation({
  mutationFn: (amount: string) => api.post('/bank/deposit', { amount }),
  onSuccess: (data) => {
    // Update BOTH gold and goldInBank
    if (data.playerState?.gold) {
      usePlayerStore.getState().setGold(BigInt(data.playerState.gold));
    }
    if (data.playerState?.goldInBank) {
      usePlayerStore.getState().setGoldInBank(BigInt(data.playerState.goldInBank));
    }

    queryClient.invalidateQueries({ queryKey: ['bank'] });
    notifications.show({ title: 'Success', message: 'Deposit successful!', color: 'green' });
  },
});
```

**Example: Training mutation**

```typescript
const trainMutation = useMutation({
  mutationFn: (units: Array<{ unitType: string; level: number; quantity: number }>) =>
    api.post('/training/train', { units }),
  onSuccess: (data) => {
    // Update gold instantly
    if (data.playerState?.gold) {
      usePlayerStore.getState().setGold(BigInt(data.playerState.gold));
    }

    queryClient.invalidateQueries({ queryKey: ['training'] });
    notifications.show({ title: 'Trained', message: 'Units trained successfully!', color: 'green' });
  },
});
```

**✅ Pages Migrated:**
- Armory (equip/unequip items)
- Training (train/untrain units)
- Bank (deposit/withdraw gold)

### Step 1.4: Use Store in Components

**Header (instant gold updates):**

```typescript
// apps/web/src/components/Header.tsx
function Header() {
  const gold = usePlayerStore(s => s.gold);
  const level = usePlayerStore(s => s.level);
  const attackTurns = usePlayerStore(s => s.attackTurns);

  return (
    <Group>
      <Text>💰 {toLocale(gold)}</Text>
      <Text>⚔️ {attackTurns} turns</Text>
      <Text>Lv. {level}</Text>
    </Group>
  );
}
```

**Sidebar (instant badge updates):**

```typescript
function Sidebar() {
  const availablePoints = usePlayerStore(s => s.availablePoints);
  const unreadMail = usePlayerStore(s => s.unreadMail);

  return (
    <NavLink
      label="Proficiencies"
      rightSection={availablePoints > 0 ? <Badge>{availablePoints}</Badge> : null}
    />
  );
}
```

**Any component can read instantly:**

```typescript
function SomeComponent() {
  const gold = usePlayerStore(s => s.gold); // Always fresh!
  // No useQuery, no loading states for core player data
}
```

### Step 1.5: Migration Checklist

**Priority Pages (Week 1):**
- [x] ~~Header component (gold, level, turns)~~ — Reads from store (hydrated in layout)
- [x] ~~Sidebar navigation (badges)~~ — Reads from store (hydrated in layout)
- [ ] Dashboard/Home page — TODO: migrate mutations
- [x] ~~Armory page~~ — ✅ Migrated (equip/unequip)
- [x] ~~Training page~~ — ✅ Migrated (train/untrain)
- [x] ~~Bank page~~ — ✅ Migrated (deposit/withdraw)
- [ ] Structures/Buildings page — TODO: migrate upgrade mutations
- [ ] Mercenary page — TODO: migrate hire mutations
- [ ] Battle Upgrades page — TODO: migrate purchase mutations
- [ ] Repair page — TODO: migrate repair mutations

**Remaining Pages (Week 2):**
- [ ] Battle pages (attack mutations) — Not yet implemented in Phase 13
- [ ] Spy/Intelligence pages (mission mutations) — Not yet implemented
- [ ] Social/Alliance pages (invite/join mutations) — Check if any mutate player state
- [ ] Admin pages — Skip (admin-only, not player state)
- [ ] Profile pages — Read-only, no mutations

**Cleanup:**
- [ ] Remove `updatePlayerCache()` helper from `lib/cache-sync.ts`
- [ ] Remove scattered `queryClient.setQueryData()` calls
- [ ] Document pattern in CLAUDE.md — ✅ DONE
- [ ] Keep TanStack Query ONLY for:
  - Lists (rankings, battle history, mail inbox)
  - Secondary data (alliance details, player profiles)
  - Data that changes based on filters/pagination

**Progress:** 3/10 critical pages migrated (30%)

### Step 1.6: Testing

**Manual Tests:**
1. Spend gold in Armory → check Header updates instantly
2. Train units → check Dashboard unit count updates
3. Level up → check notification + level badge updates
4. Deposit gold → check gold updates everywhere
5. Build structure → check sidebar badge updates

**Edge Cases:**
- Logout → store resets
- Multiple tabs → localStorage sync (Zustand handles this!)
- Refresh → store persists via localStorage

---

## 🌐 Phase 2: WebSocket State Sync (Week 3-4)

**Goal:** Server pushes state changes to clients in real-time

### Why WebSockets?
- Turn ticks broadcast to all players instantly
- AI bots can connect and play
- Real-time multiplayer events (future: live battles, chat)
- Eliminates need for aggressive polling

### Step 2.1: Backend - Create GameGateway

**File:** `apps/api/src/game/game.gateway.ts`

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: '/game',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private eventEmitter: EventEmitter2,
    private jwtService: JwtService,
  ) {
    // Subscribe to ALL player state change events
    this.eventEmitter.on('player.*.changed', this.handleStateChange.bind(this));
  }

  async handleConnection(client: Socket) {
    try {
      // Authenticate via JWT in handshake
      const token = client.handshake.auth.token;
      const payload = await this.jwtService.verifyAsync(token);

      // Store player ID on socket
      client.data.playerId = payload.sub;

      // Join player's personal room
      client.join(`player:${payload.sub}`);

      this.logger.log(`Player ${payload.sub} connected via WebSocket`);
    } catch (error) {
      this.logger.error('WebSocket auth failed:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Player ${client.data.playerId} disconnected`);
  }

  // ─── Event Listener ──────────────────────────────────────────────
  private handleStateChange(event: PlayerStateChangedEvent) {
    // Broadcast state delta to player's socket room
    this.server.to(`player:${event.playerId}`).emit('state:update', {
      gold: event.gold?.toString(),
      goldInBank: event.goldInBank?.toString(),
      level: event.level,
      experience: event.experience?.toString(),
      attackTurns: event.attackTurns,
      totalUnits: event.totalUnits,
      availablePoints: event.availablePoints,
      unreadMail: event.unreadMail,
      // ... only include changed fields
    });
  }

  // ─── Optional: WebSocket Actions ─────────────────────────────────
  // (REST endpoints still work, these are for real-time interactions)

  @SubscribeMessage('action:train')
  async handleTrain(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { unitType: string; level: number; quantity: number },
  ) {
    try {
      // Inject TrainingService
      const result = await this.trainingService.train(client.data.playerId, data);
      // State change event will auto-broadcast via handleStateChange
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('action:attack')
  async handleAttack(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { defenderId: string; turns: number },
  ) {
    try {
      // Inject BattleService
      const result = await this.battleService.attack(
        client.data.playerId,
        data.defenderId,
        data.turns,
      );
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('action:spy')
  async handleSpy(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; mission: string },
  ) {
    try {
      // Inject BattleService for spy missions
      const result = await this.battleService.spy(
        client.data.playerId,
        data.targetId,
        data.mission,
      );
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('action:upgrade-building')
  async handleUpgradeBuilding(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { buildingType: string },
  ) {
    try {
      // Inject StructuresService
      const result = await this.structuresService.upgradeBuilding(
        client.data.playerId,
        data.buildingType,
      );
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

**File:** `apps/api/src/game/game.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [GameGateway],
})
export class GameModule {}
```

Register in `app.module.ts`:

```typescript
@Module({
  imports: [
    // ... existing modules
    GameModule,
  ],
})
export class AppModule {}
```

### Step 2.2: Backend - Emit Events from Services

**Pattern for ALL services:**

```typescript
// apps/api/src/training/training.service.ts
async train(playerId: string, dto: TrainDto) {
  const result = await this.prisma.$transaction(async (tx) => {
    // ... training logic
    const economy = await tx.playerEconomy.update({
      where: { player_id: playerId },
      data: { gold: { decrement: totalCost } },
    });

    // ... unit updates
  });

  // Emit event (GameGateway auto-broadcasts via WebSocket)
  this.eventEmitter.emit('player.economy.changed', {
    playerId,
    gold: result.economy.gold,
    totalUnits: result.units.reduce((sum, u) => sum + u.quantity, 0),
  });

  return result;
}
```

**Example events to emit:**

```typescript
// Economy changes
this.eventEmitter.emit('player.economy.changed', {
  playerId,
  gold: newGold,
  goldInBank: newBankGold,
  attackTurns: newTurns,
});

// Level up
this.eventEmitter.emit('player.level.changed', {
  playerId,
  level: newLevel,
  experience: newXp,
  availablePoints: newPoints,
});

// Building upgrade
this.eventEmitter.emit('player.buildings.changed', {
  playerId,
  buildings: { FORTIFICATION: 3, ARMORY: 2 },
});

// Mail received
this.eventEmitter.emit('player.mail.received', {
  playerId,
  unreadMail: newUnreadCount,
});
```

**Event interface:**

```typescript
// apps/api/src/game/events/player-state-changed.event.ts
export class PlayerStateChangedEvent {
  playerId: string;
  gold?: bigint;
  goldInBank?: bigint;
  level?: number;
  experience?: bigint;
  attackTurns?: number;
  totalUnits?: number;
  availablePoints?: number;
  unreadMail?: number;
  buildings?: Record<string, number>;
  // ... only include changed fields
}
```

### Step 2.3: Frontend - WebSocket Client Hook

**File:** `apps/web/src/hooks/use-game-sync.ts`

```typescript
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { usePlayerStore } from '@/stores/player-store';

let socket: Socket | null = null;

export function useGameSync() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;

  useEffect(() => {
    if (!token) return;

    // Connect to game namespace
    socket = io(`${process.env.NEXT_PUBLIC_API_URL}/game`, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('🎮 Game socket connected');
    });

    socket.on('disconnect', () => {
      console.log('🎮 Game socket disconnected');
    });

    // Listen for state updates from server
    socket.on('state:update', (delta: any) => {
      console.log('📡 State update received:', delta);

      // Merge server delta into Zustand store
      const updates: any = {};

      if (delta.gold !== undefined) updates.gold = BigInt(delta.gold);
      if (delta.goldInBank !== undefined) updates.goldInBank = BigInt(delta.goldInBank);
      if (delta.level !== undefined) updates.level = delta.level;
      if (delta.experience !== undefined) updates.experience = BigInt(delta.experience);
      if (delta.attackTurns !== undefined) updates.attackTurns = delta.attackTurns;
      if (delta.totalUnits !== undefined) updates.totalUnits = delta.totalUnits;
      if (delta.availablePoints !== undefined) updates.availablePoints = delta.availablePoints;
      if (delta.unreadMail !== undefined) updates.unreadMail = delta.unreadMail;
      if (delta.buildings !== undefined) updates.buildings = delta.buildings;

      usePlayerStore.getState().mergeState(updates);
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [token]);

  return socket;
}

// Export for actions (optional)
export function getGameSocket(): Socket | null {
  return socket;
}
```

**Use in layout:**

```typescript
// apps/web/src/app/(game)/layout.tsx
import { useGameSync } from '@/hooks/use-game-sync';

function GameShell({ children }: { children: React.ReactNode }) {
  useGameSync(); // Auto-connects and syncs state

  // ... rest of layout
}
```

### Step 2.4: Turn Tick System

**Server - Scheduler emits events:**

```typescript
// apps/api/src/scheduler/scheduler.service.ts
@Cron('0 */30 * * * *') // Every 30 minutes
async handleTurnTick() {
  const players = await this.prisma.player.findMany({
    include: { economy: true, fortification: true },
  });

  for (const player of players) {
    // Calculate income
    const income = calculateIncome(player);

    // Update DB
    await this.prisma.playerEconomy.update({
      where: { player_id: player.id },
      data: {
        attack_turns: { increment: 1 },
        gold: { increment: income },
      },
    });

    // Emit event (broadcasts to connected players)
    this.eventEmitter.emit('player.economy.changed', {
      playerId: player.id,
      gold: player.economy.gold + income,
      attackTurns: player.economy.attack_turns + 1,
    });
  }

  // Recalculate rankings
  await this.recalculateRankings();
}
```

**Client receives updates automatically!** No polling needed.

### Step 2.5: Optional - Actions via WebSocket

If you want real-time actions (not required, REST still works):

```typescript
// Client
import { getGameSocket } from '@/hooks/use-game-sync';

const handleTrain = () => {
  const socket = getGameSocket();

  socket?.emit('action:train', {
    unitType: 'OFFENSE',
    level: 1,
    quantity: 10,
  }, (response: { success: boolean; error?: string }) => {
    if (response.success) {
      // State already updated via state:update event!
      notifications.show({ title: 'Success', message: 'Units trained!', color: 'green' });
    } else {
      notifications.show({ title: 'Error', message: response.error, color: 'red' });
    }
  });
};
```

---

## 🤖 Phase 3: AI Agent Support (Week 5+)

**Goal:** External bots can connect and play the game programmatically

### Bot Authentication

**JWT for bots:**

```typescript
// apps/api/src/auth/auth.service.ts
async createBotToken(botId: string) {
  return this.jwtService.sign({
    sub: botId,
    isBot: true,
  });
}
```

### Bot Example (Python)

```python
# bot.py - OpenThrone AI Bot
import socketio
import requests
import time
import random

sio = socketio.Client()
API_URL = 'http://localhost:3001/api'

# Connect with bot JWT
sio.connect('http://localhost:3001/game', auth={
    'token': 'bot-jwt-token-here'
})

# Track state
game_state = {
    'gold': 0,
    'attackTurns': 0,
    'level': 1,
    'totalUnits': 0
}

@sio.on('state:update')
def on_state_update(data):
    global game_state
    game_state.update(data)

    gold = int(data.get('gold', 0))
    attack_turns = data.get('attackTurns', 0)
    level = data.get('level', 1)

    print(f"💰 Gold: {gold} | ⚔️ Turns: {attack_turns} | 📊 Level: {level}")

    # Bot Strategy: Balanced economy + military

    # 1. Train workers if gold > 50k
    if gold > 50000:
        workers_to_train = min(10, gold // 2000)
        sio.emit('action:train', {
            'unitType': 'WORKER',
            'level': 1,
            'quantity': workers_to_train
        })
        print(f"🛠️ Training {workers_to_train} workers")

    # 2. Train offense if gold > 100k
    if gold > 100000:
        soldiers = min(20, gold // 1500)
        sio.emit('action:train', {
            'unitType': 'OFFENSE',
            'level': 1,
            'quantity': soldiers
        })
        print(f"⚔️ Training {soldiers} soldiers")

    # 3. Attack if we have turns
    if attack_turns > 5:
        # Find targets via REST API
        targets = get_attack_targets()
        if targets:
            target = random.choice(targets)
            turns_to_use = min(3, attack_turns)
            sio.emit('action:attack', {
                'defenderId': target['id'],
                'turns': turns_to_use
            })
            print(f"⚔️ Attacking {target['name']} with {turns_to_use} turns")

    # 4. Spy on strong players occasionally
    if attack_turns > 8 and random.random() < 0.3:
        targets = get_spy_targets()
        if targets:
            target = random.choice(targets)
            sio.emit('action:spy', {
                'targetId': target['id'],
                'mission': 'INTEL'
            })
            print(f"🕵️ Spying on {target['name']}")

def get_attack_targets():
    """Fetch players within attack range via REST API"""
    response = requests.get(f"{API_URL}/battle/players", headers={
        'Authorization': f'Bearer {sio.eio.sid}'
    })
    if response.ok:
        players = response.json()
        # Filter to weaker targets
        return [p for p in players if p['level'] <= game_state.get('level', 1) + 5]
    return []

def get_spy_targets():
    """Fetch high-level players to spy on"""
    response = requests.get(f"{API_URL}/battle/rankings", headers={
        'Authorization': f'Bearer {sio.eio.sid}'
    })
    if response.ok:
        return response.json()[:10]  # Top 10 players
    return []

@sio.on('connect')
def on_connect():
    print('🤖 Bot connected to OpenThrone!')

@sio.on('disconnect')
def on_disconnect():
    print('🤖 Bot disconnected')

# Keep alive
sio.wait()
```

### Bot Example (TypeScript/Node)

```typescript
// bot.ts - OpenThrone AI Bot (TypeScript)
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';
const BOT_TOKEN = 'bot-jwt-token';

const socket: Socket = io('http://localhost:3001/game', {
  auth: { token: BOT_TOKEN },
});

interface GameState {
  gold: string;
  attackTurns: number;
  level: number;
  totalUnits: number;
  buildings: Record<string, number>;
}

let gameState: Partial<GameState> = {};

socket.on('state:update', async (delta: Partial<GameState>) => {
  Object.assign(gameState, delta);

  const gold = BigInt(delta.gold || '0');
  const attackTurns = delta.attackTurns || 0;
  const level = delta.level || 1;

  console.log(`💰 Gold: ${gold} | ⚔️ Turns: ${attackTurns} | 📊 Level: ${level}`);

  // Bot Strategy: Aggressive military expansion

  // 1. Train workers if low on economy
  if (gold > 50000n && gameState.totalUnits! < 100) {
    socket.emit('action:train', {
      unitType: 'WORKER',
      level: 1,
      quantity: 10,
    });
    console.log('🛠️ Training workers');
  }

  // 2. Build army
  if (gold > 100000n) {
    socket.emit('action:train', {
      unitType: 'OFFENSE',
      level: 1,
      quantity: 20,
    });
    console.log('⚔️ Training soldiers');
  }

  // 3. Attack constantly
  if (attackTurns > 3) {
    const targets = await getAttackTargets();
    if (targets.length > 0) {
      const target = targets[Math.floor(Math.random() * targets.length)];
      socket.emit('action:attack', {
        defenderId: target.id,
        turns: Math.min(3, attackTurns),
      });
      console.log(`⚔️ Attacking ${target.displayName}`);
    }
  }

  // 4. Upgrade buildings when possible
  if (gold > 500000n && level >= 10) {
    const fortLevel = gameState.buildings?.FORTIFICATION || 0;
    if (fortLevel < 3) {
      socket.emit('action:upgrade-building', {
        buildingType: 'FORTIFICATION',
      });
      console.log('🏰 Upgrading fortification');
    }
  }
});

async function getAttackTargets() {
  try {
    const response = await axios.get(`${API_URL}/battle/players`, {
      headers: { Authorization: `Bearer ${BOT_TOKEN}` },
    });
    return response.data.filter((p: any) =>
      p.level >= (gameState.level || 1) - 5 &&
      p.level <= (gameState.level || 1) + 5
    );
  } catch (error) {
    console.error('Failed to fetch targets:', error);
    return [];
  }
}

socket.on('connect', () => console.log('🤖 Bot online!'));
socket.on('disconnect', () => console.log('🤖 Bot offline'));
```

### Bot Strategies

**Possible bot strategies:**
1. **Economy Bot** - Max workers, deposits gold, never attacks (turtling)
2. **Aggressive Bot** - Trains offense, attacks constantly, ignores defense
3. **Balanced Bot** - 50/50 split between economy and military
4. **Spy Bot** - Focuses on espionage, steal gold, sabotage enemies
5. **Builder Bot** - Rushes building upgrades, then trains high-tier units
6. **Troll Bot** - Random chaos, attacks weakest players, spams spy missions

**Training bots with RL (Future):**
- Hook OpenAI Gym or stable-baselines3
- State space: gold, units, level, buildings, attack_turns
- Action space: train(unit, qty), attack(target, turns), upgrade(building), spy(target, mission)
- Reward function: `final_rank * 1000 + total_gold + kills - deaths`
- Let bots train for weeks, find meta strategies
- Export best strategy as template for players

---

## 📋 Implementation Checklist

### Week 1: Zustand Foundation — ✅ COMPLETE
- [x] ~~Install Zustand (`pnpm add zustand`)~~ — ✅ Installed
- [x] ~~Create `player-store.ts` with core state~~ — ✅ Done (string-based BigInt storage)
- [x] ~~Hydrate store in layout on login~~ — ✅ Done
- [x] ~~Migrate Header component~~ — ✅ Uses store (hydrated)
- [x] ~~Migrate Armory page~~ — ✅ Done
- [x] ~~Migrate Training page~~ — ✅ Done
- [x] ~~Migrate Bank page~~ — ✅ Done
- [x] ~~Test: Spend gold → Header updates instantly~~ — ✅ Tested and working

### Week 2: Zustand Migration Complete — ✅ COMPLETE
- [x] ~~Migrate remaining pages (Buildings, Mercenary, Upgrades, Repair)~~ — ✅ All 9 pages migrated
- [x] ~~Update all mutations to write to store~~ — ✅ All use `updateFromSnapshot()`
- [x] ~~Real-time notifications (level-up, points, buildings, mail)~~ — ✅ Done
- [x] ~~Sidebar badge indicators~~ — ✅ Read from store
- [x] ~~Dashboard reads from store~~ — ✅ Done
- [x] ~~Filter persistence (attack page)~~ — ✅ Done
- [x] ~~Query invalidation (attack/spy pages)~~ — ✅ Fixed
- [x] ~~Test: Full user flow (train, attack, upgrade, etc.)~~ — ✅ Tested

### Week 3: WebSocket Setup — 🚧 IN PROGRESS
- [x] ~~Install WebSocket dependencies~~ — ✅ `@nestjs/websockets`, `socket.io-client`
- [x] ~~Create `GameGateway` in `apps/api/src/game/`~~ — ✅ Done with JWT auth
- [x] ~~Register in `AppModule`~~ — ✅ GameModule imported
- [x] ~~Add JWT authentication to gateway~~ — ✅ Done
- [x] ~~Create `PlayerStateChangedEvent` interface~~ — ✅ Done + ChatMessageEvent
- [x] ~~Update Training service to emit events~~ — ✅ Done (train + untrain)
- [x] ~~Create `useGameSync()` hook on frontend~~ — ✅ Done with chat helpers
- [x] ~~Add useGameSync to layout~~ — ✅ Auto-connects on login
- [ ] Test: Training → state:update event → Zustand updates — **READY TO TEST**
- [ ] Update Bank service to emit events
- [ ] Update Structures service to emit events

### Week 4: WebSocket Complete
- [ ] Update ALL services to emit events
- [ ] Add turn tick WebSocket broadcast
- [ ] Add level-up notification via WebSocket
- [ ] Add mail notification via WebSocket
- [ ] Test: Turn tick → all connected players update instantly
- [ ] Load test: 10+ concurrent connections

### Week 5+: AI Agents (Optional)
- [ ] Create bot JWT endpoint
- [ ] Document WebSocket action protocol
- [ ] Build example Python bot
- [ ] Build example TypeScript bot
- [ ] Create bot strategy templates
- [ ] Set up bot tournament system

---

## 🎯 Success Metrics

**Phase 1 Complete When:**
- ✅ Gold updates instantly across all pages
- ✅ Level/turns update instantly in header
- ✅ No more "stale state" bug reports
- ✅ Can remove `updatePlayerCache()` helper

**Phase 2 Complete When:**
- ✅ Turn ticks broadcast to all players
- ✅ Level-up messages appear instantly
- ✅ Mail notifications push in real-time
- ✅ Can build a functional bot that plays the game

---

## 🚨 Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Zustand learning curve** | Simple API, great docs, similar to Redux but easier |
| **Breaking existing code** | Phased migration, keep TanStack Query during transition |
| **WebSocket scaling** | Start with single server, add Redis adapter later if needed |
| **Bot abuse** | Rate limiting on WebSocket actions, ban hammer for malicious bots |
| **State desync** | Server is source of truth, periodic full state refresh fallback |

---

## 🔗 References

- **Zustand Docs:** https://docs.pmnd.rs/zustand/getting-started/introduction
- **Socket.IO NestJS:** https://docs.nestjs.com/websockets/gateways
- **Aquarium Autobattler:** https://github.com/Fishbone-Aquatics/aquarium-autobattler
- **Event-Driven Architecture:** https://martinfowler.com/articles/201701-event-driven.html

---

## 📝 Notes & TODOs

- [ ] Decide on state:update event granularity (full state vs deltas)
- [ ] Design bot rate limiting strategy
- [ ] Plan Redis integration for multi-server WebSocket (future)
- [ ] Document WebSocket protocol for community bot developers
- [ ] Consider adding spectator mode (read-only WebSocket connections)
