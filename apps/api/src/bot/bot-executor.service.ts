import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrainingService } from '../training/training.service';
import { BankService } from '../economy/bank.service';
import { ArmoryService } from '../armory/armory.service';
import { StructuresService } from '../structures/structures.service';
import { BattleService } from '../battle/battle.service';
import { ShopService } from '../shop/shop.service';
import { PlayerService } from '../player/player.service';
import { scoreTarget, calculateTargetScore } from '@openthrone/game-logic';
import type { PrioritizedAction, BotGameState } from '@openthrone/game-logic';

interface ActionResult {
  success: boolean;
  resultData?: any;
  errorMessage?: string;
}

@Injectable()
export class BotExecutorService {
  private readonly logger = new Logger(BotExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trainingService: TrainingService,
    private readonly bankService: BankService,
    private readonly armoryService: ArmoryService,
    private readonly structuresService: StructuresService,
    private readonly battleService: BattleService,
    private readonly shopService: ShopService,
    private readonly playerService: PlayerService,
  ) {}

  async executeAction(
    action: PrioritizedAction,
    playerId: string,
    state: BotGameState,
    strategy: string,
    skipRateLimits: boolean = false,
  ): Promise<ActionResult> {
    try {
      switch (action.type) {
        case 'AUTO_RECRUIT':
          return await this.execAutoRecruit(playerId);
        case 'ALLOCATE_BONUS_POINTS':
          return await this.execAllocateBonusPoints(playerId, action.params!);
        case 'BANK_DEPOSIT':
          return await this.execBankDeposit(playerId, action.params!, skipRateLimits);
        case 'TRAIN_UNITS':
          return await this.execTrainUnits(playerId, action.params!);
        case 'EQUIP_ITEMS':
          return await this.execEquipItems(playerId, action.params!);
        case 'UPGRADE_BUILDING':
          return await this.execUpgradeBuilding(playerId, action.params!);
        case 'UPGRADE_STRUCTURE':
          return await this.execUpgradeStructure(playerId, action.params!);
        case 'REPAIR_FORT':
          return await this.execRepairFort(playerId, action.params!);
        case 'ATTACK_PLAYER':
          return await this.execAttackPlayer(playerId, state, strategy, action.params!, skipRateLimits);
        case 'SPY_MISSION':
          return await this.execSpyMission(playerId, state, strategy, action.params!, skipRateLimits);
        case 'PURCHASE_COSMETIC':
          return await this.execPurchaseCosmetic(playerId, action.params!);
        case 'HIRE_MERCENARIES':
          return await this.execHireMercenaries(playerId, action.params!);
        default:
          return { success: false, errorMessage: `Unknown action type: ${action.type}` };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Bot ${playerId} action ${action.type} failed: ${msg}`);
      return { success: false, errorMessage: msg };
    }
  }

  private async execAutoRecruit(playerId: string): Promise<ActionResult> {
    // Update last_auto_recruit to simulate claiming daily recruit
    await this.prisma.playerEconomy.update({
      where: { player_id: playerId },
      data: { last_auto_recruit: new Date() },
    });

    // Add citizens
    const existing = await this.prisma.playerUnit.findUnique({
      where: {
        player_id_unit_type_level: {
          player_id: playerId,
          unit_type: 'CITIZEN',
          level: 1,
        },
      },
    });

    if (existing) {
      await this.prisma.playerUnit.update({
        where: { id: existing.id },
        data: { quantity: { increment: 250 } },
      });
    } else {
      await this.prisma.playerUnit.create({
        data: {
          player_id: playerId,
          unit_type: 'CITIZEN',
          level: 1,
          quantity: 250,
        },
      });
    }

    return { success: true, resultData: { citizensGained: 250 } };
  }

  private async execBankDeposit(
    playerId: string,
    params: Record<string, any>,
    skipRateLimits: boolean = false,
  ): Promise<ActionResult> {
    // Re-check current gold to avoid depositing more than 80% after prior actions spent gold
    const economy = await this.prisma.playerEconomy.findUnique({
      where: { player_id: playerId },
      select: { gold: true },
    });
    const currentGold = Number(economy?.gold ?? 0);
    const maxDeposit = Math.floor(currentGold * 0.75); // Stay safely under 80% cap
    const amount = Math.min(Number(params.amount), maxDeposit);
    if (amount <= 0) {
      return { success: false, errorMessage: 'Not enough gold to deposit after prior actions' };
    }
    const result = await this.bankService.deposit(playerId, String(amount), skipRateLimits);
    return { success: true, resultData: result };
  }

  private async execTrainUnits(
    playerId: string,
    params: Record<string, any>,
  ): Promise<ActionResult> {
    const result = await this.trainingService.train(playerId, {
      units: params.units,
    });
    return { success: true, resultData: result };
  }

  private async execEquipItems(
    playerId: string,
    params: Record<string, any>,
  ): Promise<ActionResult> {
    const result = await this.armoryService.equip(playerId, {
      itemType: params.itemType,
      usage: params.usage,
      level: params.level,
      quantity: params.quantity,
    });
    return { success: true, resultData: result };
  }

  private async execUpgradeBuilding(
    playerId: string,
    params: Record<string, any>,
  ): Promise<ActionResult> {
    const result = await this.structuresService.upgradeBuilding(playerId, {
      buildingType: params.buildingType,
    });
    return {
      success: true,
      resultData: {
        buildingType: result.buildingType,
        newLevel: result.newLevel,
        name: result.name,
      },
    };
  }

  private async execUpgradeStructure(
    playerId: string,
    params: Record<string, any>,
  ): Promise<ActionResult> {
    const result = await this.structuresService.upgrade(
      playerId,
      { upgradeType: params.upgradeType },
    );
    return { success: true, resultData: result };
  }

  private async execRepairFort(
    playerId: string,
    params: Record<string, any>,
  ): Promise<ActionResult> {
    const result = await this.structuresService.repair(playerId, {
      points: params.points,
    });
    return { success: true, resultData: result };
  }

  private async execAttackPlayer(
    playerId: string,
    state: BotGameState,
    strategy: string,
    params: Record<string, any>,
    skipRateLimits: boolean = false,
  ): Promise<ActionResult> {
    // Find a target: get active non-bot players near our level
    const target = await this.findAttackTarget(playerId, state, strategy);
    if (!target) {
      return { success: false, errorMessage: 'No suitable attack target found' };
    }

    const result = await this.battleService.executeAttack(
      playerId,
      target.id,
      params.turns ?? 1,
      skipRateLimits,
    );
    return {
      success: true,
      resultData: { ...result, targetName: target.displayName },
    };
  }

  private async execSpyMission(
    playerId: string,
    state: BotGameState,
    strategy: string,
    params: Record<string, any>,
    skipRateLimits: boolean = false,
  ): Promise<ActionResult> {
    // Phase 1: Use spy-specific target selection (prioritize gathering intel)
    const target = await this.findSpyTarget(playerId, state, strategy);
    if (!target) {
      return { success: false, errorMessage: 'No suitable spy target found' };
    }

    const result = await this.battleService.executeSpyMission(
      playerId,
      target.id,
      {
        type: params.type ?? 'INTEL',
        spiesSent: params.spiesSent ?? 1,
      },
      skipRateLimits,
    );
    return {
      success: true,
      resultData: { ...result, targetName: target.displayName },
    };
  }

  private async findAttackTarget(
    playerId: string,
    state: BotGameState,
    strategy: string,
  ): Promise<{ id: string; displayName: string } | null> {
    // Find active players near this bot's level, excluding self and other bots
    const candidates = await this.prisma.player.findMany({
      where: {
        status: 'ACTIVE',
        id: { not: playerId },
        is_bot: false,
      },
      include: {
        stats: true,
        fortification: true,
        units: true,
      },
      take: 50,
    });

    if (candidates.length === 0) {
      // Fall back to including bots as targets
      const botCandidates = await this.prisma.player.findMany({
        where: {
          status: 'ACTIVE',
          id: { not: playerId },
        },
        include: {
          stats: true,
          fortification: true,
          units: true,
        },
        take: 50,
      });
      if (botCandidates.length === 0) return null;
      return this.pickBestTarget(botCandidates, state, strategy);
    }

    return this.pickBestTarget(candidates, state, strategy);
  }

  private pickBestTarget(
    candidates: any[],
    state: BotGameState,
    strategy: string,
  ): { id: string; displayName: string } | null {
    const scored = candidates
      .map((c) => {
        const target = {
          id: c.id,
          displayName: c.display_name,
          level: c.stats?.experience
            ? Math.floor(Math.log2(Number(c.stats.experience) + 1))
            : 1,
          rank: c.stats?.rank ?? 0,
          offense: c.stats?.offense ?? 0,
          defense: c.stats?.defense ?? 0,
          fortLevel: c.fortification?.fort_level ?? 1,
          population: c.units.reduce(
            (sum: number, u: any) => sum + u.quantity,
            0,
          ),
        };
        // Phase 1: Use intelligence-based scoring
        const score = calculateTargetScore(
          strategy as any,
          state,
          target,
        );
        return { ...target, score };
      })
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return null;

    // Pick from top 5 with some randomness
    const topN = scored.slice(0, Math.min(5, scored.length));
    const pick = topN[Math.floor(Math.random() * topN.length)]!;
    return { id: pick.id, displayName: pick.displayName };
  }

  /**
   * Phase 1: Find spy target prioritizing intelligence gathering.
   * Preference order:
   * 1. Revenge targets we haven't spied yet
   * 2. Targets with no intel
   * 3. Targets with stale intel (>7 days old)
   */
  private async findSpyTarget(
    playerId: string,
    state: BotGameState,
    strategy: string,
  ): Promise<{ id: string; displayName: string } | null> {
    const candidates = await this.prisma.player.findMany({
      where: {
        status: 'ACTIVE',
        id: { not: playerId },
        is_bot: false,
      },
      include: {
        stats: true,
        fortification: true,
        units: true,
      },
      take: 50,
    });

    if (candidates.length === 0) return null;

    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    // Categorize targets
    const revengeTargetsNoIntel: any[] = [];
    const targetsNoIntel: any[] = [];
    const targetsStaleIntel: any[] = [];
    const targetsRecentIntel: any[] = [];

    for (const c of candidates) {
      const isRevengeTarget = state.recentAttackers.some(
        (a) => a.attackerId === c.id,
      );
      const intel = state.intelReports.find((r) => r.targetId === c.id);

      if (!intel) {
        // No intel on this target
        if (isRevengeTarget) {
          revengeTargetsNoIntel.push(c);
        } else {
          targetsNoIntel.push(c);
        }
      } else {
        // Has intel - check if stale
        const intelAge = now - intel.spiedAt.getTime();
        if (intelAge > SEVEN_DAYS_MS) {
          targetsStaleIntel.push(c);
        } else {
          targetsRecentIntel.push(c);
        }
      }
    }

    // Priority 1: Revenge targets without intel
    if (revengeTargetsNoIntel.length > 0) {
      const pick =
        revengeTargetsNoIntel[
          Math.floor(Math.random() * revengeTargetsNoIntel.length)
        ]!;
      return { id: pick.id, displayName: pick.display_name };
    }

    // Priority 2: Targets without intel
    if (targetsNoIntel.length > 0) {
      const pick =
        targetsNoIntel[Math.floor(Math.random() * targetsNoIntel.length)]!;
      return { id: pick.id, displayName: pick.display_name };
    }

    // Priority 3: Targets with stale intel
    if (targetsStaleIntel.length > 0) {
      const pick =
        targetsStaleIntel[Math.floor(Math.random() * targetsStaleIntel.length)]!;
      return { id: pick.id, displayName: pick.display_name };
    }

    // Fallback: Pick from targets with recent intel (better than nothing)
    if (targetsRecentIntel.length > 0) {
      const pick =
        targetsRecentIntel[
          Math.floor(Math.random() * targetsRecentIntel.length)
        ]!;
      return { id: pick.id, displayName: pick.display_name };
    }

    return null;
  }

  private async execPurchaseCosmetic(playerId: string, params: any): Promise<ActionResult> {
    try {
      // Get available cosmetics from shop
      const shop = await this.shopService.getCosmeticsShop();

      // Filter by type if specified, otherwise pick random type
      let availableCosmetics = shop.cosmetics;
      if (params.cosmeticType) {
        availableCosmetics = shop.cosmetics.filter((c: any) => c.type === params.cosmeticType);
      }

      if (availableCosmetics.length === 0) {
        return { success: false, errorMessage: 'No cosmetics available' };
      }

      // Pick a random cosmetic from available ones
      const cosmetic = availableCosmetics[Math.floor(Math.random() * availableCosmetics.length)]!;

      // Purchase it
      const result = await this.shopService.purchaseCosmetic(playerId, {
        cosmeticId: cosmetic.id,
      });

      // Optionally equip it immediately (50% chance)
      if (Math.random() > 0.5) {
        await this.shopService.equipCosmetic(playerId, {
          cosmeticId: cosmetic.id,
          equipped: true,
        });
      }

      return {
        success: true,
        resultData: {
          cosmeticId: cosmetic.id,
          name: cosmetic.name,
          type: cosmetic.type,
          price: cosmetic.price,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, errorMessage: msg };
    }
  }

  private async execHireMercenaries(playerId: string, params: any): Promise<ActionResult> {
    try {
      const quantity = params.quantity || 1;

      // Get mercenary status to see what's available
      const status = await this.structuresService.getMercenaryStatus(playerId);

      if (!status.campLevel || status.campLevel === 0) {
        return { success: false, errorMessage: 'No mercenary camp built' };
      }

      // Get available mercenaries from stock
      const availableStock = status.stock || [];
      if (availableStock.length === 0) {
        return { success: false, errorMessage: 'No mercenaries in stock' };
      }

      // Pick a random mercenary type from available stock
      const merc = availableStock[Math.floor(Math.random() * availableStock.length)]!;

      // Buy the mercenaries (buy up to quantity, limited by available stock)
      const toBuy = Math.min(quantity, merc.available);

      await this.structuresService.buyMercenary(playerId, {
        units: [
          {
            unitType: merc.unitType,
            quantity: toBuy,
          },
        ],
      });

      return {
        success: true,
        resultData: {
          hired: toBuy,
          unitType: merc.unitType,
          totalCost: toBuy * merc.cost,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, errorMessage: msg };
    }
  }

  private async execAllocateBonusPoints(playerId: string, params: any): Promise<ActionResult> {
    try {
      await this.playerService.allocateBonusPoints(playerId, {
        bonusType: params.bonusType,
      });

      return {
        success: true,
        resultData: {
          bonusType: params.bonusType,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, errorMessage: msg };
    }
  }
}
