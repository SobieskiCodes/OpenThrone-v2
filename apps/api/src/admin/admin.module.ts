import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminCombatSimController } from './admin-combat-sim.controller';
import { AdminCombatSimService } from './admin-combat-sim.service';
import { AdminGameDataController } from './admin-game-data.controller';
import { AdminGameDataService } from './admin-game-data.service';
import { GameDataModule } from '../game-data/game-data.module';

@Module({
  imports: [GameDataModule],
  controllers: [AdminController, AdminCombatSimController, AdminGameDataController],
  providers: [AdminService, AdminCombatSimService, AdminGameDataService],
  exports: [AdminService],
})
export class AdminModule {}
