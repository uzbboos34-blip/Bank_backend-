import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'bank_collector', description: 'Foydalanuvchi logini' })
  @IsNotEmpty({ message: 'Login kiritilishi shart' })
  @IsString({ message: 'Login matn ko\'rinishida bo\'lishi kerak' })
  login: string;

  @ApiProperty({ example: '1234', description: 'Foydalanuvchi PIN kodi' })
  @IsNotEmpty({ message: 'PIN kiritilishi shart' })
  @IsString({ message: 'PIN matn ko\'rinishida bo\'lishi kerak' })
  @MinLength(4, { message: 'PIN kamida 4 ta belgidan iborat bo\'lishi kerak' })
  pin: string;
}
