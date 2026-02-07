import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { AllianceService } from './alliance.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';

@Controller('alliances')
export class AllianceController {
  constructor(private readonly allianceService: AllianceService) {}

  @Get()
  async getAlliances() {
    // TODO: Return paginated list of alliances
    return this.allianceService.getAlliances();
  }

  @Post()
  async createAlliance(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for create alliance DTO
    return this.allianceService.createAlliance(player.id, body);
  }

  @Get(':id')
  async getAlliance(@Param('id') id: string) {
    // TODO: Return alliance details with members
    return this.allianceService.getAlliance(id);
  }

  @Post(':id/join')
  async joinAlliance(@CurrentPlayer() player: any, @Param('id') id: string) {
    // TODO: Implement join alliance logic
    return this.allianceService.joinAlliance(player.id, id);
  }
}
