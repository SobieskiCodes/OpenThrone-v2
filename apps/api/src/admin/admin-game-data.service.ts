import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameDataService } from '../game-data/game-data.service';

@Injectable()
export class AdminGameDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameData: GameDataService,
  ) {}

  // ─── View All Definitions ────────────────────────────────────

  async getAllUnits() {
    const units = await this.prisma.unit.findMany({
      orderBy: [{ type: 'asc' }, { level: 'asc' }],
    });
    return {
      total: units.length,
      data: units.map((u) => ({
        ...u,
        cost: u.cost.toString(),
      })),
    };
  }

  async getAllItems() {
    const items = await this.prisma.item.findMany({
      orderBy: [{ type: 'asc' }, { usage: 'asc' }, { level: 'asc' }],
    });
    return {
      total: items.length,
      data: items.map((i) => ({
        ...i,
        cost: i.cost.toString(),
      })),
    };
  }

  async getAllBuildings() {
    const buildings = await this.prisma.building.findMany({
      orderBy: [{ type: 'asc' }, { level: 'asc' }],
    });
    return {
      total: buildings.length,
      data: buildings.map((b) => ({
        ...b,
        cost: b.cost.toString(),
      })),
    };
  }

  async getAllFortifications() {
    const forts = await this.prisma.fortification.findMany({
      orderBy: { level: 'asc' },
    });
    return {
      total: forts.length,
      data: forts.map((f) => ({
        ...f,
        price: f.price.toString(),
        cost: f.cost.toString(),
        cost_per_repair_point: f.cost_per_repair_point.toString(),
      })),
    };
  }

  async getAllBattleUpgrades() {
    const upgrades = await this.prisma.battleUpgrade.findMany({
      orderBy: [{ type: 'asc' }, { level: 'asc' }],
    });
    return {
      total: upgrades.length,
      data: upgrades.map((u) => ({
        ...u,
        cost: u.cost.toString(),
      })),
    };
  }

  async getAllEconomyUpgrades() {
    const upgrades = await this.prisma.economyUpgrade.findMany({
      orderBy: { level: 'asc' },
    });
    return {
      total: upgrades.length,
      data: upgrades.map((u) => ({
        ...u,
        cost: u.cost.toString(),
      })),
    };
  }

  async getAllRaces() {
    const races = await this.prisma.race.findMany({
      orderBy: { id: 'asc' },
    });
    return {
      total: races.length,
      data: races,
    };
  }

  async getAllConfig() {
    const config = await this.prisma.gameConfig.findMany({
      orderBy: { key: 'asc' },
    });
    return {
      total: config.length,
      data: config,
    };
  }

  // ─── Update Config ──────────────────────────────────────────

  async updateConfig(data: { value: string; description?: string }) {
    // This would be called with the key in the route params
    // For now, just return a template response
    // TODO: Add proper validation and update logic
    return {
      success: true,
      message: 'Config update endpoint - implement with route param',
    };
  }

  // ─── Hot Reload ─────────────────────────────────────────────

  async reloadGameData() {
    const startTime = Date.now();
    await this.gameData.reload();
    const duration = Date.now() - startTime;

    return {
      success: true,
      message: `Game data reloaded in ${duration}ms`,
      timestamp: new Date().toISOString(),
    };
  }
}
