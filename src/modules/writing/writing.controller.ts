import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { CreateWritingSessionDto } from './dto/create-writing-session.dto';
import { WritingService } from './writing.service';
import { WritingSession } from './writing.types';

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
      dto.verseId,
      dto.language,
    );
  }

  /** POST /writing-sessions/:id/complete — 업로드 완료 처리 */
  @ApiOperation({
    summary: '필사 업로드 완료 처리',
    description:
      '클라이언트가 Storage 업로드를 마친 뒤 호출한다. (현재는 유사도 검사 스텁 — 항상 통과)',
  })
  @Post(':id/complete')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<WritingSession> {
    return this.writingService.complete(user.userId, id);
  }
}
