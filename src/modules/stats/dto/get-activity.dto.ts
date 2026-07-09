import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/** 잔디 조회 구간. 클라이언트 로컬 날짜를 그대로 키로 쓴다(verse와 동일 방침). */
export class GetActivityQueryDto {
  @ApiProperty({ example: '2026-07-01', description: '조회 시작일 (YYYY-MM-DD, 포함)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from은 YYYY-MM-DD 형식이어야 합니다.',
  })
  from!: string;

  @ApiProperty({ example: '2026-07-31', description: '조회 종료일 (YYYY-MM-DD, 포함)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to는 YYYY-MM-DD 형식이어야 합니다.',
  })
  to!: string;
}
