import { Controller, Get, Post, Body } from '@nestjs/common';
import { BankService } from './bank.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';

@Controller('bank')
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Get('history')
  async getHistory(@CurrentPlayer() player: any) {
    // TODO: Return bank transaction history for the authenticated player
    return this.bankService.getHistory(player.id);
  }

  @Post('deposit')
  async deposit(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for deposit DTO
    return this.bankService.deposit(player.id, body);
  }

  @Post('withdraw')
  async withdraw(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for withdraw DTO
    return this.bankService.withdraw(player.id, body);
  }
}
