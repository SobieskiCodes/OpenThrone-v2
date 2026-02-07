import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
}

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

  async validate(payload: JwtPayload) {
    // Look up the player by ID
    const player = await this.prisma.player.findUnique({
      where: { id: payload.sub },
    });

    if (!player) {
      throw new UnauthorizedException();
    }

    // Fetch permissions
    const permissionGrants = await this.prisma.permissionGrant.findMany({
      where: { user_id: player.id },
    });
    const permissions = permissionGrants.map((g) => g.type);

    return {
      id: player.id,
      email: player.email,
      displayName: player.display_name,
      race: player.race,
      class: player.player_class,
      colorScheme: player.color_scheme,
      permissions,
    };
  }
}
