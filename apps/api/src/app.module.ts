import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './auth/auth.module';
import { PlayerModule } from './player/player.module';
import { EconomyModule } from './economy/economy.module';
import { TrainingModule } from './training/training.module';
import { ArmoryModule } from './armory/armory.module';
import { StructuresModule } from './structures/structures.module';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { SocialModule } from './social/social.module';
import { AllianceModule } from './alliance/alliance.module';
import { MailModule } from './mail/mail.module';
import { ChatModule } from './chat/chat.module';
import { BlogModule } from './blog/blog.module';
import { BattleModule } from './battle/battle.module';
import { AdminModule } from './admin/admin.module';
import { BotModule } from './bot/bot.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ActivityModule } from './activity/activity.module';
import { GameModule } from './game/game.module';
import { ShopModule } from './shop/shop.module';
import { SettingsModule } from './settings/settings.module';
import { SimulatorModule } from './simulator/simulator.module';
import { GameDataModule } from './game-data/game-data.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    GameDataModule,
    GameModule,
    AuthModule,
    PlayerModule,
    EconomyModule,
    TrainingModule,
    ArmoryModule,
    StructuresModule,
    RecruitmentModule,
    SocialModule,
    AllianceModule,
    MailModule,
    ChatModule,
    BlogModule,
    BattleModule,
    AdminModule,
    BotModule,
    SchedulerModule,
    ActivityModule,
    ShopModule,
    SettingsModule,
    SimulatorModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
