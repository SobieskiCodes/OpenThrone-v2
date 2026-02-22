import { Module } from '@nestjs/common';
import { TrainingModule } from '../training/training.module';
import { EconomyModule } from '../economy/economy.module';
import { ArmoryModule } from '../armory/armory.module';
import { StructuresModule } from '../structures/structures.module';
import { BattleModule } from '../battle/battle.module';
import { RecruitmentModule } from '../recruitment/recruitment.module';
import { ChatModule } from '../chat/chat.module';
import { SettingsModule } from '../settings/settings.module';
import { ShopModule } from '../shop/shop.module';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { BotBrainService } from './bot-brain.service';
import { BotExecutorService } from './bot-executor.service';
import { BotSchedulerService } from './bot-scheduler.service';
import { BotSnapshotService } from './bot-snapshot.service';
import { BotSimulationService } from './bot-simulation.service';
import { BotChatService } from './bot-chat.service';
import { BotMemoryService } from './bot-memory.service';

@Module({
  imports: [
    TrainingModule,
    EconomyModule,
    ArmoryModule,
    StructuresModule,
    BattleModule,
    RecruitmentModule,
    ChatModule,
    SettingsModule,
    ShopModule,
  ],
  controllers: [BotController],
  providers: [
    BotService,
    BotBrainService,
    BotExecutorService,
    BotSchedulerService,
    BotSnapshotService,
    BotSimulationService,
    BotChatService,
    BotMemoryService,
  ],
  exports: [BotService],
})
export class BotModule {}
