# Contributing to OpenThrone

## Dev Environment Setup

**Requirements:** Node >= 20, pnpm >= 9

```bash
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

This starts both servers:
- **Web** (Next.js): http://localhost:3000
- **API** (NestJS): http://localhost:3001

Test credentials are created by the seed script (check `packages/db/prisma/seed.ts`).

## Monorepo Layout

```
apps/web/          → Frontend (Next.js 15, Mantine 7, TanStack Query)
apps/api/          → Backend  (NestJS 11, Prisma, EventEmitter2)
packages/shared/   → Enums, Zod schemas, DTO types
packages/game-logic/ → Pure functions (no framework deps)
packages/db/       → Prisma schema + seed
packages/events/   → Event class definitions
```

All packages use `@openthrone/<name>` imports.

## Adding a New Feature

Follow this order:

1. **Enums** — `packages/shared/src/enums.ts`
2. **Schemas** — `packages/shared/src/schemas.ts` (Zod schema + inferred DTO)
3. **Game Logic** — `packages/game-logic/src/<feature>.ts` (constants, pure calc functions)
4. **Events** — `packages/events/src/<domain>.events.ts`
5. **Database** — `packages/db/prisma/schema.prisma` then `pnpm db:push`
6. **API Module** — `apps/api/src/<feature>/` (module + controller + service)
7. **Frontend Page** — `apps/web/src/app/(game)/<section>/page.tsx`
8. **Nav** — Add to `navItems` in `apps/web/src/app/(game)/layout.tsx`

## Key Patterns

### Backend (NestJS)

**Module structure** — every feature has:
```
apps/api/src/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
└── <feature>.service.ts
```

**Validation** — Use `@Body(new ZodValidationPipe(schema))` for body validation. Never use `@UsePipes()` when the method also has `@CurrentPlayer()` (it validates all params including the injected player object).

**Transactions** — Wrap mutations in `prisma.$transaction()`. Emit events *after* the transaction commits.

**Auth** — All endpoints require JWT by default. Use `@Public()` to opt out. Use `@Roles('ADMINISTRATOR')` for admin-only.

**Gold** — Always `BigInt` in DB/service, `string` in API responses. Frontend sends as string.

### Frontend (Next.js)

**API calls** — Always go through `apps/web/src/lib/api-client.ts`. Never call the API directly.

**Data fetching** — TanStack Query (`useQuery` / `useMutation`). Invalidate related query keys on mutation success.

**Notifications** — Use `@mantine/notifications` for user feedback on actions.

**Auth** — NextAuth v5 handles session. The `useApi()` hook provides an authenticated API client.

**UI Components** — Custom components in `apps/web/src/components/ui/` (OTCard, OTButton, OTBadge, etc.) plus Mantine 7 primitives.

## Hard Rules

- DTOs and schemas live in `@openthrone/shared` only
- Game constants live in `@openthrone/game-logic` only
- No JSON blob columns — normalize into proper tables
- No business logic in controllers — delegate to services
- No `@prisma/client` imports in services — use `PrismaService`
- No magic numbers — define constants in game-logic

## Database

SQLite for dev, PostgreSQL for prod. Schema at `packages/db/prisma/schema.prisma`.

```bash
pnpm db:push       # Apply schema changes (dev)
pnpm db:generate   # Regenerate Prisma client after schema changes
pnpm db:seed       # Reset and seed test data
pnpm db:populate   # Add 200 randomized test players
```

**Windows note:** Kill all node processes before running `db:generate` or `db:push` to avoid DLL locks:
```bash
taskkill /F /IM node.exe
```

## Scheduled Jobs

| Job | Schedule | What it does |
|-----|----------|--------------|
| Turn Tick | Every 30 min | +1 attack turn, gold income from workers/fort |
| Daily Tick | Midnight UTC | Citizen generation, ranking reset, auto-recruit pool reset, cleanup |

## Type Checking

```bash
pnpm type-check    # All packages
# Or individually:
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```

Always type-check before committing.
