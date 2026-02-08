# OpenThrone v2 - Architecture & Development Guide

## Quick Start

```bash
pnpm install
pnpm db:generate        # Generate Prisma client
pnpm db:push            # Apply schema to SQLite
pnpm db:seed            # Seed test data
pnpm dev                # web → :3000, api → :3001
```

## Monorepo Structure

```
openthrone-v2/
├── apps/
│   ├── web/          # Next.js 15 App Router + Mantine 7 (frontend only)
│   └── api/          # NestJS 11 (all backend logic)
├── packages/
│   ├── shared/       # Enums, Zod schemas, inferred DTO types
│   ├── game-logic/   # Pure functions: unit costs, XP curves, item defs
│   ├── db/           # Prisma schema, client, migrations, seed
│   └── events/       # Event class definitions (emitted by API, consumed by listeners)
```

Managed by **Turborepo + pnpm workspaces**. Package imports use `@openthrone/<name>`.

## Package Responsibilities

### `@openthrone/shared`
- **Enums** (`enums.ts`): All game enums — `UnitType`, `ItemType`, `PlayerRace`, `BonusType`, etc.
- **Schemas** (`schemas.ts`): Zod validation schemas for every API endpoint. Inferred `*Dto` types exported alongside.
- **Types** (`types.ts`): Shared TypeScript interfaces.
- **Rule**: Every request/response shape lives here. Never define DTOs in `apps/api` or `apps/web`.

### `@openthrone/game-logic`
- Pure functions with **zero** framework or DB dependencies.
- Game constants: `UnitTypes`, `ItemTypes`, `Fortifications`, `BattleUpgrades`, `EconomyUpgrades`, etc.
- Lookup helpers: `getUnitByTypeAndLevel()`, `getItemDefinition()`, `getFortificationByLevel()`, etc.
- Formatting: `toLocale()`, `convertToHumanReadable()`.
- **Rule**: No imports from `@nestjs/*`, `@prisma/*`, or `next`. If it touches IO, it doesn't belong here.

### `@openthrone/db`
- Prisma schema (`prisma/schema.prisma`) — normalized tables, no JSON blobs.
- Currently uses **SQLite** for dev portability (swap `provider` to `postgresql` for production).
- Enums enforced at application layer (Zod + TypeScript), not DB-level, for cross-DB compatibility.
- `PrismaService` in `apps/api` wraps the generated client.

### `@openthrone/events`
- Event classes grouped by domain: `economy.events.ts`, `military.events.ts`, `structures.events.ts`, etc.
- Emitted via NestJS `EventEmitter2` in services, consumed by `@OnEvent()` listeners.
- Each event is a simple class with `readonly` constructor params.

## Backend Patterns (NestJS)

### Module Structure
Every game feature follows this pattern:
```
apps/api/src/<feature>/
├── <feature>.module.ts        # Registers controller + service, exports service
├── <feature>.controller.ts    # HTTP endpoints, validation, delegates to service
└── <feature>.service.ts       # Business logic, DB transactions, event emission
```

### Key Decorators
| Decorator | Location | Purpose |
|-----------|----------|---------|
| `@Public()` | `common/decorators/public.decorator.ts` | Skip JWT auth (e.g., recruitment link) |
| `@CurrentPlayer()` | `common/decorators/current-player.decorator.ts` | Extract authenticated player from request |
| `@Roles()` | `common/decorators/roles.decorator.ts` | Require specific permission roles |

### Validation
- Use `@UsePipes(new ZodValidationPipe(schema))` on every mutating endpoint.
- Schemas come from `@openthrone/shared` — never define inline Zod schemas in controllers.

### Service Pattern
```typescript
@Injectable()
export class FeatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async doThing(playerId: string, dto: SomeDto) {
    // 1. Wrap mutations in prisma.$transaction()
    const result = await this.prisma.$transaction(async (tx) => {
      // 2. Validate game state (check resources, permissions, etc.)
      // 3. Execute writes
      // 4. Return result
    });

    // 5. Emit event AFTER transaction commits
    this.eventEmitter.emit('domain.action', new SomeEvent(...));

    return result;
  }
}
```

### Global Auth
- `JwtAuthGuard` is registered as `APP_GUARD` — all endpoints require auth by default.
- Use `@Public()` to opt out for unauthenticated routes.
- Global prefix: `/api` (set in `main.ts`).

### BigInt Handling
- Gold values are `BigInt` in Prisma. Serialize to string in API responses (`gold.toString()`).
- Frontend sends gold amounts as string, validated with Zod regex `/^\d+$/`.

## Frontend Patterns (Next.js)

