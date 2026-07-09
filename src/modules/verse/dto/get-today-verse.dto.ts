import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * 클라이언트 기기의 로컬 날짜를 그대로 받는다. 서버는 타임존을 계산하지 않고
 * 이 값을 daily_verses의 조회/배정 키로만 사용한다.
 */
export class GetTodayVerseQueryDto {
  @ApiProperty({ example: '2026-07-07', description: '클라이언트 기기의 로컬 날짜 (YYYY-MM-DD)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date는 YYYY-MM-DD 형식이어야 합니다.',
  })
  date!: string;
}
