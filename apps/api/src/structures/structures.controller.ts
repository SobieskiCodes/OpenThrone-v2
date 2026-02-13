import { Controller, Get, Post, Body } from '@nestjs/common';
import { StructuresService } from './structures.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  purchaseStructureUpgradeSchema,
  purchaseBattleUpgradeSchema,
  sellBattleUpgradeSchema,
  repairFortSchema,
  buyMercenarySchema,
  upgradeBuildingSchema,
  PurchaseStructureUpgradeDto,
  PurchaseBattleUpgradeDto,
  SellBattleUpgradeDto,
  RepairFortDto,
  BuyMercenaryDto,
  UpgradeBuildingDto,
} from '@openthrone/shared';

@Controller('structures')
export class StructuresController {
  constructor(private readonly structuresService: StructuresService) {}

  @Get('status')
  async getStatus(@CurrentPlayer() player: any) {
    return this.structuresService.getStructuresStatus(player.id);
  }

  @Get('buildings')
  async getBuildingsStatus(@CurrentPlayer() player: any) {
    return this.structuresService.getBuildingsStatus(player.id);
  }

  @Post('buildings/upgrade')
  async upgradeBuilding(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(upgradeBuildingSchema)) body: UpgradeBuildingDto,
  ) {
    return this.structuresService.upgradeBuilding(player.id, body);
  }

  @Post('upgrade')
  async upgrade(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(purchaseStructureUpgradeSchema)) body: PurchaseStructureUpgradeDto,
  ) {
    return this.structuresService.upgrade(player.id, body);
  }

  @Post('battle-upgrade')
  async battleUpgrade(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(purchaseBattleUpgradeSchema)) body: PurchaseBattleUpgradeDto,
  ) {
    return this.structuresService.purchaseBattleUpgrade(player.id, body);
  }

  @Post('sell-battle-upgrade')
  async sellBattleUpgrade(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(sellBattleUpgradeSchema)) body: SellBattleUpgradeDto,
  ) {
    return this.structuresService.sellBattleUpgrade(player.id, body);
  }

  @Post('repair')
  async repair(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(repairFortSchema)) body: RepairFortDto,
  ) {
    return this.structuresService.repair(player.id, body);
  }

  @Get('mercenary')
  async getMercenaryStatus(@CurrentPlayer() player: any) {
    return this.structuresService.getMercenaryStatus(player.id);
  }

  @Post('mercenary/buy')
  async buyMercenary(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(buyMercenarySchema)) body: BuyMercenaryDto,
  ) {
    return this.structuresService.buyMercenary(player.id, body);
  }
}
