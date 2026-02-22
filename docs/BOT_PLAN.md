# OpenThrone Bot System - LLM Enhancement Plan

## Current State ✅

You already have a **comprehensive rule-based bot system**:

### Existing Components
- ✅ **BotModule** - Full NestJS module with 6 services
- ✅ **5 Strategies** - WARRIOR, TURTLE, ECONOMIST, SPYMASTER, BALANCED
- ✅ **Decision Engine** - Weight-based prioritization (bot-strategies.ts)
- ✅ **Action Executor** - Calls existing game services (training, bank, armory, etc.)
- ✅ **Scheduler** - Cron-based (every 4 hours, max sessions/day configurable)
- ✅ **Bot Generation** - Creates realistic bots with items/stats by level
- ✅ **Action Logging** - Full audit trail (BotActionLog table)
- ✅ **Snapshots** - Daily metrics tracking for analytics
- ✅ **Admin API** - CRUD endpoints for bot management

### Current Architecture
```
┌─────────────────────────────────────┐
│     Bot Scheduler (Cron)            │
│  Runs every 4 hours, 6x/day max    │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   Bot Brain (Rule-Based)            │
│  - Strategy weights                 │
│  - Action prioritization            │
│  - Gold budgeting                   │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│   Bot Executor                      │
│  Calls existing game services:      │
│  - TrainingService                  │
│  - BankService                      │
│  - ArmoryService                    │
│  - BattleService, etc.              │
└─────────────────────────────────────┘
```

**What's Missing:**
- ❌ LLM decision-making (GPT/Claude/local models)
- ❌ Chat personality & behavior
- ❌ External bot runner (run on separate hardware)
- ❌ Real-time WebSocket state sync for bots
- ❌ Dynamic learning/adaptation

---

## Enhancement Goals

Transform the existing rule-based system into a **hybrid system** that supports:

1. **Internal Rule-Based Bots** (existing) - Fast, cheap, deterministic
2. **Internal LLM Bots** (new) - Smart, contextual, chat-capable (same cron schedule)
3. **External LLM Bots** (new) - Run on your local machine with local models, full control

---

## Phase 1: LLM Decision Engine (Internal)

### Goal
Add LLM-based decision-making as an **alternative** to rule-based strategies.

### 1.1 Bot Config Enhancement
```typescript
// packages/db/prisma/schema.prisma
model BotConfig {
  // ... existing fields ...
  decision_engine String @default("RULE_BASED") // "RULE_BASED" | "LLM" | "HYBRID"
  llm_provider String? // "OPENAI" | "AZURE" | "ANTHROPIC" | null
  llm_model String? // "gpt-4o" | "claude-opus-4" | null
  chat_enabled Boolean @default(false)
  chat_personality String? // JSON blob with personality traits
}
```

### 1.2 LLM Brain Service
```typescript
// apps/api/src/bot/bot-llm-brain.service.ts
@Injectable()
export class BotLLMBrainService {
  constructor(
    private readonly openai: OpenAIService, // or LangChain
    private readonly botService: BotService,
  ) {}

  async decideActionsWithLLM(
    strategy: string,
    state: BotGameState,
    personality: any,
  ): Promise<PrioritizedAction[]> {
    // 1. Build context prompt with game state
    // 2. Call LLM with structured output
    // 3. Parse LLM response into actions
    // 4. Validate/sanitize actions
    // 5. Return prioritized list
  }

  async generateChatMessage(
    context: ChatContext,
    personality: any,
  ): Promise<string> {
    // Generate chat messages based on personality
  }
}
```

### 1.3 Hybrid Scheduler
Update `BotSchedulerService` to check `decision_engine` field:
```typescript
const actions = config.decision_engine === 'LLM'
  ? await this.llmBrain.decideActionsWithLLM(strategy, state, personality)
  : this.ruleBrain.decideActions(strategy, state, seed);
```

### Deliverables
- ✅ LLM bots can run on same cron schedule as rule-based bots
- ✅ Configurable per-bot (mix LLM and rule-based bots)
- ✅ LLM responses validated and logged
- ✅ Cost tracking for LLM API calls

---

## Phase 2: Chat Integration

### Goal
Bots can send chat messages based on events and personality.

