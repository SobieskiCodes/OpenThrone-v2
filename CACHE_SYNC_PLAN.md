# Cache Sync Plan: Return Updated State in Mutation Responses

## Problem Statement
After mutations (attack, recruit, train, etc.), the dashboard shows stale cached data for 10-15 seconds until cache expires or user manually refreshes. This creates poor UX where actions don't feel responsive.

## Solution Architecture
Have all mutation endpoints return the updated player state alongside their primary response. Frontend updates React Query cache directly without additional refetches.

## Security Model
✅ **Safe**: Server is still the source of truth. Cache is display-only. All actions are server-validated against the database.
- Client cache can be tampered with, but server validates every mutation against DB
- HTTPS prevents true MITM attacks
- Standard practice (Stripe, GitHub, etc. all return full objects after mutations)

---

## Shared Types (packages/shared/src/types.ts)

### Core State Snapshot
```typescript
export interface PlayerStateSnapshot {
  // Economy
  gold: string;           // BigInt as string
  goldInBank: string;     // BigInt as string

  // Stats
  experience: number;
  level: number;
  offense: number;
  defense: number;
  spy: number;
  sentry: number;

  // Resources
  attackTurns: number;
  citizens: number;

  // Units (only quantities that changed, full refresh via invalidation)
  updatedUnits?: Array<{
    unitType: string;
    level: number;
    quantity: number;
  }>;

  // Incremental changes (for optimistic updates)
  deltas?: {
    goldChange?: string;
    xpGained?: number;
    unitsLost?: Array<{ unitType: string; level: number; quantity: number }>;
    unitsGained?: Array<{ unitType: string; level: number; quantity: number }>;
  };
}
```

### Helper to Build Snapshot
```typescript
// Backend helper: apps/api/src/common/helpers/player-snapshot.helper.ts
export async function buildPlayerSnapshot(
  prisma: PrismaService,
  playerId: string,
  options?: { includeUnits?: boolean }
): Promise<PlayerStateSnapshot> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      economy: true,
      stats: true,
      units: options?.includeUnits,
    },
  });

  return {
    gold: player.economy.gold.toString(),
    goldInBank: player.economy.gold_in_bank.toString(),
    experience: player.stats.experience,
    level: getLevelForXP(player.stats.experience),
    offense: player.stats.offense,
    defense: player.stats.defense,
    spy: player.stats.spy,
    sentry: player.stats.sentry,
    attackTurns: player.attack_turns,
    citizens: player.citizens,
    updatedUnits: options?.includeUnits
      ? player.units.map(u => ({
          unitType: u.unit_type,
          level: u.level,
          quantity: u.quantity,
        }))
      : undefined,
  };
}
```

---

## Backend Changes by Feature

### 1. Combat System
**Endpoints**:
- `POST /battle/attack/:defenderId`
- `POST /battle/spy/:defenderId`

**Current Response**:
```typescript
{
  battleResult: { ... },
  attackLog: { ... }
}
```

**New Response**:
```typescript
{
  battleResult: { ... },
  attackLog: { ... },
  playerState: PlayerStateSnapshot,  // ← ADD THIS
}
```

**Changes**:
```typescript
// apps/api/src/battle/battle.service.ts
async executeAttack(attackerId: string, defenderId: string, turns: number) {
  // ... existing attack logic ...

  const result = await this.prisma.$transaction(async (tx) => {
    // ... combat calculations, DB updates ...
    return { battleResult, attackLog };
  });

  // Build snapshot AFTER transaction commits
  const playerState = await buildPlayerSnapshot(this.prisma, attackerId, {
    includeUnits: true, // Include units since casualties happened
  });

  return {
    ...result,
    playerState,
  };
}
```

