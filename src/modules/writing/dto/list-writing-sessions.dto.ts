import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** 목록 페이지 크기 기본값. 홈 "최근 필사 기록" 미리보기~타임라인 1페이지에 충분한 크기. */
export const DEFAULT_LIST_LIMIT = 10;
/** 페이지 크기 상한. 한 요청이 임의로 커지는 것을 막는다. */
export const MAX_LIST_LIMIT = 50;

/**
 * 최근 필사 기록 목록 쿼리. 최신순 flat 목록의 limit/offset 페이지네이션 —
 * 날짜 그룹핑은 프론트 몫이므로 커서 없이 단순 offset으로 충분하다.
 * (쿼리 문자열이라 @Type으로 숫자 변환)
 */
export class ListWritingSessionsQueryDto {
  @ApiPropertyOptional({
    example: 10,
    description: `한 번에 가져올 개수 (기본 ${DEFAULT_LIST_LIMIT}, 최대 ${MAX_LIST_LIMIT})`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit: number = DEFAULT_LIST_LIMIT;

  @ApiPropertyOptional({ example: 0, description: '건너뛸 개수 (기본 0)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
