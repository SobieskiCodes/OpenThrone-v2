import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  PermissionType,
  adminUpdatePlayerSchema,
  adminAccountActionSchema,
  adminGrantPermissionSchema,
  AdminUpdatePlayerDto,
  AdminAccountActionDto,
  AdminGrantPermissionDto,
} from '@openthrone/shared';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(PermissionType.ADMINISTRATOR)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Static routes first, before parameterized routes
  @Get('stats')
  async getServerStats() {
    return this.adminService.getServerStats();
  }

  @Post('permissions')
  @UsePipes(new ZodValidationPipe(adminGrantPermissionSchema))
  async grantPermission(@Body() dto: AdminGrantPermissionDto) {
    return this.adminService.grantPermission(dto);
  }

  @Delete('permissions/:playerId/:type')
  async revokePermission(
    @Param('playerId') playerId: string,
    @Param('type') type: string,
  ) {
    return this.adminService.revokePermission(playerId, type);
  }

  @Get('players')
  async getPlayers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    return this.adminService.getPlayers(
      Math.max(1, parseInt(page || '1', 10)),
      Math.min(50, Math.max(1, parseInt(limit || '20', 10))),
      search,
      status,
      sort,
      order,
    );
  }

  @Get('players/:id')
  async getPlayer(@Param('id') id: string) {
    return this.adminService.getPlayer(id);
  }

  @Patch('players/:id')
  async updatePlayer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminUpdatePlayerSchema)) dto: AdminUpdatePlayerDto,
    @CurrentPlayer('id') adminId: string,
  ) {
    return this.adminService.updatePlayer(id, dto, adminId);
  }

  @Post('players/:id/account-action')
  async accountAction(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminAccountActionSchema)) dto: AdminAccountActionDto,
    @CurrentPlayer('id') adminId: string,
  ) {
    return this.adminService.accountAction(id, dto, adminId);
  }
}
