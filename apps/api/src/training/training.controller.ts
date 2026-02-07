import { Controller, Post, Body } from '@nestjs/common';
import { TrainingService } from './training.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';

@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post('train')
  async train(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for training DTO
    return this.trainingService.train(player.id, body);
  }

  @Post('untrain')
  async untrain(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for untrain DTO
    return this.trainingService.untrain(player.id, body);
  }

  @Post('convert')
  async convert(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for convert DTO
    return this.trainingService.convert(player.id, body);
  }
}
