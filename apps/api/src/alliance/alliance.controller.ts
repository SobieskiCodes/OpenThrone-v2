import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { AllianceService } from './alliance.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createAllianceSchema,
  updateAllianceSchema,
  allianceDepositSchema,
  CreateAllianceDto,
  UpdateAllianceDto,
  AllianceDepositDto,
} from '@openthrone/shared';

@Controller('alliances')
export class AllianceController {
  constructor(private readonly allianceService: AllianceService) {}

  @Get()
  async getAlliances() {
    return this.allianceService.getAlliances();
  }

  // Static routes MUST come before :id param routes
  @Get('mine')
  async getMyAlliances(@CurrentPlayer() player: any) {
    return this.allianceService.getMyAlliances(player.id);
  }

  @Post()
  async createAlliance(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(createAllianceSchema)) body: CreateAllianceDto,
  ) {
    return this.allianceService.createAlliance(player.id, body);
  }

  @Post(':id/leave')
  async leaveAlliance(
    @CurrentPlayer() player: any,
    @Param('id') id: string,
  ) {
    return this.allianceService.leaveAlliance(player.id, id);
  }

  // Parameterized routes below
  @Get(':id')
  async getAlliance(@Param('id') id: string) {
    return this.allianceService.getAlliance(id);
  }

  @Patch(':id')
  async updateAlliance(
    @CurrentPlayer() player: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAllianceSchema)) body: UpdateAllianceDto,
  ) {
    return this.allianceService.updateAlliance(player.id, id, body);
  }

  @Post(':id/join')
  async joinAlliance(
    @CurrentPlayer() player: any,
    @Param('id') id: string,
  ) {
    return this.allianceService.joinAlliance(player.id, id);
  }

  @Post(':id/deposit')
  async depositToTreasury(
    @CurrentPlayer() player: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(allianceDepositSchema)) body: AllianceDepositDto,
  ) {
    return this.allianceService.depositToTreasury(player.id, id, body);
  }

  @Delete(':id/members/:userId')
  async kickMember(
    @CurrentPlayer() player: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.allianceService.kickMember(player.id, id, userId);
  }
}
