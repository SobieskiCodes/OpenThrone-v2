import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TurnTickService } from './turn-tick.service';
import { DailyTickService } from './daily-tick.service';
import { SchedulerController } from './scheduler.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    forwardRef(() => ChatModule),
  ],
  controllers: [SchedulerController],
  providers: [TurnTickService, DailyTickService],
  exports: [TurnTickService, DailyTickService],
})
export class SchedulerModule {}