### 2.1 Chat Triggers
```typescript
// apps/api/src/bot/bot-chat.service.ts
@Injectable()
export class BotChatService {
  constructor(
    private readonly chatService: ChatService,
    private readonly llmBrain: BotLLMBrainService,
  ) {}

  async onAttackWin(botId: string, targetName: string) {
    const config = await this.getBotConfig(botId);
    if (!config.chat_enabled) return;

    const message = await this.llmBrain.generateChatMessage({
      event: 'attack_win',
      target: targetName,
      personality: config.chat_personality,
    });

    await this.chatService.sendSystemMessage(message, 'PLAYER');
  }

  async onBeingAttacked(botId: string, attackerName: string) {
    // React to being attacked
  }

  async onMention(botId: string, message: string, sender: string) {
    // Respond when @mentioned in chat
  }

  async sendPeriodicMessage(botId: string) {
    // Random chat based on personality (boasting, threatening, etc.)
  }
}
```

### 2.2 Chat Personality Schema
```json
{
  "name": "Ragnar the Ruthless",
  "tone": "aggressive, boastful",
  "traits": ["intimidating", "competitive", "vengeful"],
  "chatFrequency": "medium", // how often to chat unprompted
  "reactions": {
    "onAttackWin": "boast and threaten others",
    "onAttackLoss": "vow revenge",
    "onBeingSpied": "threaten the spy",
    "onMention": "respond confrontationally"
  },
  "exampleMessages": [
    "Your armies will crumble before mine!",
    "Another pathetic kingdom falls to Ragnar!",
    "Who dares challenge the might of the Ruthless?"
  ]
}
```

### 2.3 Event Listeners
Hook into existing events:
```typescript
@OnEvent('battle.completed')
async handleBattleCompleted(event: BattleCompletedEvent) {
  // If attacker or defender is a bot, trigger chat
}

@OnEvent('spy.intel_gained')
async handleSpyIntel(event: SpyIntelEvent) {
  // Bot reacts to being spied on
}
```

### Deliverables
- ✅ Bots send chat messages on key events
- ✅ Bots respond to @mentions
- ✅ Configurable personality per bot
- ✅ Chat feels "alive" and in-character

---

## Phase 3: External Bot Runner

### Goal
Allow bots to run on **your local computer** using local LLMs (Ollama, Llama, etc.) or cloud APIs.

### 3.1 Why External?
- **Local Models** - Run Llama 3, Mistral, etc. on your GPU (free)
- **Separate Hardware** - Don't load down the game server
- **Dev/Test** - Iterate on bot logic without server restarts
- **Scalability** - Run multiple bot runners on different machines

### 3.2 Architecture
```
┌─────────────────────────────────────┐
│  External Bot Runner                │
│  (Your Local Computer)              │
│  ┌──────────────────────────────┐  │
│  │  LangChain + Ollama          │  │
│  │  (Llama 3.1, Mistral, etc.)  │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  Bot Manager                 │  │
│  │  - Spawns bot agents         │  │
│  │  - Schedules actions         │  │
│  │  - Monitors health           │  │
│  └──────────────────────────────┘  │
└───────────┬─────────────────────────┘
            ↓ (REST API + WebSocket)
┌─────────────────────────────────────┐
│  OpenThrone API Server              │
│  - Bot authentication (JWT)         │
│  - Same endpoints as humans         │
│  - WebSocket state sync             │
└─────────────────────────────────────┘
```

### 3.3 New Monorepo Package: `apps/bot-runner`
```typescript
// apps/bot-runner/src/index.ts
import { BotManager } from './bot-manager';
import { loadConfig } from './config';

async function main() {
  const config = loadConfig(); // Load bot configs from JSON
  const manager = new BotManager(config);

  await manager.start();
  // Spawns multiple bot agents, each running in their own loop
}

main();
```

### 3.4 Bot Manager
```typescript
// apps/bot-runner/src/bot-manager.ts
export class BotManager {
  private bots: Map<string, BotAgent> = new Map();

  async start() {
    // Load bot configs from JSON files
    const configs = await this.loadBotConfigs();

    // Spawn each bot as a separate agent
    for (const config of configs) {
      const agent = new BotAgent(config, this.apiClient, this.llm);
      this.bots.set(config.id, agent);
      agent.start(); // Start the bot's decision loop
    }
  }

  async stop() {
    for (const bot of this.bots.values()) {
      await bot.stop();
    }
  }
}
```

