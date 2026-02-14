import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FriendRequestSentEvent,
  FriendRequestAcceptedEvent,
  AllianceJoinedEvent,
  AllianceLeftEvent,
  PlayerRecruitedEvent,
  LeveledUpEvent,
  AttackExecutedEvent,
  SpyMissionExecutedEvent,
} from '@openthrone/events';
import { getBuildingUnlocksForLevelRange } from '@openthrone/game-logic';

@Injectable()
export class NotificationListener {
  constructor(
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('social.friendRequestSent')
  async handleFriendRequestSent(event: FriendRequestSentEvent) {
    if (event.relationshipType === 'ENEMY') return;

    const sender = await this.prisma.player.findUnique({
      where: { id: event.fromPlayerId },
      select: { display_name: true },
    });

    await this.mailService.sendSystemMail(
      [event.toPlayerId],
      'Friend request received',
      `${sender?.display_name ?? 'Someone'} sent you a friend request.`,
    );
  }

  @OnEvent('social.friendRequestAccepted')
  async handleFriendRequestAccepted(event: FriendRequestAcceptedEvent) {
    const accepter = await this.prisma.player.findUnique({
      where: { id: event.toPlayerId },
      select: { display_name: true },
    });

    await this.mailService.sendSystemMail(
      [event.fromPlayerId],
      'Friend request accepted',
      `${accepter?.display_name ?? 'Someone'} accepted your friend request.`,
    );
  }

  @OnEvent('alliance.joined')
  async handleAllianceJoined(event: AllianceJoinedEvent) {
    const alliance = await this.prisma.alliance.findUnique({
      where: { id: event.allianceId },
      select: { leader_id: true, name: true },
    });
    if (!alliance || alliance.leader_id === event.playerId) return;

    const joiner = await this.prisma.player.findUnique({
      where: { id: event.playerId },
      select: { display_name: true },
    });

    await this.mailService.sendSystemMail(
      [alliance.leader_id],
      'New alliance member',
      `${joiner?.display_name ?? 'Someone'} joined your alliance "${alliance.name}".`,
    );
  }

  @OnEvent('alliance.left')
  async handleAllianceLeft(event: AllianceLeftEvent) {
    const alliance = await this.prisma.alliance.findUnique({
      where: { id: event.allianceId },
      select: { leader_id: true, name: true },
    });
    if (!alliance || alliance.leader_id === event.playerId) return;

    const leaver = await this.prisma.player.findUnique({
      where: { id: event.playerId },
      select: { display_name: true },
    });

    await this.mailService.sendSystemMail(
      [alliance.leader_id],
      'Member left alliance',
      `${leaver?.display_name ?? 'Someone'} left your alliance "${alliance.name}".`,
    );
  }

  @OnEvent('recruitment.playerRecruited')
  async handlePlayerRecruited(event: PlayerRecruitedEvent) {
    await this.mailService.sendSystemMail(
      [event.referrerId],
      'Recruitment successful!',
      `You recruited a new citizen! You earned ${event.citizensAwarded} citizen(s).`,
    );
  }

  // ─── Level-up Notification ──────────────────────────────────────────

  @OnEvent('account.leveled_up')
  async handleLeveledUp(event: LeveledUpEvent) {
    const unlocks = this.getLevelUnlocks(event.oldLevel, event.newLevel);
    const unlockText = unlocks.length > 0
      ? `\n\nNewly unlocked:\n${unlocks.map((u) => `- ${u}`).join('\n')}`
      : '';

    await this.mailService.sendSystemMail(
      [event.playerId],
      `Level up! You reached level ${event.newLevel}`,
      `Congratulations! You advanced from level ${event.oldLevel} to level ${event.newLevel}.${unlockText}`,
      { type: 'level_up', oldLevel: event.oldLevel, newLevel: event.newLevel, unlocks },
    );
  }

  private getLevelUnlocks(oldLevel: number, newLevel: number): string[] {
    const unlocks: string[] = [];

    // Building upgrade unlocks
    const buildingUnlocks = getBuildingUnlocksForLevelRange(oldLevel, newLevel);
    for (const bu of buildingUnlocks) {
      const typeName = bu.buildingType.replace(/_/g, ' ').toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      unlocks.push(`${typeName} upgrade: ${bu.name} (Lv ${bu.level})`);
    }

    return unlocks;
  }

  // ─── Attack Notification ────────────────────────────────────────────

  @OnEvent('combat.attack')
  async handleAttack(event: AttackExecutedEvent) {
    const attacker = await this.prisma.player.findUnique({
      where: { id: event.attackerId },
      select: { display_name: true },
    });

    const attackerName = attacker?.display_name ?? 'Unknown';
    const attackerWon = event.winnerId === event.attackerId;

    await this.mailService.sendSystemMail(
      [event.defenderId],
      attackerWon ? `You were attacked by ${attackerName}!` : `You repelled an attack from ${attackerName}!`,
      attackerWon
        ? `${attackerName} attacked your kingdom and won. Check the battle report for details.`
        : `${attackerName} attacked your kingdom but your defenses held. Check the battle report for details.`,
      { type: 'attack_result', logId: event.logId, opponentId: event.attackerId },
    );
  }

  // ─── Spy Mission Notification ───────────────────────────────────────

  @OnEvent('combat.spy')
  async handleSpyMission(event: SpyMissionExecutedEvent) {
    const pastVerb = this.getMissionPastVerb(event.missionType);

    if (event.success) {
      // Covert success — anonymous notification
      await this.mailService.sendSystemMail(
        [event.defenderId],
        `Suspicious activity detected`,
        `Someone has ${pastVerb} your kingdom. Your sentries were unable to identify the intruder.`,
        { type: 'spy_result', logId: event.logId, missionType: event.missionType },
      );
    } else {
      // Failed — spies caught, reveal attacker identity
      const attacker = await this.prisma.player.findUnique({
        where: { id: event.attackerId },
        select: { display_name: true },
      });
      const attackerName = attacker?.display_name ?? 'Unknown';

      await this.mailService.sendSystemMail(
        [event.defenderId],
        `Enemy spies caught!`,
        `Your sentries caught enemy spies from ${attackerName} attempting to ${this.getMissionInfinitive(event.missionType)} your kingdom.`,
        { type: 'spy_result', logId: event.logId, missionType: event.missionType, opponentId: event.attackerId },
      );
    }
  }

  private getMissionPastVerb(missionType: string): string {
    const verbs: Record<string, string> = {
      intel: 'gathered intelligence on',
      assassinate: 'assassinated soldiers in',
      infiltrate: 'infiltrated',
      steal_gold: 'stolen gold from',
      sabotage: 'sabotaged the armory of',
    };
    return verbs[missionType] ?? 'targeted';
  }

  private getMissionInfinitive(missionType: string): string {
    const verbs: Record<string, string> = {
      intel: 'spy on',
      assassinate: 'assassinate soldiers in',
      infiltrate: 'infiltrate',
      steal_gold: 'steal gold from',
      sabotage: 'sabotage the armory of',
    };
    return verbs[missionType] ?? 'target';
  }
}
