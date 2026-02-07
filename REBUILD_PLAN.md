# OpenThrone v2 - Rebuild Plan

## 1. Why Rebuild

The current codebase is a working POC with ~83 API routes, 80+ components, and 14+ database tables all living inside a single Next.js app. It works, but it has accumulated structural debt:

- **Monolithic API layer**: All game logic runs in Next.js API routes with no separation between HTTP handling and business logic. Services exist but are inconsistently used.
- **JSON columns as schemas**: Units, items, upgrades, bonus points, and stats are stored as untyped JSON blobs in the `users` table. Validation happens (or doesn't) at the application layer.
- **No event system**: State changes (attack, train, bank deposit) are imperative — each handler manually updates every affected row. Adding side effects (notifications, audit logs, achievement checks) means touching every handler.
- **Mixed concerns**: The `users` table has 41 columns covering auth, economy, military, social, and display data. The `UserModel` class recalculates everything on every access.
- **Dev environment friction**: Custom server with Socket.IO, Bun runtime, ignored TypeScript/ESLint errors on build, no containerization.

The goal is not to rewrite everything at once. It's to stand up a proper foundation and migrate page-by-page, feature-by-feature, with the POC as the living reference.

---

## 2. Target Architecture

```
openthrone-v2/
├── apps/
│   ├── web/                    # Next.js 15 (App Router) — frontend only
│   └── api/                    # NestJS — backend, all game logic
├── packages/
│   ├── shared/                 # Shared types, constants, enums, validation schemas
│   ├── game-logic/             # Pure functions: damage calc, unit costs, XP curves
│   ├── db/                     # Prisma schema, client, migrations, seed
│   └── events/                 # Event type definitions, bus interface
├── docker/
│   ├── docker-compose.yml      # Postgres, Redis, API, Web, all-in-one dev
│   └── Dockerfile.*            # Per-service Dockerfiles
├── turbo.json                  # Turborepo pipeline config
├── pnpm-workspace.yaml
└── .env.example
```

### Stack Decisions

| Layer | Current | v2 |
|---|---|---|
| **Monorepo** | Single Next.js app | Turborepo + pnpm workspaces |
| **Frontend** | Next.js Pages Router + Mantine | Next.js 15 App Router + Mantine 7 |
| **Backend** | Next.js API routes | NestJS 11 |
| **Database** | PostgreSQL + Prisma (JSON columns) | PostgreSQL + Prisma (normalized tables) |
| **Auth** | NextAuth.js 4 (JWT) | NextAuth.js 5 (frontend) + NestJS Guards (backend) |
| **Real-time** | Socket.IO (bolted on) | Socket.IO via NestJS Gateway (first-class) |
| **Event Bus** | None | In-process EventEmitter2 (NestJS) → Redis pub/sub later |
| **Cache** | None | Redis (sessions, leaderboards, rate limiting) |
| **Queue** | None (cron via HTTP) | BullMQ (turn ticks, daily jobs, async tasks) |
| **Validation** | Mixed (Yup, Zod, manual) | Zod everywhere (shared package) |
| **Testing** | Jest + Cypress (sparse) | Vitest (unit/integration) + Playwright (e2e) |
| **Dev Environment** | Manual setup | Docker Compose one-command startup |

---

## 3. Event-Driven Design

### Core Principle

Every mutation in the game produces an **event**. Handlers react to events, not to each other. This decouples side effects from primary actions.

### Example Flow: Player Trains Units

```
HTTP Request: POST /training/train { unitType: "OFFENSE", level: 3, quantity: 10 }
    │
    ▼
TrainingService.train()
    ├── Validates request (Zod schema)
    ├── Checks player has enough citizens & gold
    ├── Executes DB transaction (deduct citizens/gold, add units)
    └── Emits: UnitsTrained { playerId, unitType, level, quantity, goldSpent }
            │
            ▼
        EventHandlers (async, non-blocking):
        ├── StatsListener     → Update cached offense/defense totals
        ├── AchievementListener → Check "Train 1000 units" achievement
        ├── AuditListener     → Write to audit_log table
        └── WebSocketGateway  → Push update to player's connected clients
```

### Event Categories

| Category | Example Events |
|---|---|
| **Economy** | `GoldDeposited`, `GoldWithdrawn`, `GoldTransferred`, `TurnGoldAwarded` |
| **Military** | `UnitsTrained`, `UnitsUntrained`, `UnitsConverted`, `ItemEquipped` |
| **Combat** | `AttackExecuted`, `SpyMissionExecuted`, `FortDamaged`, `FortRepaired` |
| **Social** | `FriendRequestSent`, `AllianceCreated`, `AllianceJoined`, `MessageSent` |
| **Account** | `PlayerRegistered`, `PlayerLoggedIn`, `AccountStatusChanged`, `LeveledUp` |
| **System** | `TurnTick`, `DailyTick`, `RankingsRecalculated` |

### Implementation

Phase 1 uses NestJS's built-in `EventEmitter2` module — synchronous in-process events. This is simple, testable, and sufficient for a single-server deployment.

Phase 2 (when needed) swaps the transport to Redis pub/sub or BullMQ for multi-instance deployments without changing any handler code.

```typescript
// packages/events/src/training.events.ts
export class UnitsTrainedEvent {
  constructor(
    public readonly playerId: number,
    public readonly unitType: UnitType,
    public readonly level: number,
    public readonly quantity: number,
    public readonly goldSpent: bigint,
  ) {}
}

// apps/api/src/training/training.service.ts
@Injectable()
export class TrainingService {
  constructor(
    private readonly db: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async train(playerId: number, dto: TrainUnitsDto) {
    const result = await this.db.$transaction(async (tx) => {
      // ... validation and mutation
    });
    this.events.emit('units.trained', new UnitsTrainedEvent(...));
    return result;
  }
}
```

---

## 4. Database Redesign

The biggest structural change. The current `users` table is 41 columns with 6 JSON blobs. The v2 schema normalizes these into proper relational tables.

### Key Changes

#### Users Table (slimmed down — auth + identity only)
```
players
  id            UUID (primary key)
  email         String (unique)
  display_name  String (unique)
  password_hash String
  race          PlayerRace (enum)
  class         PlayerClass (enum)
  locale        String
  avatar        String?
  bio           String?
  color_scheme  String?
  recruit_link  String (unique)
  status        AccountStatus (enum)
  last_active   DateTime
  created_at    DateTime
  updated_at    DateTime
```

#### Economy (separate table)
```
player_economy
  player_id     UUID (FK → players, unique)
  gold          BigInt
  gold_in_bank  BigInt
  attack_turns  Int
  house_level   Int
  economy_level Int
```

#### Units (normalized — no more JSON blob)
```
player_units
  id          Int (auto)
  player_id   UUID (FK → players)
  unit_type   UnitType (enum: CITIZEN, WORKER, OFFENSE, DEFENSE, SPY, SENTRY)
  level       Int
  quantity    Int

  @@unique([player_id, unit_type, level])
```

#### Items (normalized)
```
player_items
  id          Int (auto)
  player_id   UUID (FK → players)
  item_type   ItemType (enum)
  usage       ItemUsage (enum)
  level       Int
  quantity    Int

  @@unique([player_id, item_type, usage, level])
```

#### Upgrades (normalized)
```
player_battle_upgrades
  player_id      UUID (FK → players)
  upgrade_type   BattleUpgradeType (enum)
  level          Int
  quantity       Int

  @@unique([player_id, upgrade_type])

player_structure_upgrades
  player_id      UUID (FK → players)
  upgrade_type   StructureUpgradeType (enum)
  level          Int

  @@unique([player_id, upgrade_type])
```

#### Fortification (separate table)
```
player_fortification
  player_id     UUID (FK → players, unique)
  fort_level    Int
  hitpoints     Int
  max_hitpoints Int
```

#### Bonus Points (normalized)
```
player_bonus_points
  player_id   UUID (FK → players)
  bonus_type  BonusType (enum)
  level       Int

  @@unique([player_id, bonus_type])
```

#### Stats & Rankings (computed, cached)
```
player_stats
  player_id     UUID (FK → players, unique)
  experience    Int
  rank          Int
  offense       Int  (cached calculation)
  defense       Int  (cached calculation)
  spy           Int  (cached calculation)
  sentry        Int  (cached calculation)
  killing_str   Int
  defense_str   Int
  spying_str    Int
  sentry_str    Int
  updated_at    DateTime
```

### Migration Strategy

- v2 starts with a clean schema. No data migration from POC (it gets reset regularly anyway).
- Seed script generates test data matching the current game constants.
- The `packages/db` package owns the schema and exports a typed Prisma client.

---

## 5. Shared Packages

### `packages/shared`
All types, enums, and validation schemas that both frontend and backend need.

```typescript
// packages/shared/src/enums.ts
export enum PlayerRace { UNDEAD = 'UNDEAD', HUMAN = 'HUMAN', GOBLIN = 'GOBLIN', ELF = 'ELF' }
export enum PlayerClass { FIGHTER = 'FIGHTER', CLERIC = 'CLERIC', ASSASSIN = 'ASSASSIN', THIEF = 'THIEF' }
export enum UnitType { CITIZEN = 'CITIZEN', WORKER = 'WORKER', OFFENSE = 'OFFENSE', ... }

// packages/shared/src/schemas/training.schema.ts
export const trainUnitsSchema = z.object({
  unitType: z.nativeEnum(UnitType),
  level: z.number().int().min(1).max(10),
  quantity: z.number().int().min(1),
});
export type TrainUnitsDto = z.infer<typeof trainUnitsSchema>;
```

### `packages/game-logic`
Pure functions with zero dependencies on DB or framework. Fully testable in isolation.

Port directly from the current codebase:
- `src/constants/Units.tsx` → `packages/game-logic/src/units.ts`
- `src/constants/Items.tsx` → `packages/game-logic/src/items.ts`
- `src/constants/Fortifications.tsx` → `packages/game-logic/src/fortifications.ts`
- `src/constants/XPLevels.tsx` → `packages/game-logic/src/xp.ts`
- `src/constants/Bonuses.tsx` → `packages/game-logic/src/bonuses.ts`
- `src/constants/Battle_Upgrades.tsx` → `packages/game-logic/src/battle-upgrades.ts`
- `src/constants/Structure_Upgrades.tsx` → `packages/game-logic/src/structure-upgrades.ts`
- `src/utils/numberFormatting.ts` → `packages/game-logic/src/formatting.ts`
- `src/utils/units.ts` → `packages/game-logic/src/unit-costs.ts`

### `packages/events`
Event class definitions. Imported by both the API (to emit) and any future workers (to consume).

### `packages/db`
Prisma schema, generated client, seed script, migration files. Imported by `apps/api`.

---

## 6. Backend (NestJS) Module Structure

```
apps/api/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── guards/           # AuthGuard, RolesGuard, ThrottleGuard
│   ├── decorators/       # @CurrentPlayer(), @Roles()
│   ├── filters/          # Global exception filters
│   ├── interceptors/     # Logging, transform response
│   └── pipes/            # ZodValidationPipe
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts    # login, register, verify-email, reset-password
│   ├── auth.service.ts       # credential validation, token generation
│   └── strategies/           # JWT strategy, optional OAuth
├── player/
│   ├── player.module.ts
│   ├── player.controller.ts  # profile, settings, bonus points
│   ├── player.service.ts     # CRUD, stat recalculation
│   └── player.gateway.ts     # WebSocket: online status, profile updates
├── economy/
│   ├── economy.module.ts
│   ├── bank.controller.ts    # deposit, withdraw, history
│   ├── bank.service.ts
│   └── economy.listener.ts   # React to TurnTick, DailyTick
├── training/
│   ├── training.module.ts
│   ├── training.controller.ts
│   └── training.service.ts
├── armory/
│   ├── armory.module.ts
│   ├── armory.controller.ts  # equip, unequip, convert
│   └── armory.service.ts
├── structures/
│   ├── structures.module.ts
│   ├── structures.controller.ts  # upgrades, repair, housing
│   └── structures.service.ts
├── combat/                       # DEFERRED — stub only
│   ├── combat.module.ts
│   └── combat.controller.ts      # Returns 501 Not Implemented
├── recruitment/
│   ├── recruitment.module.ts
│   ├── recruitment.controller.ts
│   └── recruitment.service.ts
├── social/
│   ├── social.module.ts
│   ├── social.controller.ts      # friends, allies, enemies
│   └── social.service.ts
├── alliance/
│   ├── alliance.module.ts
│   ├── alliance.controller.ts
│   ├── alliance.service.ts
│   └── alliance-role.service.ts
├── chat/
│   ├── chat.module.ts
│   ├── chat.controller.ts        # REST: room list, history
│   ├── chat.service.ts
│   └── chat.gateway.ts           # WebSocket: real-time messages
├── blog/
│   ├── blog.module.ts
│   ├── blog.controller.ts
│   └── blog.service.ts
├── admin/
│   ├── admin.module.ts
│   ├── admin.controller.ts
│   └── admin.service.ts
├── scheduler/
│   ├── scheduler.module.ts
│   ├── turn-tick.processor.ts    # BullMQ: every 30 min
│   └── daily-tick.processor.ts   # BullMQ: daily
└── websocket/
    ├── websocket.module.ts
    └── websocket.gateway.ts      # Connection management, auth
```

### Authentication Flow (v2)

```
Browser → Next.js (NextAuth v5) → issues JWT
Browser → NestJS API (Bearer JWT) → AuthGuard validates → handler runs
```

NextAuth handles the login UI, CAPTCHA, session cookie. The NestJS API trusts the same JWT (shared secret). No session duplication.

### Rate Limiting & Security

- `@nestjs/throttler` on all mutation endpoints
- Helmet middleware for HTTP headers
- CORS locked to frontend origin
- Input validation via Zod pipe on every endpoint
- Argon2 for password hashing (no bcrypt migration baggage)
- CSRF protection on state-changing routes

---

## 7. Frontend (Next.js App Router) Structure

```
apps/web/src/
├── app/
│   ├── layout.tsx              # Root layout, providers, nav
│   ├── page.tsx                # Landing / dashboard
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx          # Auth layout (no sidebar)
│   ├── (game)/
│   │   ├── layout.tsx          # Game layout (sidebar, nav, footer)
│   │   ├── battle/
│   │   │   ├── training/page.tsx
│   │   │   ├── upgrades/page.tsx
│   │   │   ├── history/page.tsx
│   │   │   └── users/page.tsx
│   │   ├── structures/
│   │   │   ├── armory/page.tsx
│   │   │   ├── bank/page.tsx
│   │   │   ├── housing/page.tsx
│   │   │   ├── upgrades/page.tsx
│   │   │   └── repair/page.tsx
│   │   ├── social/page.tsx
│   │   ├── alliances/
│   │   │   ├── page.tsx        # Browse
│   │   │   ├── create/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── messaging/page.tsx
│   │   ├── recruit/page.tsx
│   │   ├── profile/[id]/page.tsx
│   │   └── community/page.tsx
│   └── admin/
│       ├── layout.tsx          # Admin-only layout
│       └── page.tsx
├── components/
│   ├── ui/                     # Generic UI primitives (wrappers around Mantine)
│   ├── game/                   # Game-specific components
│   └── layout/                 # Sidebar, Navbar, Footer
├── hooks/
│   ├── use-api.ts              # Typed fetch wrapper for NestJS API
│   ├── use-socket.ts           # Socket.IO hook
│   └── use-player.ts           # Current player data hook
├── lib/
│   ├── api-client.ts           # Configured fetch/axios instance
│   ├── auth.ts                 # NextAuth v5 config
│   └── socket.ts               # Socket.IO client setup
├── providers/
│   ├── auth-provider.tsx
│   ├── socket-provider.tsx
│   └── query-provider.tsx      # TanStack Query provider
└── styles/
```

### Data Fetching Strategy

- **TanStack Query** replaces SWR — better mutation support, optimistic updates, cache invalidation tied to events.
- **Server Components** for initial page loads (SEO doesn't matter much for a game, but SSR helps perceived performance).
- **Client Components** for interactive game UI (training forms, battle sim, chat).
- **Socket.IO** pushes invalidation signals → TanStack Query refetches affected queries.

```typescript
// Example: Bank page
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export default function BankPage() {
  const { data: economy } = useQuery({
    queryKey: ['player', 'economy'],
    queryFn: () => api.get('/player/economy'),
  });

  const deposit = useMutation({
    mutationFn: (amount: bigint) => api.post('/bank/deposit', { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player', 'economy'] });
    },
  });
  // ...
}
```

---

## 8. Dev Environment

### One-Command Setup

```bash
git clone <repo> openthrone-v2
cd openthrone-v2
cp .env.example .env
docker compose up -d        # Postgres + Redis
pnpm install
pnpm db:push                # Apply schema
pnpm db:seed                # Seed test data
pnpm dev                    # Starts both web (3000) and api (3001)
```

### Docker Compose (dev)

```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: openthrone
      POSTGRES_USER: openthrone
      POSTGRES_PASSWORD: openthrone
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  pgdata:
```

### Scripts (turbo pipeline)

```json
{
  "pipeline": {
    "dev": { "dependsOn": ["^build"], "persistent": true },
    "build": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "db:push": { "cache": false },
    "db:seed": { "cache": false },
    "lint": {}
  }
}
```

---

## 9. Migration Order (Page by Page)

Each phase delivers a working vertical slice. The POC stays live until v2 reaches feature parity.

### Phase 0: Foundation
- [ ] Initialize Turborepo monorepo with pnpm
- [ ] Create `packages/shared` with all enums, types, Zod schemas
- [ ] Create `packages/game-logic` — port constants and pure calc functions
- [ ] Create `packages/db` — new Prisma schema (normalized), seed script
- [ ] Create `packages/events` — event class definitions
- [ ] Set up Docker Compose (Postgres + Redis)
- [ ] Scaffold NestJS app with global guards, pipes, filters, interceptors
- [ ] Scaffold Next.js App Router app with Mantine, TanStack Query, auth
- [ ] Set up Vitest for all packages, Playwright for e2e
- [ ] CI pipeline (lint, type-check, test, build)

### Phase 1: Auth & Player Profile
**POC pages**: `/account/login`, `/account/register`, `/account/email-verify`, `/account/password-reset`, `/home`, `/userprofile/[id]`

- [ ] `auth` NestJS module — register, login, email verify, password reset
- [ ] NextAuth v5 integration in frontend
- [ ] `player` NestJS module — get profile, update settings, bonus points
- [ ] Home/dashboard page
- [ ] Player profile page
- [ ] Account settings pages (password change, email change, color scheme)

### Phase 2: Economy & Banking
**POC pages**: `/structures/bank`

- [ ] `economy` NestJS module — bank deposit, withdraw, transfer, history
- [ ] `player_economy` table operations
- [ ] Bank page with transaction history
- [ ] Event: `GoldDeposited`, `GoldWithdrawn`

### Phase 3: Training & Units
**POC pages**: `/battle/training`

- [ ] `training` NestJS module — train, untrain, convert
- [ ] Normalized `player_units` table operations
- [ ] Training page with unit selection, cost display
- [ ] Event: `UnitsTrained`, `UnitsUntrained`, `UnitsConverted`
- [ ] Stat recalculation listener (offense/defense/spy/sentry totals)

### Phase 4: Armory & Items
**POC pages**: `/structures/armory`

- [ ] `armory` NestJS module — equip, unequip, convert items
- [ ] Normalized `player_items` table operations
- [ ] Armory page
- [ ] Event: `ItemEquipped`, `ItemUnequipped`

### Phase 5: Structures & Upgrades
**POC pages**: `/structures/housing`, `/structures/upgrades`, `/structures/repair`, `/battle/upgrades`

- [ ] `structures` NestJS module — house upgrades, structure upgrades, battle upgrades, fort repair
- [ ] Normalized upgrade tables
- [ ] All structure pages
- [ ] Event: `StructureUpgraded`, `FortRepaired`

### Phase 6: Recruitment
**POC pages**: `/recruit`, `/recruit/[link]`, `/auto-recruit`

- [ ] `recruitment` NestJS module — recruit link, auto-recruit sessions
- [ ] Recruitment pages
- [ ] Event: `PlayerRecruited`

### Phase 7: Social & Alliances
**POC pages**: `/social`, `/alliances/browse`, `/alliances/create`, `/alliances/[id]`

- [ ] `social` NestJS module — friend/ally/enemy requests
- [ ] `alliance` NestJS module — create, join, roles, permissions, bank
- [ ] Social page, alliance pages
- [ ] Event: `FriendRequestSent`, `AllianceCreated`, `AllianceJoined`

### Phase 8: Messaging & Chat
**POC pages**: `/messaging`

- [ ] `chat` NestJS module + WebSocket gateway
- [ ] Chat rooms, DMs, alliance chat
- [ ] Reactions, replies, read receipts
- [ ] Real-time via Socket.IO gateway
- [ ] Event: `MessageSent`, `ReactionAdded`

### Phase 9: Blog & Community
**POC pages**: `/community`

- [ ] `blog` NestJS module — posts, read status
- [ ] Community/blog page

### Phase 10: Scheduled Jobs
- [ ] `scheduler` NestJS module with BullMQ
- [ ] Turn tick processor (gold + turns every 30 min)
- [ ] Daily tick processor (citizens, economy)
- [ ] Account status checker
- [ ] Replace external cron HTTP calls with in-process queues

### Phase 11: Admin Panel
**POC pages**: `/administration`

- [ ] `admin` NestJS module — user management, account actions, permissions
- [ ] Admin pages in frontend
- [ ] Role-based guards

### Phase 12: Battle Users & Rankings
**POC pages**: `/battle/users`, `/battle/history`, `/battle/results`

- [ ] Player listing with search/filter
- [ ] Rankings (cached in Redis)
- [ ] Battle history view (read-only — shows existing logs)
- [ ] Leaderboard page

### Phase 13: Combat System (future — explicitly deferred)
- Attack execution, spy missions, battle simulation
- This is the most complex module (~46KB of logic) and will be tackled separately

---

## 10. API Contract Between Frontend & Backend

Use a consistent REST convention. Consider generating an OpenAPI spec from NestJS decorators (`@nestjs/swagger`) so the frontend can auto-generate types.

```
GET    /api/player/me                    → Current player profile + economy + stats
GET    /api/player/:id                   → Public player profile
PATCH  /api/player/me                    → Update settings
POST   /api/player/me/bonus-points       → Allocate bonus points

POST   /api/auth/register                → Register
POST   /api/auth/login                   → Login (returns JWT)
POST   /api/auth/verify-email            → Verify email
POST   /api/auth/forgot-password         → Send reset email
POST   /api/auth/reset-password          → Reset with token

GET    /api/bank/history                 → Transaction history
POST   /api/bank/deposit                 → Deposit gold
POST   /api/bank/withdraw               → Withdraw gold

POST   /api/training/train               → Train units
POST   /api/training/untrain             → Untrain units
POST   /api/training/convert             → Convert units

POST   /api/armory/equip                 → Equip item
POST   /api/armory/unequip               → Unequip item

POST   /api/structures/upgrade           → Purchase upgrade
POST   /api/structures/repair            → Repair fort

GET    /api/alliances                    → List alliances
POST   /api/alliances                    → Create alliance
GET    /api/alliances/:id                → Alliance detail
POST   /api/alliances/:id/join           → Join alliance

GET    /api/chat/rooms                   → List rooms
GET    /api/chat/rooms/:id/messages      → Room messages
POST   /api/chat/rooms/:id/messages      → Send message

GET    /api/rankings                     → Leaderboard (cached)
GET    /api/rankings/:id/breakdown       → Stat breakdown
```

---

## 11. Security Checklist (Built In, Not Bolted On)

- [ ] Argon2id for all password hashing (no migration from bcrypt — clean start)
- [ ] JWT with short expiry (15 min access + rotating refresh tokens)
- [ ] CSRF tokens on all state-changing endpoints
- [ ] Rate limiting per-user and per-IP via `@nestjs/throttler`
- [ ] Input validation on every endpoint (Zod pipe — rejects before handler)
- [ ] SQL injection prevention (Prisma parameterized queries — already handled)
- [ ] XSS prevention (React's default escaping + CSP headers)
- [ ] Helmet.js for security headers
- [ ] CORS restricted to frontend origin only
- [ ] Remove `ADMIN_TAKE_OVER_PASSWORD` — use proper impersonation with audit trail
- [ ] Environment variable validation at startup (fail fast if missing)
- [ ] No secrets in client bundle (`NEXT_PUBLIC_` prefix audit)
- [ ] Audit log for all admin actions (who did what, when)

---

## 12. Testing Strategy

| Layer | Tool | What |
|---|---|---|
| **Unit** | Vitest | `packages/game-logic` pure functions, service methods with mocked DB |
| **Integration** | Vitest + Testcontainers | NestJS modules against real Postgres in Docker |
| **E2E** | Playwright | Full flows: register → login → train → bank → view profile |
| **API Contract** | Supertest | Every endpoint returns expected shape |
| **Type Safety** | `tsc --noEmit` | No type errors across all packages |

### Test file convention
```
src/training/training.service.ts
src/training/training.service.spec.ts      # unit tests
src/training/training.controller.e2e.ts    # endpoint tests
```

---

## 13. Open Questions / Decisions Needed

1. **UUID vs auto-increment for player IDs?** UUIDs are better for distributed systems and prevent ID enumeration. Auto-increment is simpler for a game where player IDs are public. Recommendation: UUID.

2. **Monorepo tool?** Turborepo is fast and simple. Nx is more feature-rich but heavier. Recommendation: Turborepo.

3. **ORM?** Prisma is already known. Drizzle is lighter and gives more SQL control. Recommendation: Stay with Prisma for familiarity, revisit if performance becomes an issue.

4. **Frontend state?** TanStack Query for server state, Zustand for client-only state (UI toggles, modals). No Redux.

5. **Deploy target?** The current POC runs on a VPS. Docker Compose works for single-server. If scaling is needed later, the NestJS API is already containerized and stateless.

6. **Keep the `messages` table (old DM system)?** The `ChatRoom`/`ChatMessage` system supersedes it. Recommendation: Drop `messages`, migrate to chat-only.

---

## 14. What NOT to Migrate (Cleanup)

- `ADMIN_TAKE_OVER_PASSWORD` — security risk, replace with proper admin impersonation
- Bcrypt password hashes — clean start with Argon2 only
- JSON blob columns (`units`, `items`, `battle_upgrades`, `structure_upgrades`, `bonus_points`, `stats`) — normalized in v2
- `messages` table — superseded by `ChatMessage`
- `recruit_history.usersId` — redundant FK
- Build-time error suppression (`eslint.ignoreDuringBuilds`, `typescript.ignoreBuildErrors`)
- Dual password hashing strategy (bcrypt + argon2 detection)
- Custom HTTP server for Socket.IO — NestJS handles this natively

---

## 15. Success Criteria

A phase is "done" when:

1. All pages in that phase render and function identically to the POC
2. All API endpoints for that phase have integration tests passing
3. Events are emitted for every state mutation
4. No TypeScript errors, no ESLint warnings
5. The feature works end-to-end in Docker Compose dev environment
6. Security checklist items relevant to that phase are addressed

The v2 is "ready to replace the POC" when phases 0-12 are complete and a full Playwright e2e suite passes covering the core gameplay loop (register → train → upgrade → bank → view rankings).