### 3.5 Bot Agent
```typescript
// apps/bot-runner/src/bot-agent.ts
export class BotAgent {
  private running = false;

  constructor(
    private config: BotConfig,
    private apiClient: ApiClient,
    private llm: LLMChain,
  ) {}

  async start() {
    this.running = true;

    // Main loop
    while (this.running) {
      try {
        // 1. Observe game state (via API)
        const state = await this.apiClient.getGameState(this.config.playerId);

        // 2. Decide actions (via LLM)
        const actions = await this.decideActions(state);

        // 3. Execute actions (via API)
        for (const action of actions) {
          await this.executeAction(action);
          await this.sleep(1000); // Delay between actions
        }

        // 4. Wait until next session
        await this.sleep(this.config.actionInterval * 1000);
      } catch (err) {
        console.error(`Bot ${this.config.name} error:`, err);
      }
    }
  }

  async decideActions(state: GameState): Promise<Action[]> {
    // Use LangChain to query LLM with game state
    const prompt = this.buildPrompt(state);
    const response = await this.llm.call({ prompt });
    return this.parseActions(response);
  }

  async executeAction(action: Action) {
    switch (action.type) {
      case 'train':
        await this.apiClient.trainUnits(action.params);
        break;
      case 'attack':
        const target = await this.findTarget();
        await this.apiClient.attack(target.id, action.params.turns);
        break;
      // ... etc
    }
  }
}
```

### 3.6 API Client
```typescript
// apps/bot-runner/src/api-client.ts
export class ApiClient {
  constructor(
    private baseUrl: string,
    private credentials: { email: string; password: string },
  ) {}

  async login() {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(this.credentials),
    });
    const { token } = await res.json();
    this.token = token;
  }

  async getGameState(playerId: string): Promise<GameState> {
    return this.get(`/player/me`);
  }

  async trainUnits(params: any) {
    return this.post('/training/train', params);
  }

  async attack(targetId: string, turns: number) {
    return this.post('/battle/attack', { defenderId: targetId, turns });
  }

  // ... all other game endpoints
}
```

### 3.7 WebSocket State Sync
External bots connect to `/game` WebSocket namespace for real-time updates:
```typescript
// apps/bot-runner/src/websocket-client.ts
export class WebSocketClient {
  async connect(token: string) {
    this.socket = io(`${API_URL}/game`, {
      auth: { token },
    });

    this.socket.on('state.updated', (state) => {
      // Update local state cache
      this.handleStateUpdate(state);
    });

    this.socket.on('player.attacked', (event) => {
      // React to being attacked
      this.handleAttack(event);
    });
  }
}
```

### Deliverables
- ✅ External bot runner runs on your local machine
- ✅ Uses same API as human players (no special access)
- ✅ Can run local models (Ollama) or cloud models (OpenAI)
- ✅ WebSocket connection for real-time state
- ✅ Multiple bots managed by one runner
- ✅ Graceful shutdown and error handling

---

## Phase 4: Advanced Features

### 4.1 Multi-Bot Coordination
- Bots can form alliances with each other
- Coordinate attacks on shared targets
- Share spy intel via alliance channels

### 4.2 Learning & Adaptation
- Track win/loss ratios per strategy
- Adjust weights based on outcomes
- Store learned patterns in bot config

### 4.3 Dynamic Personalities
- Personality evolves based on game events
- Bots can become more aggressive after losses
- Bots can become defensive when wealthy

### 4.4 Bot Events
- Weekly "boss bot" spawns with high rewards
- Bot-triggered server events (tournaments, raids)
- Storyline bots (recurring villain, quest-giver)

---

## Tech Stack

### Internal LLM Bots (Phase 1-2)
- **LangChain.js** - LLM orchestration
- **OpenAI SDK** - GPT-4o/4/3.5 (or Azure)
- **Anthropic SDK** - Claude Opus 4/Sonnet (optional)
- **Prompt Engineering** - Structured output with JSON schema

### External Bot Runner (Phase 3)
- **Language**: TypeScript + Node.js
- **LLM**:
  - **Ollama** - Run Llama 3.1, Mistral, Phi, etc. locally (free)
  - **LangChain.js** - Unified interface for all LLM providers
  - **OpenAI/Azure** - Cloud option (costs money)
