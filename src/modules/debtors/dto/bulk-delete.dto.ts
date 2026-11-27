import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, ArrayMinSize } from 'class-validator';

export class BulkDeleteDto {
  @ApiProperty({ type: [Number], description: 'O\'chiriladigan qarzdorlar ID ro\'yxati' })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  ids: number[];
}
