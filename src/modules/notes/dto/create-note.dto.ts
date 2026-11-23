import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DebtorStatus } from '@prisma/client';

export class CreateNoteDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Frontent tomonidan yuborilgan idempotentlik kaliti (UUID)',
  })
  @IsNotEmpty({ message: 'clientId kiritilishi shart' })
  @IsString({ message: 'clientId matn ko\'rinishida bo\'lishi kerak' })
  clientId: string;

  @ApiPropertyOptional({ enum: DebtorStatus, description: 'Qayd bilan birga qarzdor holatini ham yangilash' })
  @IsOptional()
  @IsEnum(DebtorStatus)
  status?: DebtorStatus;

  @ApiPropertyOptional({ example: 'Mijoz uyda yo\'q, onasi bilan gaplashdim', description: 'Qayd matni' })
  @IsOptional()
  @IsString({ message: 'text matn ko\'rinishida bo\'lishi kerak' })
  text?: string;
}
