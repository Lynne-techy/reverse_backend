import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/**
 * 같은 책·장 안의 절 범위 조회 쿼리. 클라이언트가 key verse를 고르도록
 * 범위 절 목록을 받는 데 쓴다. (쿼리 문자열이라 @Type으로 숫자 변환)
 */
export class GetVerseRangeQueryDto {
  @ApiProperty({ example: 19, description: '성경 책 번호 (1~66)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  book!: number;

  @ApiProperty({ example: 23, description: '장' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chapter!: number;

  @ApiProperty({ example: 1, description: '시작 절' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  from!: number;

  @ApiProperty({ example: 6, description: '종료 절 (from 이상)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  to!: number;
}
