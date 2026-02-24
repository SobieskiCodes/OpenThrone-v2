import { Controller, Get, Patch, Body, UseGuards, Post } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminGameDataService } from './admin-game-data.service';
import { PermissionType } from '@openthrone/shared';

@Controller('admin/game-data')
@UseGuards(RolesGuard)
@Roles(PermissionType.ADMINISTRATOR)
export class AdminGameDataController {
  constructor(private readonly adminGameDataService: AdminGameDataService) {}

  // ─── View All Definitions ────────────────────────────────────

  @Get('units')
  async getUnits() {
    return this.adminGameDataService.getAllUnits();
  }

  @Get('items')
  async getItems() {
    return this.adminGameDataService.getAllItems();
  }

  @Get('buildings')
  async getBuildings() {
    return this.adminGameDataService.getAllBuildings();
  }

  @Get('fortifications')
  async getFortifications() {
    return this.adminGameDataService.getAllFortifications();
  }

  @Get('battle-upgrades')
  async getBattleUpgrades() {
    return this.adminGameDataService.getAllBattleUpgrades();
  }

  @Get('economy-upgrades')
  async getEconomyUpgrades() {
    return this.adminGameDataService.getAllEconomyUpgrades();
  }

  @Get('races')
  async getRaces() {
    return this.adminGameDataService.getAllRaces();
  }

  @Get('config')
  async getConfig() {
    return this.adminGameDataService.getAllConfig();
  }

  // ─── Update Config ──────────────────────────────────────────

  @Patch('config/:key')
  async updateConfig(
    @Body() body: { value: string; description?: string },
  ) {
    return this.adminGameDataService.updateConfig(body);
  }

  // ─── Hot Reload ─────────────────────────────────────────────

  @Post('reload')
  async reloadGameData() {
    return this.adminGameDataService.reloadGameData();
  }
}