### Auth Flow
```
NextAuth v5 (apps/web/src/auth.ts) → Credentials provider → calls NestJS /api/auth/login
JWT stored in session → forwarded as Bearer token to API via ApiClient
```

### Providers Stack
```
RootLayout → MantineProvider → Notifications → Providers (SessionProvider + QueryClientProvider)
```

### Game Layout
- `apps/web/src/app/(game)/layout.tsx` — AppShell with sidebar nav, header, logout.
- All game pages live under `(game)/` route group.

### API Client
- `apps/web/src/lib/api-client.ts` — singleton `ApiClient` class.
- Methods: `get<T>()`, `post<T>()`, `patch<T>()`, `delete<T>()`.
- Auto-prepends `/api` prefix and attaches Bearer token.
- Frontend pages use TanStack Query (`useQuery`/`useMutation`) with `api.get()`/`api.post()`.

### Page Pattern
```tsx
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { notifications } from '@mantine/notifications';

export default function FeaturePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['feature', 'status'],
    queryFn: () => api.get('/feature/status'),
  });

  const mutation = useMutation({
    mutationFn: (body) => api.post('/feature/action', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature'] });
      notifications.show({ title: 'Success', message: '...', color: 'green' });
    },
    onError: (err) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });
}
```

## Adding a New Feature (Checklist)

1. **Enums** → `packages/shared/src/enums.ts` (if new enum types needed)
2. **Schemas** → `packages/shared/src/schemas.ts` (Zod schema + inferred DTO type)
3. **Game Logic** → `packages/game-logic/src/<feature>.ts` (constants, pure calc functions)
4. **Events** → `packages/events/src/<domain>.events.ts` (event classes, re-export from index)
5. **DB** → `packages/db/prisma/schema.prisma` (new models if needed, then `pnpm db:push`)
6. **API Module** → `apps/api/src/<feature>/` (module, controller, service)
7. **Frontend Page** → `apps/web/src/app/(game)/<section>/<feature>/page.tsx`
8. **Nav** → Add to `navItems` in `apps/web/src/app/(game)/layout.tsx`

## Environment Variables

See `.env.example` for the full list. Key ones:

| Variable | Where | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | `packages/db` | Prisma connection string |
| `JWT_SECRET` | `apps/api` | JWT signing key |
| `NEXTAUTH_SECRET` | `apps/web` | NextAuth session encryption |
| `NEXT_PUBLIC_API_URL` | `apps/web` | API base URL (client-side) |
| `API_URL` | `apps/web` | API base URL (server-side auth) |
| `NEXT_PUBLIC_TURNSTILE_SITE_ID` | `apps/web` | Cloudflare Turnstile CAPTCHA |
| `TURNSTILE_SECRET` | `apps/api` | Turnstile server-side validation |
| `ENABLE_*` | `apps/api` | Feature toggles |

## Never Do This

- **Never call the API directly from frontend pages** — always go through `api-client.ts`.
- **Never define Zod schemas or DTO types outside `@openthrone/shared`** — they must be shared.
- **Never put game constants in `apps/api` or `apps/web`** — they belong in `@openthrone/game-logic`.
- **Never use JSON blob columns** — normalize into proper tables with typed enums.
- **Never emit events inside a transaction** — emit after `$transaction()` resolves.
- **Never skip Zod validation** — every mutating endpoint gets `@UsePipes(new ZodValidationPipe(schema))`.
- **Never store gold as `number`** — always `BigInt` in DB/service, `string` in API responses.
- **Never import from `@prisma/client` directly in services** — use `PrismaService` injection.
- **Never put business logic in controllers** — controllers validate + delegate to services.
- **Never hardcode magic numbers** — game constants belong in `@openthrone/game-logic`.

## Build Phase Progress

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Foundation (monorepo, packages, scaffolding) | Done |
| 1 | Auth & Player Profile | Done |
| 1.5 | Boot-up fixes (SQLite, webpack, auth flow) | Done |
| 2 | Economy & Banking | Done |
| 3 | Training & Units | Done |
| 4 | Armory & Items | Done |
| 5 | Structures & Upgrades | Done |
| 6 | Recruitment | Done |
| 7 | Social & Alliances | Done |
| 8 | Messaging & Chat | Done |
| 9 | Blog & Community | Not Started |
| 10 | Scheduled Jobs (@nestjs/schedule) | Done |
| 11 | Admin Panel | Done |
| 12 | Battle Users & Rankings | Done |
| 13 | Combat System | Done |

Full phase details: `REBUILD_PLAN.md` Section 9.

## Reference
- Design philosophy & DarkThrone reference: top of `REBUILD_PLAN.md`
- Prisma schema: `packages/db/prisma/schema.prisma`
- API module map: `apps/api/src/app.module.ts`