**Frontend Changes**:
```typescript
// apps/web/src/app/(game)/battle/attack/[id]/page.tsx
const attackMutation = useMutation({
  mutationFn: (data) => api.post(`/battle/attack/${defenderId}`, data),
  onSuccess: (response) => {
    // Update cache with fresh state
    updatePlayerCache(queryClient, response.playerState);

    // Still invalidate things not in snapshot (rankings, history, etc.)
    queryClient.invalidateQueries({ queryKey: ['battle', 'history'] });
    queryClient.invalidateQueries({ queryKey: ['rankings'] });

    // Show results
    // ... existing success logic
  },
});
```

---

### 2. Training System
**Endpoints**:
- `POST /training/units`
- `POST /training/untrain`

**New Response**:
```typescript
{
  success: true,
  message: string,
  trained: { unitType, level, quantity },
  playerState: PlayerStateSnapshot,  // ← ADD THIS
}
```

**Changes**:
```typescript
// apps/api/src/training/training.service.ts
async trainUnits(playerId: string, dto: TrainUnitsDto) {
  const result = await this.prisma.$transaction(async (tx) => {
    // ... training logic ...
  });

  const playerState = await buildPlayerSnapshot(this.prisma, playerId, {
    includeUnits: true,
  });

  return {
    ...result,
    playerState,
  };
}
```

---

### 3. Economy System
**Endpoints**:
- `POST /economy/deposit`
- `POST /economy/withdraw`

**New Response**:
```typescript
{
  success: true,
  newBalance: string,
  newBankBalance: string,
  playerState: PlayerStateSnapshot,  // ← ADD THIS
}
```

---

### 4. Armory System
**Endpoints**:
- `POST /armory/buy`
- `POST /armory/sell`
- `POST /armory/repair`

**New Response**:
```typescript
{
  success: true,
  message: string,
  playerState: PlayerStateSnapshot,  // ← ADD THIS
}
```

---

### 5. Structures System
**Endpoints**:
- `POST /structures/buildings` (upgrade building)
- `POST /structures/upgrades` (buy proficiency upgrade)

**New Response**:
```typescript
{
  success: true,
  building: { ... },
  playerState: PlayerStateSnapshot,  // ← ADD THIS
}
```

---

### 6. Recruitment System
**Endpoints**:
- `GET /recruitment/recruit/:playerId`
- `POST /recruitment/auto-recruit` (if implemented)

**New Response**:
```typescript
{
  success: true,
  citizensGained: number,
  playerState: PlayerStateSnapshot,  // ← ADD THIS
}
```

---

## Frontend: Shared Cache Update Helper

```typescript
// apps/web/src/lib/cache-sync.ts
import { QueryClient } from '@tanstack/react-query';
import type { PlayerStateSnapshot } from '@openthrone/shared';

export function updatePlayerCache(
  queryClient: QueryClient,
  snapshot: PlayerStateSnapshot
) {
  // Update player profile (for header stats)
  queryClient.setQueryData(['player', 'profile'], (old: any) => ({
    ...old,
    experience: snapshot.experience,
    level: snapshot.level,
    citizens: snapshot.citizens,
    attack_turns: snapshot.attackTurns,
  }));

  // Update economy
  queryClient.setQueryData(['economy', 'status'], (old: any) => ({
    ...old,
    gold: snapshot.gold,
    goldInBank: snapshot.goldInBank,
  }));

  // Update stats
  queryClient.setQueryData(['player', 'stats'], (old: any) => ({
    ...old,
    offense: snapshot.offense,
    defense: snapshot.defense,
    spy: snapshot.spy,
    sentry: snapshot.sentry,
  }));

  // Update units if included
  if (snapshot.updatedUnits) {
    queryClient.setQueryData(['units', 'status'], (old: any) => {
      const updated = { ...old };
      snapshot.updatedUnits!.forEach(unit => {
        const key = `${unit.unitType}_${unit.level}`;
        updated[key] = unit.quantity;
      });
      return updated;
    });
  }
}

// Optional: helper for incremental updates (optimistic)
export function applyPlayerDeltas(
  queryClient: QueryClient,
  deltas: PlayerStateSnapshot['deltas']
) {
  if (!deltas) return;

  if (deltas.goldChange) {
    queryClient.setQueryData(['economy', 'status'], (old: any) => ({
      ...old,
      gold: (BigInt(old.gold) + BigInt(deltas.goldChange)).toString(),
    }));
  }

  if (deltas.xpGained) {
    queryClient.setQueryData(['player', 'profile'], (old: any) => ({
      ...old,
      experience: old.experience + deltas.xpGained,
    }));
  }

  // ... handle unit deltas
}
```

