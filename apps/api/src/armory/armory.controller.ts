import { Controller, Get, Post, Body } from '@nestjs/common';
import { ArmoryService } from './armory.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  equipItemSchema,
  unequipItemSchema,
  EquipItemDto,
  UnequipItemDto,
} from '@openthrone/shared';

@Controller('armory')
export class ArmoryController {
  constructor(private readonly armoryService: ArmoryService) {}

  @Get('status')
  async getStatus(@CurrentPlayer() player: any) {
    return this.armoryService.getArmoryStatus(player.id);
  }

  @Post('equip')
  async equip(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(equipItemSchema)) body: EquipItemDto,
  ) {
    return this.armoryService.equip(player.id, body);
  }

  @Post('unequip')
  async unequip(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(unequipItemSchema)) body: UnequipItemDto,
  ) {
    return this.armoryService.unequip(player.id, body);
  }
}
