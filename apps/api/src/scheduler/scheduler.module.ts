import { Module } from '@nestjs/common';
import { TurnTickService } from './turn-tick.service';
import { DailyTickService } from './daily-tick.service';

@Module({
  providers: [TurnTickService, DailyTickService],
  exports: [TurnTickService, DailyTickService],
})
export class SchedulerModule {}
