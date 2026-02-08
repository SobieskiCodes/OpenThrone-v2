import { Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { NotificationListener } from './notification.listener';

@Module({
  controllers: [MailController],
  providers: [MailService, NotificationListener],
  exports: [MailService],
})
export class MailModule {}
