import { Controller, Get, Post, Body, UsePipes } from '@nestjs/common';
import { StructuresService } from './structures.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  purchaseStructureUpgradeSchema,
  purchaseBattleUpgradeSchema,
  repairFortSchema,
  PurchaseStructureUpgradeDto,
  PurchaseBattleUpgradeDto,
  RepairFortDto,
} from '@openthrone/shared';

@Controller('structures')
export class StructuresController {
  constructor(private readonly structuresService: StructuresService) {}

  @Get('status')
  async getStatus(@CurrentPlayer() player: any) {
    return this.structuresService.getStructuresStatus(player.id);
  }

  @Post('upgrade')
  @UsePipes(new ZodValidationPipe(purchaseStructureUpgradeSchema))
  async upgrade(@CurrentPlayer() player: any, @Body() body: PurchaseStructureUpgradeDto) {
    return this.structuresService.upgrade(player.id, body);
  }

  @Post('battle-upgrade')
  @UsePipes(new ZodValidationPipe(purchaseBattleUpgradeSchema))
  async battleUpgrade(@CurrentPlayer() player: any, @Body() body: PurchaseBattleUpgradeDto) {
    return this.structuresService.purchaseBattleUpgrade(player.id, body);
  }

  @Post('repair')
  @UsePipes(new ZodValidationPipe(repairFortSchema))
  async repair(@CurrentPlayer() player: any, @Body() body: RepairFortDto) {
    return this.structuresService.repair(player.id, body);
  }
}
