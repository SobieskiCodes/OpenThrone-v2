import { Controller, Get, Post, Param, Body, Req, UsePipes } from '@nestjs/common';
import { RecruitmentService } from './recruitment.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { claimRecruitLinkSchema, ClaimRecruitLinkDto } from '@openthrone/shared';
import type { Request } from 'express';

@Controller('recruitment')
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Get('status')
  async getStatus(@CurrentPlayer() player: any) {
    return this.recruitmentService.getRecruitmentStatus(player.id);
  }

  @Public()
  @Get('link/:link')
  async getRecruitLinkInfo(@Param('link') link: string) {
    return this.recruitmentService.getRecruitLinkInfo(link);
  }

  @Public()
  @Post('link/:link/claim')
  @UsePipes(new ZodValidationPipe(claimRecruitLinkSchema))
  async claimRecruitLink(
    @Param('link') link: string,
    @Body() body: ClaimRecruitLinkDto,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    return this.recruitmentService.claimRecruitLink(
      link,
      ipAddress,
      body.captchaToken,
    );
  }

  @Post('auto-recruit')
  async autoRecruit(@CurrentPlayer() player: any) {
    return this.recruitmentService.autoRecruit(player.id);
  }
}
