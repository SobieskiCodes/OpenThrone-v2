import { Controller, Get, Post, Param } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';

@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Public()
  @Get(':link')
  async getRecruitmentLink(@Param('link') link: string) {
    // TODO: Handle recruitment link visit
    return this.recruitmentService.handleRecruitmentLink(link);
  }

  @Post('auto-recruit')
  async autoRecruit(@CurrentPlayer() player: any) {
    // TODO: Implement auto-recruit functionality
    return this.recruitmentService.autoRecruit(player.id);
  }
}