- **WebSocket**: Socket.IO Client
- **HTTP**: axios or native fetch
- **Config**: JSON files for bot personas

### Local Model Options
- **Ollama** - Easiest way to run local models
  - Llama 3.1 (8B, 70B) - Great for chat
  - Mistral 7B/NeMo - Fast, efficient
  - Phi-3 - Tiny model for simple bots
- **LangChain + Ollama** - Drop-in replacement for OpenAI

---

## Cost Considerations

### Internal LLM Bots
**OpenAI GPT-4o:**
- Input: $2.50 / 1M tokens
- Output: $10 / 1M tokens
- Est. 500 tokens per decision (~$0.006/decision)
- 50 bots × 6 sessions/day × 10 decisions = 3,000 decisions/day
- **Monthly cost: ~$540**

**OpenAI GPT-3.5-turbo:**
- Input: $0.50 / 1M tokens
- Output: $1.50 / 1M tokens
- **Monthly cost: ~$100** (much cheaper)

### External Bots (Local Models)
- **Free** (uses your GPU/CPU)
- One-time GPU cost if needed
- Llama 3.1 8B runs on 8GB VRAM
- Mistral 7B runs on 6GB VRAM

### Hybrid Approach (Recommended)
- **Internal bots**: Rule-based (free) + GPT-3.5 for special bots (~$50/mo)
- **External bots**: Local models on your machine (free) + GPT-4o for "legendary bots" (~$20/mo)
- **Total: ~$70/mo** for smart, chatty bots

---

## API Changes Needed

### New Endpoints (Optional Conveniences)
| Endpoint | Purpose |
|----------|---------|
| `GET /api/game/state` | Full game state snapshot for bots |
| `GET /api/game/targets` | List of valid attack targets with filtering |
| `GET /api/game/recommendations` | Suggest actions based on state |

All other endpoints already exist and work for bots.

---

## Implementation Priority

### Phase 1: Internal LLM Bots (2-3 weeks)
1. Add `decision_engine` field to BotConfig
2. Create `BotLLMBrainService` with OpenAI/LangChain
3. Update scheduler to support LLM bots
4. Add cost tracking and logging
5. **MVP**: 5-10 LLM bots running alongside rule-based bots

### Phase 2: Chat Integration (1-2 weeks)
1. Add `chat_personality` JSON field to BotConfig
2. Create `BotChatService` with event listeners
3. Hook into battle/spy events
4. Generate chat messages via LLM
5. **MVP**: Bots chat on attacks, respond to @mentions

### Phase 3: External Bot Runner (2-3 weeks)
1. Create `apps/bot-runner` package
2. Implement BotManager + BotAgent classes
3. API client wrapper
4. WebSocket state sync
5. Local model integration (Ollama + LangChain)
6. **MVP**: 1 bot running on your local machine

### Phase 4: Advanced Features (ongoing)
- Multi-bot coordination
- Learning/adaptation
- Dynamic personalities
- Bot-triggered events

---

## Next Steps

1. **Discuss priorities** - Which phase to start with?
2. **Choose LLM provider** - OpenAI, Azure, Anthropic, or local (Ollama)?
3. **Phase 1 POC** - Single LLM bot using existing scheduler
4. **Test & Iterate** - Refine prompts, validate decisions
5. **Scale** - Add more LLM bots, then external runner

---

## Open Questions

1. **Phase Priority** - Start with internal LLM (Phase 1) or external runner (Phase 3)?
2. **LLM Provider** - Cloud (OpenAI/Azure) or local (Ollama)? Or both?
3. **Chat Frequency** - How chatty should bots be? (Don't want to spam)
4. **Bot Density** - How many LLM bots vs rule-based bots?
5. **Rate Limits** - Should external bots have stricter rate limits?
6. **Authentication** - How do external bots authenticate? (Bot API keys?)

---

## Summary

You already have a **production-ready rule-based bot system**. The enhancements add:

✅ **LLM Decision-Making** - Smarter, context-aware actions
✅ **Chat Personality** - Bots feel alive and in-character
✅ **External Runner** - Run bots on your local machine with local models
✅ **WebSocket Sync** - Real-time state updates for bots
✅ **Hybrid System** - Mix rule-based, internal LLM, and external LLM bots

This gives you the best of both worlds: cheap, fast rule-based bots **plus** smart, chatty LLM bots!
