import { PrismaClient } from '@prisma/client';
import { BotService } from '../apps/api/src/bot/bot.service';
import { BotBrainService } from '../apps/api/src/bot/bot-brain.service';
import { BotExecutorService } from '../apps/api/src/bot/bot-executor.service';
import { BotSimulationService } from '../apps/api/src/bot/bot-simulation.service';
import { BotSnapshotService } from '../apps/api/src/bot/bot-snapshot.service';
import { BattleService } from '../apps/api/src/battle/battle.service';
import { TrainingService } from '../apps/api/src/training/training.service';
import { BankService } from '../apps/api/src/economy/bank.service';
import { StructuresService } from '../apps/api/src/structures/structures.service';
import { ShopService } from '../apps/api/src/shop/shop.service';
import { PlayerService } from '../apps/api/src/player/player.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

const prisma = new PrismaClient();
const eventEmitter = new EventEmitter2();

(async () => {
  try {
    console.log('🤖 Running 2-day test simulation...\n');

    // Manually construct the service dependencies
    const botService = new BotService(prisma, eventEmitter);
    const botBrain = new BotBrainService();
    const battleService = new BattleService(prisma, eventEmitter);
    const trainingService = new TrainingService(prisma, eventEmitter);
    const bankService = new BankService(prisma, eventEmitter);
    const structuresService = new StructuresService(prisma, eventEmitter);
    const shopService = new ShopService(prisma, eventEmitter);
    const playerService = new PlayerService(prisma, eventEmitter);

    const botExecutor = new BotExecutorService(
      prisma,
      battleService,
      trainingService,
      bankService,
      structuresService,
      shopService,
      playerService,
    );

    const snapshotService = new BotSnapshotService(prisma);

    const simulation = new BotSimulationService(
      prisma,
      botService,
      botBrain,
      botExecutor,
      snapshotService,
      eventEmitter,
    );

    const result = await simulation.runSimulation(2, 5); // 2 days, 5 sessions/day

    console.log('\n✅ Simulation complete!');
    console.log(`Status: ${result.status}`);
    console.log(`Total actions: ${result.totalActions}`);
    console.log(`Duration: ${((Date.now() - result.startTime) / 1000).toFixed(1)}s`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
})();
