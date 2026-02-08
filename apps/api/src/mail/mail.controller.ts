import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { MailService } from './mail.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { sendMailSchema, SendMailDto } from '@openthrone/shared';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  // Static routes FIRST (before :id)

  @Get('unread-count')
  async getUnreadCount(@CurrentPlayer() player: any) {
    return this.mailService.getUnreadCount(player.id);
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentPlayer() player: any) {
    return this.mailService.markAllAsRead(player.id);
  }

  @Get()
  async getInbox(
    @CurrentPlayer() player: any,
    @Query('type') type?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.mailService.getInbox(
      player.id,
      type,
      unreadOnly === 'true',
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  async getMail(
    @CurrentPlayer() player: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.mailService.getMail(player.id, id);
  }

  @Post()
  async sendMail(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(sendMailSchema)) body: SendMailDto,
  ) {
    return this.mailService.sendMail(player.id, body);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentPlayer() player: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.mailService.markAsRead(player.id, id);
  }

  @Delete(':id')
  async deleteMail(
    @CurrentPlayer() player: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.mailService.deleteMail(player.id, id);
  }
}
