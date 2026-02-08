import { Controller, Get, Post, Body } from '@nestjs/common';
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
  async train(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(trainUnitsSchema)) body: TrainUnitsDto,
  ) {
    return this.trainingService.train(player.id, body);
  }

  @Post('untrain')
  async untrain(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(untrainUnitsSchema)) body: UntrainUnitsDto,
  ) {
    return this.trainingService.untrain(player.id, body);
  }

  @Post('convert')
  async convert(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(convertUnitsSchema)) body: ConvertUnitsDto,
  ) {
    return this.trainingService.convert(player.id, body);
  }
}
