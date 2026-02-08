import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TurnTickService } from './turn-tick.service';
import { DailyTickService } from './daily-tick.service';
import { SchedulerController } from './scheduler.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [SchedulerController],
  providers: [TurnTickService, DailyTickService],
  exports: [TurnTickService, DailyTickService],
})
export class SchedulerModule {}