---

## Implementation Phases

### Phase 1: Core Combat (Highest Impact)
- [x] Define `PlayerStateSnapshot` interface
- [ ] Create `buildPlayerSnapshot()` helper
- [ ] Update `POST /battle/attack/:defenderId` to return snapshot
- [ ] Update `POST /battle/spy/:defenderId` to return snapshot
- [ ] Create `updatePlayerCache()` helper
- [ ] Update attack page mutation to use cache sync
- [ ] Update spy page mutation to use cache sync
- [ ] Test: Attack → dashboard shows instant updates

### Phase 2: Training & Economy (High Impact)
- [ ] Update `POST /training/units` to return snapshot
- [ ] Update `POST /training/untrain` to return snapshot
- [ ] Update `POST /economy/deposit` to return snapshot
- [ ] Update `POST /economy/withdraw` to return snapshot
- [ ] Update frontend mutations to use cache sync
- [ ] Test: Train units → instant count update
- [ ] Test: Bank deposit → instant gold update

### Phase 3: Armory & Structures (Medium Impact)
- [ ] Update armory endpoints to return snapshot
- [ ] Update structures endpoints to return snapshot
- [ ] Update frontend mutations to use cache sync
- [ ] Test: Buy item → instant gold update
- [ ] Test: Upgrade building → instant gold update

### Phase 4: Recruitment & Misc (Lower Impact)
- [ ] Update recruitment endpoints to return snapshot
- [ ] Update any other mutation endpoints
- [ ] Audit all mutations to ensure coverage
- [ ] Test: Full user flow without manual refreshes

### Phase 5: Polish & Optimization
- [ ] Add delta tracking for animations (e.g., "+500 XP" toast)
- [ ] Add loading states during optimistic updates
- [ ] Document pattern in CLAUDE.md
- [ ] Consider adding to backend base controller class
- [ ] Consider WebSocket for cross-tab sync (future)

---

## Testing Checklist

For each mutation:
- [ ] Execute mutation
- [ ] Return to dashboard WITHOUT refreshing
- [ ] Verify gold updates instantly
- [ ] Verify XP/level updates instantly
- [ ] Verify unit counts update instantly
- [ ] Verify attack turns update instantly
- [ ] Execute another mutation to confirm chain works
- [ ] Test with slow network (throttle to 3G)
- [ ] Test error case (mutation fails, cache not corrupted)

---

## Notes

- **Backward Compatible**: Old endpoints still work, just add `playerState` field to responses
- **Optional Fields**: `updatedUnits` only included when units changed (saves bandwidth)
- **Invalidation Still Used**: For things not in snapshot (rankings, history, alliance data, etc.)
- **Incremental Rollout**: Can implement feature-by-feature without breaking existing flow
- **Performance**: Single DB query for snapshot is cheaper than 5 separate refetches
- **Cross-tab**: For now, tabs stay independent. Future: WebSocket broadcasts state changes

## Future Enhancements

1. **WebSocket State Sync**: Broadcast state updates to all connected tabs/clients
2. **Delta Animations**: Show "+500 XP" floating text based on deltas
3. **Optimistic UI**: Apply deltas immediately, then reconcile with snapshot on response
4. **Compression**: Use delta-only updates for bandwidth optimization
5. **Caching Layer**: Redis cache for hot player states (read replicas)
