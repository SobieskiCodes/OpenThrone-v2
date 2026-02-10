import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivityService } from './activity.service';
import { ActivityType } from '@openthrone/shared';
import {
  AttackExecutedEvent,
  SpyMissionExecutedEvent,
  LeveledUpEvent,
  AllianceCreatedEvent,
  AllianceJoinedEvent,
  AllianceLeftEvent,
  StructureUpgradedEvent,
} from '@openthrone/events';

@Injectable()
export class ActivityListener {
  constructor(private readonly activityService: ActivityService) {}

  @OnEvent('combat.attack')
  async handleAttack(event: AttackExecutedEvent) {
    const attackerWon = event.winnerId === event.attackerId;

    // Log for attacker
    await this.activityService.log(
      event.attackerId,
      attackerWon ? ActivityType.ATTACK_WIN : ActivityType.ATTACK_LOSS,
      {
        targetId: event.defenderId,
        referenceId: event.logId,
      },
    );

    // Log for defender
    await this.activityService.log(
      event.defenderId,
      attackerWon ? ActivityType.DEFEND_LOSS : ActivityType.DEFEND_WIN,
      {
        targetId: event.attackerId,
        referenceId: event.logId,
      },
    );
  }

  @OnEvent('combat.spy')
  async handleSpy(event: SpyMissionExecutedEvent) {
    // Log for attacker
    await this.activityService.log(
      event.attackerId,
      event.success ? ActivityType.SPY_SUCCESS : ActivityType.SPY_FAILED,
      {
        targetId: event.defenderId,
        metadata: { missionType: event.missionType },
      },
    );

    // Log detection for defender on failure
    if (!event.success) {
      await this.activityService.log(
        event.defenderId,
        ActivityType.SPY_DETECTED,
        {
          targetId: event.attackerId,
          metadata: { missionType: event.missionType },
        },
      );
    }
  }

  @OnEvent('account.leveled_up')
  async handleLevelUp(event: LeveledUpEvent) {
    await this.activityService.log(
      event.playerId,
      ActivityType.LEVEL_UP,
      {
        metadata: { oldLevel: event.oldLevel, newLevel: event.newLevel },
      },
    );
  }

  @OnEvent('alliance.created')
  async handleAllianceCreated(event: AllianceCreatedEvent) {
    await this.activityService.log(
      event.leaderId,
      ActivityType.ALLIANCE_CREATED,
      {
        metadata: { allianceName: event.name },
      },
    );
  }

  @OnEvent('alliance.joined')
  async handleAllianceJoined(event: AllianceJoinedEvent) {
    await this.activityService.log(
      event.playerId,
      ActivityType.ALLIANCE_JOINED,
    );
  }

  @OnEvent('alliance.left')
  async handleAllianceLeft(event: AllianceLeftEvent) {
    await this.activityService.log(
      event.playerId,
      ActivityType.ALLIANCE_LEFT,
    );
  }

  @OnEvent('structure.upgraded')
  async handleStructureUpgraded(event: StructureUpgradedEvent) {
    await this.activityService.log(
      event.playerId,
      ActivityType.STRUCTURE_UPGRADED,
      {
        metadata: { upgradeType: event.upgradeType, newLevel: event.newLevel },
      },
    );
  }
}
