import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/core/database/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { login: dto.login },
    });

    if (!user) {
      throw new UnauthorizedException('Login yoki PIN noto\'g\'ri');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Hisobingiz nofaol (bloklangan). Super administratorga murojaat qiling');
    }

    const isMatch = await bcrypt.compare(dto.pin, user.pinHash);
    if (!isMatch) {
      throw new UnauthorizedException('Login yoki PIN noto\'g\'ri');
    }

    const payload = {
      sub: user.id,
      login: user.login,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    this.logger.log(`Foydalanuvchi tizimga kirdi: ID=${user.id}, Role=${user.role}`);

    return {
      accessToken,
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}
