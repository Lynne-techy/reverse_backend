import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Min } from 'class-validator';
import { WRITING_LANGUAGES } from '../writing.types';
import type { WritingLanguage } from '../writing.types';

export class CreateWritingSessionDto {
  @ApiProperty({ example: 1, description: '필사할 verse의 id' })
  @IsInt()
  @Min(1)
  verseId!: number;

  @ApiProperty({
    enum: WRITING_LANGUAGES,
    example: 'ko',
    description: '필사 언어 (한국어 ko / 영어 en)',
  })
  @IsIn(WRITING_LANGUAGES)
  language!: WritingLanguage;
}
