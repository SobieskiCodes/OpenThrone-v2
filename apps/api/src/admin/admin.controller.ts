import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionType } from '@openthrone/shared';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(PermissionType.ADMINISTRATOR)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('players')
  async getPlayers() {
    // TODO: Return paginated list of all players for admin management
    return this.adminService.getPlayers();
  }

  @Get('players/:id')
  async getPlayer(@Param('id') id: string) {
    // TODO: Return detailed player info for admin view
    return this.adminService.getPlayer(id);
  }

  @Patch('players/:id')
  async updatePlayer(@Param('id') id: string, @Body() body: any) {
    // TODO: Add Zod validation pipe for admin player update DTO
    return this.adminService.updatePlayer(id, body);
  }

  @Post('players/:id/ban')
  async banPlayer(@Param('id') id: string, @Body() body: any) {
    // TODO: Implement player ban logic
    return this.adminService.banPlayer(id, body);
  }

  @Get('stats')
  async getServerStats() {
    // TODO: Return server-wide statistics
    return this.adminService.getServerStats();
  }
}
