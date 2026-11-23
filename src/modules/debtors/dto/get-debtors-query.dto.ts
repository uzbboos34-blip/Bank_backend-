import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DebtorStatus } from '@prisma/client';

export enum DebtorSortOption {
  MIN_DEBT_DESC = 'minDebt_desc',
  NAME_ASC = 'name_asc',
  PROMISE_DATE_ASC = 'promiseDate_asc',
}

export class GetDebtorsQueryDto {
  @ApiPropertyOptional({ description: 'Ism, telefon yoki manzil bo\'yicha qidiruv' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: DebtorStatus, description: 'Holat bo\'yicha filtr' })
  @IsOptional()
  @IsEnum(DebtorStatus)
  status?: DebtorStatus;

  @ApiPropertyOptional({ description: 'MFY (mahalla) bo\'yicha filtr' })
  @IsOptional()
  @IsString()
  mfy?: string;

  @ApiPropertyOptional({
    enum: DebtorSortOption,
    description: 'Saralash tartibi (minDebt_desc | name_asc | promiseDate_asc)',
  })
  @IsOptional()
  @IsEnum(DebtorSortOption)
  sort?: DebtorSortOption;

  @ApiPropertyOptional({ default: 1, description: 'Sahifa raqami' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, description: 'Har bir sahifadagi qatorlar soni' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
