import { Module } from '@nestjs/common';
import { BattleController } from './battle.controller';
import { BattleService } from './battle.service';
import { RankingsService } from './rankings.service';
import { RankingsListener } from './rankings.listener';

@Module({
  controllers: [BattleController],
  providers: [BattleService, RankingsService, RankingsListener],
  exports: [BattleService, RankingsService],
})
export class BattleModule {}
