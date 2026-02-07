import { Controller, Get, Post, Body, UsePipes } from '@nestjs/common';
import { TrainingService } from './training.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  trainUnitsSchema,
  untrainUnitsSchema,
  convertUnitsSchema,
  TrainUnitsDto,
  UntrainUnitsDto,
  ConvertUnitsDto,
} from '@openthrone/shared';

@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('status')
  async getStatus(@CurrentPlayer() player: any) {
    return this.trainingService.getTrainingStatus(player.id);
  }

  @Post('train')
  @UsePipes(new ZodValidationPipe(trainUnitsSchema))
  async train(@CurrentPlayer() player: any, @Body() body: TrainUnitsDto) {
    return this.trainingService.train(player.id, body);
  }

  @Post('untrain')
  @UsePipes(new ZodValidationPipe(untrainUnitsSchema))
  async untrain(@CurrentPlayer() player: any, @Body() body: UntrainUnitsDto) {
    return this.trainingService.untrain(player.id, body);
  }

  @Post('convert')
  @UsePipes(new ZodValidationPipe(convertUnitsSchema))
  async convert(@CurrentPlayer() player: any, @Body() body: ConvertUnitsDto) {
    return this.trainingService.convert(player.id, body);
  }
}
