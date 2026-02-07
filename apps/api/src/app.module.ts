import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlayerModule } from './player/player.module';
import { EconomyModule } from './economy/economy.module';
import { TrainingModule } from './training/training.module';
import { ArmoryModule } from './armory/armory.module';
import { StructuresModule } from './structures/structures.module';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { SocialModule } from './social/social.module';
import { AllianceModule } from './alliance/alliance.module';
import { ChatModule } from './chat/chat.module';
import { BlogModule } from './blog/blog.module';
import { AdminModule } from './admin/admin.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    PlayerModule,
    EconomyModule,
    TrainingModule,
    ArmoryModule,
    StructuresModule,
    RecruitmentModule,
    SocialModule,
    AllianceModule,
    ChatModule,
    BlogModule,
    AdminModule,
    SchedulerModule,
  ],
})
export class AppModule {}
