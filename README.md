# OpenThrone

A slow, text-driven strategy game where power grows quietly, reputation spreads loudly, and every decision leaves a public scar.

Inspired by classic browser games like DarkThrone and Kings of Chaos.

## What Is This?

OpenThrone is a free, open-source, asynchronous multiplayer strategy game. Players build kingdoms, train armies, forge alliances, and wage war — all through a text-based interface with turn-based mechanics.

No twitch skill. No animations. No pay-to-win. Just strategy, reputation, and consequences.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), Mantine 7, TanStack Query |
| Backend | NestJS 11, Prisma ORM, EventEmitter2 |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Auth | NextAuth v5 + JWT |
| Monorepo | Turborepo + pnpm workspaces |
| Language | TypeScript (strict) everywhere |

## Quick Start

```bash
# Prerequisites: Node >= 20, pnpm >= 9
git clone https://github.com/your-org/OpenThrone-v2.git
cd OpenThrone-v2

pnpm install
pnpm db:generate        # Generate Prisma client
pnpm db:push            # Apply schema to SQLite
pnpm db:seed            # Seed test data (creates test players)
pnpm dev                # web → localhost:3000, api → localhost:3001
```

Copy `.env.example` to `.env` (repo root) before running the app. For local auth, set `JWT_SECRET`, `NEXTAUTH_SECRET`, and `AUTH_SECRET` to the same value.

Seeded admin login after `pnpm db:seed`:
- email: `testplayer1@openthrone.dev`
- password: `password123`

## Project Structure

```
openthrone-v2/
├── apps/
│   ├── web/              # Next.js frontend (UI only, no business logic)
│   └── api/              # NestJS backend (all game logic, auth, jobs)
├── packages/
│   ├── shared/           # Enums, Zod schemas, shared DTO types
│   ├── game-logic/       # Pure functions: costs, XP curves, combat math
│   ├── db/               # Prisma schema, client, seed scripts
│   └── events/           # Event class definitions
├── CLAUDE.md             # Architecture guide (for AI-assisted dev)
├── DESIGN.md             # Game design philosophy & core pillars
├── BACKLOG.md            # Feature ideas & bug notes
└── CONTRIBUTING.md       # Developer guide
```

## Game Features

- **Economy** — Gold, banking, deposits/withdrawals, interest
- **Military** — Train citizens into soldiers, equip weapons/armor
- **Combat** — Attack other players, steal gold, multi-turn scaling
- **Spy Operations** — Intel, assassination, infiltration, steal gold, sabotage
- **Structures** — Fortifications, economy upgrades, housing, armory, mercenary camp
- **Alliances** — Create/join factions, shared intel, member management
- **Rankings** — Global leaderboards across combat, economy, army, and social categories
- **Recruitment** — Recruit links, daily auto-recruit pool
- **Messaging** — In-game mail system
- **Admin Panel** — Player management, job monitoring, combat simulator
- **Scheduled Jobs** — Turn ticks (every 30 min), daily reset (midnight UTC)

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start both web (3000) and api (3001) in watch mode |
| `pnpm build` | Production build |
| `pnpm type-check` | TypeScript type checking across all packages |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:push` | Apply schema to database |
| `pnpm db:seed` | Seed test data |
| `pnpm db:populate` | Generate 200 randomized test players |

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — Architecture reference, patterns, and guardrails
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — How to add features, dev workflow
- **[DESIGN.md](./DESIGN.md)** — Game design philosophy and core pillars
- **[BACKLOG.md](./BACKLOG.md)** — Feature ideas and known issues
- **[REBUILD_PLAN.md](./REBUILD_PLAN.md)** — Original rebuild plan from POC migration

## License

TBD
