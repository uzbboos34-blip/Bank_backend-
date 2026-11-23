import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'ahmad_collector', description: 'Hodim logini' })
  @IsNotEmpty({ message: 'Login kiritilishi shart' })
  @IsString({ message: 'Login matn bo\'lishi kerak' })
  login: string;

  @ApiProperty({ example: '1234', description: 'Hodimning boshlang\'ich PIN kodi' })
  @IsNotEmpty({ message: 'PIN kiritilishi shart' })
  @IsString({ message: 'PIN matn bo\'lishi kerak' })
  @MinLength(4, { message: 'PIN kamida 4 ta belgidan iborat bo\'lishi kerak' })
  pin: string;

  @ApiPropertyOptional({ example: 'Ahmad Karimov', description: 'Hodimning to\'liq ism-sharifi' })
  @IsOptional()
  @IsString({ message: 'fullName matn bo\'lishi kerak' })
  fullName?: string;

  @ApiPropertyOptional({ enum: Role, default: Role.COLLECTOR, description: 'Hodim roli (COLLECTOR yoki SUPER_ADMIN)' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role = Role.COLLECTOR;
}
