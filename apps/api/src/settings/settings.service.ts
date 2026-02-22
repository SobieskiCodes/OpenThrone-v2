import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface GameSetting {
  key: string;
  value: any;
  description?: string;
}

/**
 * Game Settings Service - Manages global game configuration
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get a setting by key
   */
  async getSetting<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
    const setting = await this.prisma.gameSettings.findUnique({
      where: { key },
    });

    if (!setting) return defaultValue;

    try {
      return JSON.parse(setting.value) as T;
    } catch {
      return setting.value as T;
    }
  }

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<GameSetting[]> {
    const settings = await this.prisma.gameSettings.findMany({
      orderBy: { key: 'asc' },
    });

    return settings.map((s: any) => ({
      key: s.key,
      value: this.parseValue(s.value),
      description: s.description || undefined,
    }));
  }

  /**
   * Update a setting
   */
  async updateSetting(
    key: string,
    value: any,
    description?: string,
    updatedBy?: string,
  ): Promise<void> {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

    await this.prisma.gameSettings.upsert({
      where: { key },
      update: {
        value: valueStr,
        description: description || undefined,
        updated_by_user_id: updatedBy || null,
      },
      create: {
        key,
        value: valueStr,
        description: description || null,
        updated_by_user_id: updatedBy || null,
      },
    });
  }

  /**
   * Initialize default settings if not exist
   */
  async initializeDefaults(): Promise<void> {
    const defaults: GameSetting[] = [
      {
        key: 'bot_chat_enabled',
        value: true,
        description: 'Enable bots to send messages in general chat',
      },
      {
        key: 'turns_per_tick',
        value: 1,
        description: 'Attack turns awarded per 30-minute tick',
      },
      {
        key: 'starting_gold',
        value: 25000,
        description: 'Gold awarded to new players',
      },
      {
        key: 'starting_gold_banked',
        value: false,
        description: 'Whether starting gold should be placed in bank instead of wallet',
      },
      {
        key: 'starting_citizens',
        value: 50,
        description: 'Citizens awarded to new players',
      },
    ];

    for (const def of defaults) {
      const existing = await this.prisma.gameSettings.findUnique({
        where: { key: def.key },
      });

      if (!existing) {
        await this.updateSetting(def.key, def.value, def.description);
      }
    }
  }

  private parseValue(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
