import { Controller, Get, Post, Body, UsePipes } from '@nestjs/common';
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
  @UsePipes(new ZodValidationPipe(equipItemSchema))
  async equip(@CurrentPlayer() player: any, @Body() body: EquipItemDto) {
    return this.armoryService.equip(player.id, body);
  }

  @Post('unequip')
  @UsePipes(new ZodValidationPipe(unequipItemSchema))
  async unequip(@CurrentPlayer() player: any, @Body() body: UnequipItemDto) {
    return this.armoryService.unequip(player.id, body);
  }
}
