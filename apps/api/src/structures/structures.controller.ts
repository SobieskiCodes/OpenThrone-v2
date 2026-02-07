import { Controller, Post, Body } from '@nestjs/common';
import { StructuresService } from './structures.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';

@Controller('structures')
export class StructuresController {
  constructor(private readonly structuresService: StructuresService) {}

  @Post('upgrade')
  async upgrade(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for upgrade DTO
    return this.structuresService.upgrade(player.id, body);
  }

  @Post('repair')
  async repair(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for repair DTO
    return this.structuresService.repair(player.id, body);
  }
}
