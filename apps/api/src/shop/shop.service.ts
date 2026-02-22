import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_COSMETICS, getCosmeticById } from '@openthrone/game-logic';
import { PurchaseCosmeticDto, EquipCosmeticDto, CosmeticType } from '@openthrone/shared';
import { PlayerStateChangedEvent } from '../game/events/player-state-changed.event';

@Injectable()
export class ShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get all available cosmetics from the shop
   */
  async getCosmeticsShop() {
    const cosmetics = await this.prisma.cosmetic.findMany({
      orderBy: [
        { type: 'asc' },
        { price: 'asc' },
      ],
    });

    return {
      cosmetics: cosmetics.map((c) => ({
        id: c.id,
        type: c.type,
        name: c.name,
        value: c.value,
        price: c.price.toString(),
        description: c.description,
      })),
    };
  }

  /**
   * Get player's owned cosmetics and what's currently equipped
   */
  async getPlayerCosmetics(playerId: string) {
    const owned = await this.prisma.playerCosmetic.findMany({
      where: { player_id: playerId },
      include: { cosmetic: true },
      orderBy: { purchased_at: 'desc' },
    });

    return {
      cosmetics: owned.map((pc) => ({
        id: pc.cosmetic.id,
        type: pc.cosmetic.type,
        name: pc.cosmetic.name,
        value: pc.cosmetic.value,
        price: pc.cosmetic.price.toString(),
        description: pc.cosmetic.description,
        equipped: pc.equipped,
        purchasedAt: pc.purchased_at,
      })),
    };
  }

  /**
   * Purchase a cosmetic with gold
   */
  async purchaseCosmetic(playerId: string, dto: PurchaseCosmeticDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Check if player already owns it
      const existing = await tx.playerCosmetic.findUnique({
        where: {
          player_id_cosmetic_id: {
            player_id: playerId,
            cosmetic_id: dto.cosmeticId,
          },
        },
      });

      if (existing) {
        throw new BadRequestException('You already own this cosmetic');
      }

      // Get cosmetic definition
      const cosmetic = await tx.cosmetic.findUnique({
        where: { id: dto.cosmeticId },
      });

      if (!cosmetic) {
        throw new NotFoundException('Cosmetic not found');
      }

      // Check if player has enough gold
      const economy = await tx.playerEconomy.findUnique({
        where: { player_id: playerId },
      });

      if (!economy || economy.gold < cosmetic.price) {
        throw new BadRequestException('Not enough gold');
      }

      // Deduct gold
      const newGold = economy.gold - cosmetic.price;
      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { gold: newGold },
      });

      // Add to player's cosmetics
      await tx.playerCosmetic.create({
        data: {
          player_id: playerId,
          cosmetic_id: cosmetic.id,
          equipped: false,
        },
      });

      return {
        gold: newGold,
        cosmetic: {
          id: cosmetic.id,
          type: cosmetic.type,
          name: cosmetic.name,
          value: cosmetic.value,
        },
      };
    });

    // Emit state change for gold update
    this.eventEmitter.emit(
      'player.state.changed',
      new PlayerStateChangedEvent({
        playerId,
        gold: result.gold,
      }),
    );

    return {
      playerState: {
        gold: result.gold.toString(),
      },
      cosmetic: result.cosmetic,
      message: `${result.cosmetic.name} purchased!`,
    };
  }

  /**
   * Equip or unequip a cosmetic
   */
  async equipCosmetic(playerId: string, dto: EquipCosmeticDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Check if player owns it
      const owned = await tx.playerCosmetic.findUnique({
        where: {
          player_id_cosmetic_id: {
            player_id: playerId,
            cosmetic_id: dto.cosmeticId,
          },
        },
        include: { cosmetic: true },
      });

      if (!owned) {
        throw new NotFoundException('You don\'t own this cosmetic');
      }

      // If equipping, unequip others of the same type
      if (dto.equipped) {
        await tx.playerCosmetic.updateMany({
          where: {
            player_id: playerId,
            cosmetic: { type: owned.cosmetic.type },
            equipped: true,
          },
          data: { equipped: false },
        });
      }

      // Update this cosmetic
      await tx.playerCosmetic.update({
        where: {
          player_id_cosmetic_id: {
            player_id: playerId,
            cosmetic_id: dto.cosmeticId,
          },
        },
        data: { equipped: dto.equipped },
      });

      return {
        cosmetic: owned.cosmetic,
        equipped: dto.equipped,
      };
    });

    return {
      cosmetic: {
        id: result.cosmetic.id,
        type: result.cosmetic.type,
        name: result.cosmetic.name,
        value: result.cosmetic.value,
      },
      equipped: result.equipped,
      message: result.equipped
        ? `${result.cosmetic.name} equipped!`
        : `${result.cosmetic.name} unequipped`,
    };
  }

  /**
   * Get player's currently equipped cosmetics (for applying to chat messages)
   */
  async getEquippedCosmetics(playerId: string): Promise<{
    nameColor: string | null;
    icon: string | null;
  }> {
    const equipped = await this.prisma.playerCosmetic.findMany({
      where: {
        player_id: playerId,
        equipped: true,
      },
      include: { cosmetic: true },
    });

    const nameColor =
      equipped.find((pc) => pc.cosmetic.type === CosmeticType.NAME_COLOR)?.cosmetic.value || null;
    const icon = equipped.find((pc) => pc.cosmetic.type === CosmeticType.ICON)?.cosmetic.value || null;

    return { nameColor, icon };
  }
}
