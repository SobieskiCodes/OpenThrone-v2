import { Module } from '@nestjs/common';
import { ArmoryController } from './armory.controller';
import { ArmoryService } from './armory.service';

@Module({
  controllers: [ArmoryController],
  providers: [ArmoryService],
  exports: [ArmoryService],
})
export class ArmoryModule {}
