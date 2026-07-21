import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GEMINI_COMPLETE_THROTTLE } from '../../common/throttler/throttle.constants';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { CompleteWritingSessionDto } from './dto/complete-writing-session.dto';
import { CreateWritingSessionDto } from './dto/create-writing-session.dto';
import { ListWritingSessionsQueryDto } from './dto/list-writing-sessions.dto';
import { WritingService } from './writing.service';
import { WritingListItem, WritingSession } from './writing.types';

@ApiTags('writing-sessions')
@ApiBearerAuth('access-token')
@Controller('writing-sessions')
export class WritingController {
  constructor(private readonly writingService: WritingService) {}

  /** POST /writing-sessions/upload-url — 업로드용 presigned URL + 세션 생성 */
  @ApiOperation({
    summary: '필사 이미지 업로드 URL 발급',
    description:
      'Storage에 직접 업로드할 presigned URL과 세션을 생성한다. 실제 업로드는 이 URL로 클라이언트가 수행한다.',
  })
  @Post('upload-url')
  createUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWritingSessionDto,
  ): Promise<{ sessionId: string; objectKey: string; uploadUrl: string }> {
    return this.writingService.createUploadUrl(
      user.userId,
      dto.book,
      dto.chapter,
      dto.startVerseNo,
      dto.endVerseNo,
      dto.language,
    );
  }

  /** GET /writing-sessions — 내 필사 기록 목록(통과분, 최신순) */
  @ApiOperation({
    summary: '최근 필사 기록 목록',
    description:
      '통과(passed=true)한 내 필사 세션을 최신순(clientDate → completedAt)으로 반환한다. ' +
      'limit/offset 페이지네이션 — 받은 개수가 limit보다 적으면 마지막 페이지다. ' +
      '날짜 그룹핑·건수 카운트는 클라이언트가 수행한다. meditation이 null이면 "(묵상 미작성)"으로 표시한다.',
  })
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWritingSessionsQueryDto,
  ): Promise<WritingListItem[]> {
    return this.writingService.listMyWritings(
      user.userId,
      query.limit,
      query.offset,
    );
  }

  /** GET /writing-sessions/:id — 세션 조회(비동기 검사 결과 폴링) */
  @ApiOperation({
    summary: '필사 세션 조회',
    description:
      'complete 이후 status가 processing → completed/failed로 바뀌는 것을 폴링으로 확인한다.',
  })
  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<WritingSession> {
    return this.writingService.getById(user.userId, id);
  }

  /** POST /writing-sessions/:id/complete — 기록 저장(key verse 확정 + 유사도 검사 시작) */
  @ApiOperation({
    summary: '필사 기록 저장 (유사도 검사 시작)',
    description:
      '업로드 후 범위에서 고른 key verse와 함께 호출한다. key verse를 확정하고 세션을 processing으로 바꾼 뒤 즉시 응답한다. ' +
      'Gemini 유사도 검사는 백그라운드에서 수행되므로 GET /writing-sessions/:id를 폴링해 completed/failed를 확인한다. failed면 재호출로 재시도할 수 있다.',
  })
  // 유료 Gemini 유사도 검사를 트리거 → 전역 기본값보다 훨씬 낮게 재정의(비용 방어).
  @Throttle(GEMINI_COMPLETE_THROTTLE)
  @Post(':id/complete')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CompleteWritingSessionDto,
  ): Promise<WritingSession> {
    return this.writingService.complete(
      user.userId,
      id,
      dto.keyVerseId,
      dto.date,
      {
        meditation: dto.meditation,
        application: dto.application,
        prayer: dto.prayer,
      },
    );
  }
}
