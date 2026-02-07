import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() body: any) {
    // TODO: Add Zod validation pipe for registration DTO
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  async login(@Body() body: any) {
    // TODO: Add Zod validation pipe for login DTO
    return this.authService.login(body);
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() body: any) {
    // TODO: Add Zod validation pipe for email verification DTO
    return this.authService.verifyEmail(body);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() body: any) {
    // TODO: Add Zod validation pipe for forgot password DTO
    return this.authService.forgotPassword(body);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: any) {
    // TODO: Add Zod validation pipe for reset password DTO
    return this.authService.resetPassword(body);
  }
}
