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
} from '@openthrone/events';

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
}
