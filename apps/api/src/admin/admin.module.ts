import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminCombatSimController } from './admin-combat-sim.controller';
import { AdminCombatSimService } from './admin-combat-sim.service';

@Module({
  controllers: [AdminController, AdminCombatSimController],
  providers: [AdminService, AdminCombatSimService],
  exports: [AdminService],
})
export class AdminModule {}
