import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrainingService } from '../training/training.service';
import { BankService } from '../economy/bank.service';
import { ArmoryService } from '../armory/armory.service';
import { StructuresService } from '../structures/structures.service';
import { BattleService } from '../battle/battle.service';
import { scoreTarget } from '@openthrone/game-logic';
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
  ) {}

  async executeAction(
    action: PrioritizedAction,
    playerId: string,
    state: BotGameState,
    strategy: string,
  ): Promise<ActionResult> {
    try {
      switch (action.type) {
        case 'AUTO_RECRUIT':
          return await this.execAutoRecruit(playerId);
        case 'BANK_DEPOSIT':
          return await this.execBankDeposit(playerId, action.params!);
        case 'TRAIN_UNITS':
          return await this.execTrainUnits(playerId, action.params!);
        case 'EQUIP_ITEMS':
          return await this.execEquipItems(playerId, action.params!);
        case 'UPGRADE_STRUCTURE':
          return await this.execUpgradeStructure(playerId, action.params!);
        case 'REPAIR_FORT':
          return await this.execRepairFort(playerId, action.params!);
        case 'ATTACK_PLAYER':
          return await this.execAttackPlayer(playerId, state, strategy, action.params!);
        case 'SPY_MISSION':
          return await this.execSpyMission(playerId, state, strategy, action.params!);
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
    const result = await this.bankService.deposit(playerId, String(amount));
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
  ): Promise<ActionResult> {
    const target = await this.findAttackTarget(playerId, state, strategy);
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
            ? Math.floor(Math.log2(c.stats.experience + 1))
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
        const score = scoreTarget(
          strategy as any,
          { offense: state.offense, level: state.level },
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
}
