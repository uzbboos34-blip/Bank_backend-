import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/core/database/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Super Admin tomonidan yangi hodim qo'shish
   */
  async createEmployee(dto: CreateEmployeeDto) {
    const existing = await this.prisma.user.findUnique({
      where: { login: dto.login },
    });

    if (existing) {
      throw new ConflictException(`Ushbu login (${dto.login}) band. Boshqa login tanlang`);
    }

    const pinHash = await bcrypt.hash(dto.pin, 10);

    const user = await this.prisma.user.create({
      data: {
        login: dto.login,
        pinHash,
        fullName: dto.fullName ?? null,
        role: dto.role ?? 'COLLECTOR',
        isActive: true,
      },
      select: {
        id: true,
        login: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Barcha hodimlar ro'yxati (Super Admin uchun)
   */
  async getEmployees() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        login: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { debtors: true },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * Bitta hodim ma'lumotlarini olish
   */
  async getEmployeeById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        login: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { debtors: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Hodim topilmadi');
    }

    return user;
  }

  /**
   * Hodim ma'lumotlarini yoki PIN kodini yangilash
   */
  async updateEmployee(id: number, dto: UpdateEmployeeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Hodim topilmadi');
    }

    const data: Record<string, unknown> = {};

    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName;
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (dto.role !== undefined) {
      data.role = dto.role;
    }

    if (dto.pin) {
      data.pinHash = await bcrypt.hash(dto.pin, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        login: true,
        fullName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }
}
