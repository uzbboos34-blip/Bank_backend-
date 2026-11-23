import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@prisma/client';
import { CurrentUserPayload } from 'src/common/types/user';
import { PrismaService } from 'src/core/database/prisma.service';

interface JwtPayload {
  sub: number;
  login: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'undiruv_secure_jwt_secret_key_bank_2026_super_hash',
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, login: true, role: true, fullName: true, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Hisobingiz nofaol (bloklangan). Super administratorga murojaat qiling');
    }

    return {
      id: user.id,
      login: user.login,
      role: user.role,
      fullName: user.fullName,
    };
  }
}
