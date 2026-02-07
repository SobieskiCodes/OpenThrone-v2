import { Controller, Get, Post, Body, Query, UsePipes } from '@nestjs/common';
import { BankService } from './bank.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  bankDepositSchema,
  bankWithdrawSchema,
  BankDepositDto,
  BankWithdrawDto,
} from '@openthrone/shared';

@Controller('bank')
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Get('status')
  async getStatus(@CurrentPlayer() player: any) {
    return this.bankService.getStatus(player.id);
  }

  @Get('history')
  async getHistory(
    @CurrentPlayer() player: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('filter') filter?: string,
  ) {
    return this.bankService.getHistory(
      player.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      filter,
    );
  }

  @Post('deposit')
  @UsePipes(new ZodValidationPipe(bankDepositSchema))
  async deposit(@CurrentPlayer() player: any, @Body() body: BankDepositDto) {
    return this.bankService.deposit(player.id, body.amount);
  }

  @Post('withdraw')
  @UsePipes(new ZodValidationPipe(bankWithdrawSchema))
  async withdraw(@CurrentPlayer() player: any, @Body() body: BankWithdrawDto) {
    return this.bankService.withdraw(player.id, body.amount);
  }
}
