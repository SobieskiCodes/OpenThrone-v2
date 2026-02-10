import * as crypto from 'crypto';
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as argon2 from 'argon2';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '@openthrone/shared';
import {
  PlayerRegisteredEvent,
  PlayerLoggedInEvent,
} from '@openthrone/events';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterDto) {
    // Check if email already exists (case-insensitive via lowercase)
    const existingEmail = await this.prisma.player.findFirst({
      where: {
        email: dto.email.toLowerCase(),
      },
    });
    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }

    // Check if display_name already exists (case-insensitive via LOWER() - works on both SQLite and PostgreSQL)
    const existingName = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM players WHERE LOWER(display_name) = LOWER(${dto.displayName}) LIMIT 1`;

    if (existingName.length > 0) {
      throw new ConflictException('Display name already in use');
    }

    // Hash the password
    const passwordHash = await argon2.hash(dto.password);

    // Create player and all related records in a transaction
    const player = await this.prisma.$transaction(async (tx) => {
      const newPlayer = await tx.player.create({
        data: {
          email: dto.email.toLowerCase(),
          display_name: dto.displayName,
          password_hash: passwordHash,
          race: dto.race,
          player_class: dto.class,
          locale: dto.locale ?? 'en-US',
        },
      });

      await tx.playerEconomy.create({
        data: {
          player_id: newPlayer.id,
          gold: 25000,
          gold_in_bank: 0,
          attack_turns: 50,
          house_level: 0,
          economy_level: 0,
        },
      });

      await tx.playerUnit.create({
        data: {
          player_id: newPlayer.id,
          unit_type: 'CITIZEN',
          level: 1,
          quantity: 50,
        },
      });

      await tx.playerFortification.create({
        data: {
          player_id: newPlayer.id,
          fort_level: 1,
          hitpoints: 50,
        },
      });

      await tx.playerStats.create({
        data: {
          player_id: newPlayer.id,
        },
      });

      // Create 5 bonus point rows
      const bonusTypes = ['OFFENSE', 'DEFENSE', 'INTEL', 'PRICES', 'INCOME'] as const;
      for (const bonusType of bonusTypes) {
        await tx.playerBonusPoint.create({
          data: {
            player_id: newPlayer.id,
            bonus_type: bonusType,
            level: 0,
          },
        });
      }

      return newPlayer;
    });

    // Emit registration event
    this.eventEmitter.emit(
      'player.registered',
      new PlayerRegisteredEvent(player.id, player.display_name, player.email),
    );

    // Generate JWT
    const payload = {
      sub: player.id,
      email: player.email,
      displayName: player.display_name,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      player: {
        id: player.id,
        displayName: player.display_name,
        race: player.race,
        class: player.player_class,
      },
    };
  }

  async login(dto: LoginDto) {
    // Find player by email (stored lowercase)
    const player = await this.prisma.player.findFirst({
      where: {
        email: dto.email.toLowerCase(),
      },
    });
    if (!player) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const passwordValid = await argon2.verify(player.password_hash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check account status
    if (
      player.status === 'BANNED' ||
      player.status === 'SUSPENDED' ||
      player.status === 'CLOSED' ||
      player.status === 'TIMEOUT'
    ) {
      throw new ForbiddenException(`Account status: ${player.status}`);
    }
    if (player.status === 'VACATION') {
      throw new ForbiddenException('Account is on vacation');
    }

    // Update last_active timestamp
    await this.prisma.player.update({
      where: { id: player.id },
      data: { last_active: new Date() },
    });

    // Fetch permissions
    const permissionGrants = await this.prisma.permissionGrant.findMany({
      where: { user_id: player.id },
    });
    const permissions = permissionGrants.map((g) => g.type);

    // Generate JWT
    const payload = {
      sub: player.id,
      email: player.email,
      displayName: player.display_name,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    // Emit login event
    this.eventEmitter.emit(
      'player.logged_in',
      new PlayerLoggedInEvent(player.id),
    );

    return {
      accessToken,
      player: {
        id: player.id,
        displayName: player.display_name,
        race: player.race,
        class: player.player_class,
        colorScheme: player.color_scheme,
        permissions,
      },
    };
  }

  async refresh(user: { id: string; email: string; displayName: string }) {
    const payload = {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    // Find player by email - always return success to prevent email enumeration
    const player = await this.prisma.player.findFirst({
      where: {
        email: dto.email.toLowerCase(),
      },
    });

    if (player) {
      // Generate random verification code
      const verificationCode = crypto.randomUUID();

      // Create PasswordReset record
      await this.prisma.passwordReset.create({
        data: {
          user_id: player.id,
          verification_code: verificationCode,
          status: 0, // Active
          type: 'PASSWORD',
        },
      });

      // TODO: Send reset email with verificationCode
    }

    return { message: 'If an account exists, a reset email has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Find active PasswordReset by token
    const resetRecord = await this.prisma.passwordReset.findFirst({
      where: {
        verification_code: dto.token,
        status: 0, // Active
      },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if created less than 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (resetRecord.created_at < oneHourAgo) {
      // Mark as expired
      await this.prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { status: 2 }, // Expired
      });
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const passwordHash = await argon2.hash(dto.password);

    // Update player password
    await this.prisma.player.update({
      where: { id: resetRecord.user_id },
      data: { password_hash: passwordHash },
    });

    // Mark reset as used
    await this.prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { status: 1 }, // Used
    });

    return { message: 'Password reset successfully' };
  }

  async verifyEmail(_dto: unknown) {
    return { message: 'Email verification not yet required' };
  }
}
