import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AdminCombatSimService } from './admin-combat-sim.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  PermissionType,
  combatSimulateSchema,
  CombatSimulateDto,
} from '@openthrone/shared';

@Controller('admin/combat-sim')
@UseGuards(RolesGuard)
@Roles(PermissionType.ADMINISTRATOR)
export class AdminCombatSimController {
  constructor(private readonly combatSimService: AdminCombatSimService) {}

  @Get('default-config')
  getDefaultConfig() {
    return this.combatSimService.getDefaultConfig();
  }

  @Get('player/:id/profile')
  async getPlayerProfile(@Param('id') id: string) {
    return this.combatSimService.loadPlayerProfile(id);
  }

  @Post('simulate')
  async simulate(
    @Body(new ZodValidationPipe(combatSimulateSchema)) dto: CombatSimulateDto,
  ) {
    return this.combatSimService.simulate(dto as any);
  }
}
