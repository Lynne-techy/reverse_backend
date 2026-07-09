import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Min } from 'class-validator';
import { WRITING_LANGUAGES } from '../writing.types';
import type { WritingLanguage } from '../writing.types';

export class CreateWritingSessionDto {
  @ApiProperty({ example: 19, description: '성경 책 번호 (1~66)' })
  @IsInt()
  @Min(1)
  book!: number;

  @ApiProperty({ example: 23, description: '장' })
  @IsInt()
  @Min(1)
  chapter!: number;

  @ApiProperty({ example: 1, description: '필사 범위 시작 절 번호 (같은 장 내)' })
  @IsInt()
  @Min(1)
  startVerseNo!: number;

  @ApiProperty({ example: 6, description: '필사 범위 종료 절 번호 (startVerseNo 이상)' })
  @IsInt()
  @Min(1)
  endVerseNo!: number;

  @ApiProperty({
    enum: WRITING_LANGUAGES,
    example: 'ko',
    description: '필사 언어 (한국어 ko / 영어 en)',
  })
  @IsIn(WRITING_LANGUAGES)
  language!: WritingLanguage;
}
