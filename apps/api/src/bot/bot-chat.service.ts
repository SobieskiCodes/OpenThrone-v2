import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { SettingsService } from '../settings/settings.service';

/**
 * Bot Chat Service - Makes bots participate in general chat
 * Bots will boast after wins, taunt before attacks, and threaten revenge
 */
@Injectable()
export class BotChatService {
  private readonly logger = new Logger(BotChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Bot boasts after winning an attack (30% chance)
   */
  async sendBoastMessage(botId: string, targetName: string, goldStolen: number) {
    const config = await this.getBotConfig(botId);
    if (!config) return;

    // 30% chance to boast
    if (Math.random() > 0.3) return;

    const messages = [
      `Another victory! ${targetName} falls before me.`,
      `${goldStolen.toLocaleString()} gold richer. Too easy.`,
      `${targetName}, you should have trained more defense.`,
      `My armies grow stronger with each conquest.`,
      `Who's next? Step up if you dare.`,
      `${targetName} thought they could stop me. Wrong.`,
      `Conquest complete. ${targetName} wasn't ready.`,
      `Easy pickings. Thanks for the gold, ${targetName}.`,
      `Another one bites the dust. GG ${targetName}.`,
      `${targetName}'s defenses crumbled like paper.`,
    ];

    const message = messages[Math.floor(Math.random() * messages.length)]!;
    await this.sendToGeneralChat(botId, message);
  }

  /**
   * Bot taunts before attacking (20% chance)
   */
  async sendTauntMessage(botId: string) {
    const config = await this.getBotConfig(botId);
    if (!config) return;

    // 20% chance to taunt
    if (Math.random() > 0.2) return;

    const messages = [
      `Time to expand my kingdom...`,
      `Looking for a worthy opponent.`,
      `My armies hunger for battle.`,
      `Let's see who's been slacking on defense.`,
      `Someone's about to have a bad day.`,
      `The strong survive. Let's see who's weak.`,
      `Sharpening my swords. Who wants to be first?`,
      `Gold won't steal itself. Time to raid.`,
      `Feeling aggressive today.`,
      `My troops grow restless. Time for war.`,
    ];

    const message = messages[Math.floor(Math.random() * messages.length)]!;
    await this.sendToGeneralChat(botId, message);
  }

  /**
   * Bot threatens revenge when attacked (40% chance)
   */
  async sendRevengeMessage(botId: string, attackerName: string) {
    const config = await this.getBotConfig(botId);
    if (!config) return;

    // 40% chance to threaten
    if (Math.random() > 0.4) return;

    const messages = [
      `${attackerName}, you will regret that attack.`,
      `Noted, ${attackerName}. Revenge is coming.`,
      `My turn next, ${attackerName}.`,
      `Enjoy your gold while it lasts, ${attackerName}.`,
      `${attackerName}, you just made an enemy.`,
      `Bold move, ${attackerName}. I won't forget this.`,
      `${attackerName}, you're on my list now.`,
      `Interesting choice, ${attackerName}. We'll see how that works out.`,
      `${attackerName} wants war? War it is.`,
      `${attackerName}, I'll be paying you a visit soon.`,
    ];

    const message = messages[Math.floor(Math.random() * messages.length)]!;
    await this.sendToGeneralChat(botId, message);
  }

  /**
   * Event listener: Bot sends revenge message when attacked
   */
  @OnEvent('battle.completed')
  async handleBattleCompleted(event: any) {
    try {
      // Check if defender is a bot and lost
      const defenderConfig = await this.prisma.botConfig.findUnique({
        where: { player_id: event.defenderId },
      });

      if (defenderConfig && event.winner === event.attackerId) {
        // Bot lost defense - threaten revenge
        const attacker = await this.prisma.player.findUnique({
          where: { id: event.attackerId },
          select: { display_name: true },
        });

        if (attacker) {
          await this.sendRevengeMessage(event.defenderId, attacker.display_name);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to send bot revenge message: ${err}`);
    }
  }

  /**
   * Send message to general chat room
   */
  private async sendToGeneralChat(botId: string, content: string) {
    try {
      // Check if bot chat is enabled
      const chatEnabled = await this.settingsService.getSetting<boolean>('bot_chat_enabled', true);
      if (!chatEnabled) {
        this.logger.debug('Bot chat disabled via settings');
        return;
      }

      const generalRoom = await this.chatService.ensureGeneralRoom();
      await this.chatService.sendMessage(botId, generalRoom.id, content);
      this.logger.debug(`Bot ${botId} sent chat: ${content}`);
    } catch (err) {
      this.logger.warn(`Bot chat failed: ${err}`);
    }
  }

  /**
   * Get bot config (verify player is actually a bot)
   */
  private async getBotConfig(playerId: string) {
    return this.prisma.botConfig.findUnique({
      where: { player_id: playerId },
    });
  }
}
