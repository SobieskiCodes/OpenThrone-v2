import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { SendMailDto } from '@openthrone/shared';
import { MailSentEvent, MailReadEvent } from '@openthrone/events';

@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getInbox(
    playerId: string,
    type?: string,
    unreadOnly?: boolean,
    page = 1,
    limit = 20,
  ) {
    const where: any = {
      player_id: playerId,
      is_deleted: false,
    };

    if (unreadOnly) {
      where.is_read = false;
    }

    const mailWhere: any = {};
    if (type) {
      mailWhere.mail_type = type;
    }

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.mailRecipient.findMany({
        where: {
          ...where,
          mail: mailWhere,
        },
        include: {
          mail: {
            include: {
              sender: {
                select: { id: true, display_name: true },
              },
            },
          },
        },
        orderBy: { mail: { created_at: 'desc' } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.mailRecipient.count({
        where: {
          ...where,
          mail: mailWhere,
        },
      }),
      this.prisma.mailRecipient.count({
        where: {
          player_id: playerId,
          is_deleted: false,
          is_read: false,
        },
      }),
    ]);

    return {
      items: items.map((r) => ({
        id: r.mail.id,
        subject: r.mail.subject,
        body: r.mail.body,
        mailType: r.mail.mail_type,
        sender: r.mail.sender
          ? { id: r.mail.sender.id, displayName: r.mail.sender.display_name }
          : null,
        isRead: r.is_read,
        readAt: r.read_at,
        createdAt: r.mail.created_at,
      })),
      total,
      page,
      unreadCount,
    };
  }

  async getMail(playerId: string, mailId: number) {
    const recipient = await this.prisma.mailRecipient.findUnique({
      where: {
        mail_id_player_id: { mail_id: mailId, player_id: playerId },
      },
      include: {
        mail: {
          include: {
            sender: {
              select: { id: true, display_name: true },
            },
          },
        },
      },
    });

    if (!recipient || recipient.is_deleted) {
      throw new NotFoundException('Mail not found');
    }

    return {
      id: recipient.mail.id,
      subject: recipient.mail.subject,
      body: recipient.mail.body,
      mailType: recipient.mail.mail_type,
      metadata: recipient.mail.metadata ? JSON.parse(recipient.mail.metadata) : null,
      sender: recipient.mail.sender
        ? { id: recipient.mail.sender.id, displayName: recipient.mail.sender.display_name }
        : null,
      isRead: recipient.is_read,
      readAt: recipient.read_at,
      createdAt: recipient.mail.created_at,
    };
  }

  async sendMail(senderId: string, dto: SendMailDto) {
    if (senderId === dto.recipientId) {
      throw new BadRequestException('Cannot send mail to yourself');
    }

    const recipient = await this.prisma.player.findUnique({
      where: { id: dto.recipientId },
    });
    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const mail = await tx.mail.create({
        data: {
          sender_id: senderId,
          subject: dto.subject,
          body: dto.body,
          mail_type: 'PLAYER',
        },
      });

      await tx.mailRecipient.create({
        data: {
          mail_id: mail.id,
          player_id: dto.recipientId,
        },
      });

      return mail;
    });

    this.eventEmitter.emit(
      'mail.sent',
      new MailSentEvent(result.id, senderId, [dto.recipientId], 'PLAYER'),
    );

    return { message: 'Mail sent' };
  }

  async sendSystemMail(
    recipientIds: string[],
    subject: string,
    body: string,
    metadata?: Record<string, unknown>,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const mail = await tx.mail.create({
        data: {
          sender_id: null,
          subject,
          body,
          mail_type: 'SYSTEM',
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      await tx.mailRecipient.createMany({
        data: recipientIds.map((pid) => ({
          mail_id: mail.id,
          player_id: pid,
        })),
      });

      return mail;
    });

    this.eventEmitter.emit(
      'mail.sent',
      new MailSentEvent(result.id, null, recipientIds, 'SYSTEM'),
    );

    return result;
  }

  async sendAllianceMail(
    senderId: string,
    allianceId: number,
    subject: string,
    body: string,
  ) {
    const members = await this.prisma.allianceMembership.findMany({
      where: { alliance_id: allianceId },
      select: { user_id: true },
    });

    const recipientIds = members.map((m) => m.user_id);

    const result = await this.prisma.$transaction(async (tx) => {
      const mail = await tx.mail.create({
        data: {
          sender_id: senderId,
          subject,
          body,
          mail_type: 'ALLIANCE',
        },
      });

      await tx.mailRecipient.createMany({
        data: recipientIds.map((pid) => ({
          mail_id: mail.id,
          player_id: pid,
        })),
      });

      return mail;
    });

    this.eventEmitter.emit(
      'mail.sent',
      new MailSentEvent(result.id, senderId, recipientIds, 'ALLIANCE'),
    );

    return result;
  }

  async markAsRead(playerId: string, mailId: number) {
    const recipient = await this.prisma.mailRecipient.findUnique({
      where: {
        mail_id_player_id: { mail_id: mailId, player_id: playerId },
      },
    });

    if (!recipient || recipient.is_deleted) {
      throw new NotFoundException('Mail not found');
    }

    await this.prisma.mailRecipient.update({
      where: { id: recipient.id },
      data: { is_read: true, read_at: new Date() },
    });

    this.eventEmitter.emit(
      'mail.read',
      new MailReadEvent(mailId, playerId),
    );

    return { message: 'Marked as read' };
  }

  async markAllAsRead(playerId: string) {
    const result = await this.prisma.mailRecipient.updateMany({
      where: {
        player_id: playerId,
        is_deleted: false,
        is_read: false,
      },
      data: { is_read: true, read_at: new Date() },
    });

    return { message: `Marked ${result.count} messages as read` };
  }

  async deleteMail(playerId: string, mailId: number) {
    const recipient = await this.prisma.mailRecipient.findUnique({
      where: {
        mail_id_player_id: { mail_id: mailId, player_id: playerId },
      },
    });

    if (!recipient) {
      throw new NotFoundException('Mail not found');
    }

    await this.prisma.mailRecipient.update({
      where: { id: recipient.id },
      data: { is_deleted: true },
    });

    return { message: 'Mail deleted' };
  }

  async getUnreadCount(playerId: string) {
    const count = await this.prisma.mailRecipient.count({
      where: {
        player_id: playerId,
        is_deleted: false,
        is_read: false,
      },
    });

    return { count };
  }
}
