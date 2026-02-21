import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildCombatProfile,
  calculateFullStats,
  DEFAULT_COMBAT_CONFIG,
  runSimulation,
  getFortificationByLevel,
} from '@openthrone/game-logic';
import type {
  CombatConfig,
  CombatProfile,
  FullPlayerData,
} from '@openthrone/game-logic';

@Injectable()
export class AdminCombatSimService {
  constructor(private readonly prisma: PrismaService) {}

  getDefaultConfig(): CombatConfig {
    return { ...DEFAULT_COMBAT_CONFIG };
  }

  async loadPlayerProfile(playerId: string): Promise<CombatProfile> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        stats: true,
        economy: true,
        fortification: true,
        units: true,
        items: true,
        battle_upgrades: true,
        bonus_points: true,
      },
    });

    if (!player) {
      throw new NotFoundException(`Player ${playerId} not found`);
    }

    const statsInput = {
      race: player.race,
      playerClass: player.player_class,
      fortLevel: player.fortification?.fort_level ?? 1,
      units: player.units.map((u) => ({
        unitType: u.unit_type,
        level: u.level,
        quantity: u.quantity,
      })),
      items: player.items.map((i) => ({
        itemType: i.item_type,
        usage: i.usage,
        level: i.level,
        quantity: i.quantity,
      })),
      battleUpgrades: player.battle_upgrades.map((b) => ({
        upgradeType: b.upgrade_type,
        level: b.level,
        quantity: b.quantity,
      })),
      bonusPoints: player.bonus_points.map((bp) => ({
        bonusType: bp.bonus_type,
        level: bp.level,
      })),
    };

    const fullStats = calculateFullStats(statsInput);

    const fortDef = getFortificationByLevel(player.fortification?.fort_level ?? 1);
    const fortMaxHP = fortDef?.hitpoints ?? 50;

    const fullData: FullPlayerData = {
      race: player.race,
      playerClass: player.player_class,
      fortLevel: player.fortification?.fort_level ?? 1,
      fortHitpoints: player.fortification?.hitpoints ?? fortMaxHP,
      gold: Number(player.economy?.gold ?? BigInt(0)),
      goldInBank: Number(player.economy?.gold_in_bank ?? BigInt(0)),
      experience: player.stats?.experience ?? 0,
      units: statsInput.units,
      items: statsInput.items,
      battleUpgrades: statsInput.battleUpgrades,
      bonusPoints: statsInput.bonusPoints,
      offense: fullStats.offense.total,
      defense: fullStats.defense.total,
      spy: fullStats.spy.total,
      sentry: fullStats.sentry.total,
    };

    return buildCombatProfile(fullData);
  }

  async simulate(request: {
    attacker: { playerId?: string } & Partial<CombatProfile>;
    defender: { playerId?: string } & Partial<CombatProfile>;
    config?: Record<string, number>;
    runs: number;
    type: string;
    options?: { spiesSent?: number; targetUnitType?: string };
  }) {
    // Load or build attacker profile
    let attackerProfile: CombatProfile;
    if ('playerId' in request.attacker && request.attacker.playerId) {
      attackerProfile = await this.loadPlayerProfile(request.attacker.playerId);
    } else {
      attackerProfile = this.buildSyntheticProfile(request.attacker as any);
    }

    // Load or build defender profile
    let defenderProfile: CombatProfile;
    if ('playerId' in request.defender && request.defender.playerId) {
      defenderProfile = await this.loadPlayerProfile(request.defender.playerId);
    } else {
      defenderProfile = this.buildSyntheticProfile(request.defender as any);
    }

    // Merge config with defaults
    const config: CombatConfig = { ...DEFAULT_COMBAT_CONFIG };
    if (request.config) {
      for (const [key, value] of Object.entries(request.config)) {
        if (key in config) {
          (config as any)[key] = value;
        }
      }
    }

    const summary = runSimulation(
      attackerProfile,
      defenderProfile,
      config,
      request.runs,
      request.type,
      request.options,
    );

    return {
      attacker: attackerProfile,
      defender: defenderProfile,
      config,
      summary,
    };
  }

  private buildSyntheticProfile(data: Partial<CombatProfile>): CombatProfile {
    return {
      offense: data.offense ?? 100,
      defense: data.defense ?? 100,
      spy: data.spy ?? 50,
      sentry: data.sentry ?? 50,
      gold: data.gold ?? 25000,
      goldInBank: data.goldInBank ?? 0,
      fortLevel: data.fortLevel ?? 1,
      fortHitpoints: data.fortHitpoints ?? 50,
      level: data.level ?? 1,
      population: data.population ?? 100,
      offenseUnits: data.offenseUnits ?? 50,
      defenseUnits: data.defenseUnits ?? 30,
      spyUnits: data.spyUnits ?? 10,
      sentryUnits: data.sentryUnits ?? 10,
      citizenUnits: data.citizenUnits ?? 0,
    };
  }
}
