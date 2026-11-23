import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, ValidateIf } from 'class-validator';
import { DebtorStatus } from '@prisma/client';

export class PatchDebtorDto {
  @ApiPropertyOptional({ enum: DebtorStatus, description: 'Yangi holat' })
  @IsOptional()
  @IsEnum(DebtorStatus)
  status?: DebtorStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Va'da qilingan to'lov sanasi (ISO 8601 yoki null)",
  })
  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsDateString({}, { message: 'promiseDate ISO 8601 sana formati bo\'lishi kerak' })
  promiseDate?: string | null;

  @ApiPropertyOptional({ type: Number, description: 'Kenglik (Latitude)' })
  @IsOptional()
  @IsNumber({}, { message: 'lat son ko\'rinishida bo\'lishi kerak' })
  lat?: number;

  @ApiPropertyOptional({ type: Number, description: 'Uzunlik (Longitude)' })
  @IsOptional()
  @IsNumber({}, { message: 'lng son ko\'rinishida bo\'lishi kerak' })
  lng?: number;
}
