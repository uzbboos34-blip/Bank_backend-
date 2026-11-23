import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: '5678', description: 'Yangi PIN kod' })
  @IsOptional()
  @IsString({ message: 'PIN matn bo\'lishi kerak' })
  @MinLength(4, { message: 'PIN kamida 4 ta belgidan iborat bo\'lishi kerak' })
  pin?: string;

  @ApiPropertyOptional({ example: 'Ahmad Karimov', description: 'Hodimning to\'liq ism-sharifi' })
  @IsOptional()
  @IsString({ message: 'fullName matn bo\'lishi kerak' })
  fullName?: string;

  @ApiPropertyOptional({ example: true, description: 'Hodim faolligi (true - faol, false - bloklangan)' })
  @IsOptional()
  @IsBoolean({ message: 'isActive mantiqiy qiymat (true/false) bo\'lishi kerak' })
  isActive?: boolean;

  @ApiPropertyOptional({ enum: Role, description: 'Hodim roli' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
