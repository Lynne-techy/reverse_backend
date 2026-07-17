import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * 기록 저장(complete) 시 함께 보내는 데이터. 흐름 A에서 key verse는 이미지 업로드 후
 * 범위 절을 보고 고르므로, 세션 생성이 아니라 이 시점에 확정된다.
 * QT(묵상/적용/기도제목)도 같은 화면의 마지막 단계라 이 요청에 함께 실어 보낸다 —
 * 모두 선택 입력이고, 완료 후 별도 수정 API는 두지 않는다(기획상 완료 후 작성 불가).
 */
export class CompleteWritingSessionDto {
  @ApiProperty({
    example: 9,
    description: '범위 중 대표로 고른 절(key verse)의 verse id. 세션 범위 안의 절이어야 한다.',
  })
  @IsInt()
  @Min(1)
  keyVerseId!: number;

  @ApiProperty({
    example: '2026-07-16',
    description:
      '클라이언트 기기의 로컬 날짜 (YYYY-MM-DD). 잔디/streak의 기록 기준일이 된다 (/verses/today와 동일 방침).',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date는 YYYY-MM-DD 형식이어야 합니다.',
  })
  date!: string;

  @ApiPropertyOptional({
    example: '한/영 나란히 적으니 trust의 무게가 다르게 읽힌다.',
    description: 'QT 묵상 — 이 말씀이 내게 어떻게 다가왔는지. 최대 500자.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meditation?: string;

  @ApiPropertyOptional({
    example: '오늘 결정할 일을 내 명철 대신 기도로 시작한다.',
    description: 'QT 적용 — 오늘 삶에 어떻게 적용할지. 최대 500자.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  application?: string;

  @ApiPropertyOptional({
    example: '흔들리는 진로 앞에서 주님을 신뢰하게 하소서.',
    description: 'QT 기도제목 — 이 말씀으로 무엇을 기도할지. 최대 500자.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  prayer?: string;
}
