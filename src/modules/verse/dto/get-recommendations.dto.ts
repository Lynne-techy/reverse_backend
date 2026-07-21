import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { EMOTION_CODES } from '../emotion.types';

/**
 * 감정 기반 추천 조회 쿼리. emotion은 emotion_tags 의 code 중 하나여야 한다.
 * DTO(@IsIn)와 DB check(FK→emotion_tags)가 함께 잘못된 값을 막는다(이중 방어선).
 */
export class GetRecommendationsQueryDto {
  @ApiProperty({
    enum: EMOTION_CODES,
    example: 'depression',
    description: '감정 코드 (emotion_tags.code)',
  })
  @IsIn([...EMOTION_CODES])
  emotion!: string;
}
