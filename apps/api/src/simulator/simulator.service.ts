import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SimulatorProfile,
  SimulatorConfig,
  DEFAULT_SIMULATOR_CONFIG,
  runSingleSimulation,
  runBatchSimulation,
  SingleSimResult,
  BatchSimResult,
} from '@openthrone/game-logic';
import { RunSimulationDto, SaveSimulationDto } from '@openthrone/shared';

@Injectable()
export class SimulatorService {
  constructor(private readonly prisma: PrismaService) {}

  async simulate(dto: RunSimulationDto): Promise<SingleSimResult | BatchSimResult> {
    const config: SimulatorConfig = { ...DEFAULT_SIMULATOR_CONFIG, ...(dto.config || {}) };

    const attackerProfile: SimulatorProfile = { ...dto.attacker };
    const defenderProfile: SimulatorProfile = { ...dto.defender };

    if (dto.runs === 1) {
      return runSingleSimulation(attackerProfile, defenderProfile, dto.turnsUsed, config);
    } else {
      return runBatchSimulation(attackerProfile, defenderProfile, dto.turnsUsed, config, dto.runs);
    }
  }

  async saveSimulation(playerId: string, dto: SaveSimulationDto) {
    const simulation = await this.prisma.savedSimulation.create({
      data: {
        player_id: playerId,
        title: dto.title,
        notes: dto.notes,
        input: JSON.stringify(dto.input),
        result: JSON.stringify(dto.result),
        runs: dto.runs,
      },
    });

    return { id: simulation.id, title: simulation.title };
  }

  async getSimulations(playerId: string, limit: number = 20) {
    const simulations = await this.prisma.savedSimulation.findMany({
      where: { player_id: playerId },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        notes: true,
        runs: true,
        created_at: true,
      },
    });

    return simulations;
  }

  async getSimulation(playerId: string, id: string) {
    const simulation = await this.prisma.savedSimulation.findFirst({
      where: { id, player_id: playerId },
    });

    if (!simulation) {
      throw new Error('Simulation not found');
    }

    return {
      ...simulation,
      input: JSON.parse(simulation.input),
      result: JSON.parse(simulation.result),
    };
  }

  async deleteSimulation(playerId: string, id: string) {
    await this.prisma.savedSimulation.deleteMany({
      where: { id, player_id: playerId },
    });

    return { success: true };
  }

  getDefaultConfig(): SimulatorConfig {
    return DEFAULT_SIMULATOR_CONFIG;
  }
}
