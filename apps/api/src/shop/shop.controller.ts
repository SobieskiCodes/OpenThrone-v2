import { Controller, Get, Post, Body } from '@nestjs/common';
import { ShopService } from './shop.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  purchaseCosmeticSchema,
  equipCosmeticSchema,
  PurchaseCosmeticDto,
  EquipCosmeticDto,
} from '@openthrone/shared';

@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('cosmetics')
  async getCosmeticsShop() {
    return this.shopService.getCosmeticsShop();
  }

  @Get('cosmetics/owned')
  async getPlayerCosmetics(@CurrentPlayer('id') playerId: string) {
    return this.shopService.getPlayerCosmetics(playerId);
  }

  @Post('cosmetics/purchase')
  async purchaseCosmetic(
    @CurrentPlayer('id') playerId: string,
    @Body(new ZodValidationPipe(purchaseCosmeticSchema)) body: PurchaseCosmeticDto,
  ) {
    return this.shopService.purchaseCosmetic(playerId, body);
  }

  @Post('cosmetics/equip')
  async equipCosmetic(
    @CurrentPlayer('id') playerId: string,
    @Body(new ZodValidationPipe(equipCosmeticSchema)) body: EquipCosmeticDto,
  ) {
    return this.shopService.equipCosmetic(playerId, body);
  }
}
