import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreateWritingSessionDto {
  @ApiProperty({ example: 1, description: '필사할 verse의 id' })
  @IsInt()
  @Min(1)
  verseId!: number;
}
