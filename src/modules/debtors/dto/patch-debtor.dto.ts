import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
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

  // ---- YANGI: Telefon raqamlar va manzil tahrirlash ----
  @ApiPropertyOptional({
    type: [String],
    description: 'Telefon raqamlar ro\'yxati (raqamlar, harflar, +, -, bo\'sh joy bo\'lishi mumkin)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phones?: string[];

  @ApiPropertyOptional({ type: String, description: 'Manzil (yangilash)' })
  @IsOptional()
  @IsString()
  address?: string;
}
