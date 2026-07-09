import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/**
 * 기록 저장(complete) 시 함께 보내는 데이터. 흐름 A에서 key verse는 이미지 업로드 후
 * 범위 절을 보고 고르므로, 세션 생성이 아니라 이 시점에 확정된다.
 * (묵상/적용/기도(QT)는 형식 미정 — 이후 증분에서 추가)
 */
export class CompleteWritingSessionDto {
  @ApiProperty({
    example: 9,
    description: '범위 중 대표로 고른 절(key verse)의 verse id. 세션 범위 안의 절이어야 한다.',
  })
  @IsInt()
  @Min(1)
  keyVerseId!: number;
}
