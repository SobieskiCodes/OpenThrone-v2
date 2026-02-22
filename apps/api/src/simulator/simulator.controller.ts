import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { SimulatorService } from './simulator.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { runSimulationSchema, saveSimulationSchema } from '@openthrone/shared';

@Controller('simulator')
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  @Post('simulate')
  async simulate(
    @Body(new ZodValidationPipe(runSimulationSchema)) dto: any,
  ) {
    return this.simulatorService.simulate(dto);
  }

  @Post('save')
  async saveSimulation(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(saveSimulationSchema)) dto: any,
  ) {
    return this.simulatorService.saveSimulation(player.id, dto);
  }

  @Get('saved')
  async getSimulations(
    @CurrentPlayer() player: any,
    @Query('limit') limit?: string,
  ) {
    return this.simulatorService.getSimulations(player.id, limit ? parseInt(limit, 10) : 20);
  }

  @Get('saved/:id')
  async getSimulation(
    @CurrentPlayer() player: any,
    @Param('id') id: string,
  ) {
    return this.simulatorService.getSimulation(player.id, id);
  }

  @Delete('saved/:id')
  async deleteSimulation(
    @CurrentPlayer() player: any,
    @Param('id') id: string,
  ) {
    return this.simulatorService.deleteSimulation(player.id, id);
  }

  @Get('config/default')
  getDefaultConfig() {
    return this.simulatorService.getDefaultConfig();
  }
}
