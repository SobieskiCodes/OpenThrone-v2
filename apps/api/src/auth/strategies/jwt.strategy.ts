import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'change-me-in-production'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    // TODO: Implement full user lookup and attach permissions
    // - Fetch user from database by payload.sub
    // - Attach permissions/roles to the returned user object
    const user = { id: payload.sub, email: payload.email };
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
