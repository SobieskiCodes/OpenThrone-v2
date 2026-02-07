import { Controller, Post, Body } from '@nestjs/common';
import { ArmoryService } from './armory.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';

@Controller('armory')
export class ArmoryController {
  constructor(private readonly armoryService: ArmoryService) {}

  @Post('equip')
  async equip(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for equip DTO
    return this.armoryService.equip(player.id, body);
  }

  @Post('unequip')
  async unequip(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for unequip DTO
    return this.armoryService.unequip(player.id, body);
  }
}
