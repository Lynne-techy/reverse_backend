import { Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { DevService, MockTokenResult } from './dev.service';

/**
 * 개발 전용 라우트. 프론트/클라이언트 테스트 편의를 위한 것으로,
 * 프로덕션에서는 DevService 가 차단한다.
 */
@ApiTags('dev')
@Controller('dev')
export class DevController {
  constructor(private readonly devService: DevService) {}

  /** POST /dev/token — mock 유저 access_token 발급 (인증 불필요) */
  @Public()
  @ApiOperation({
    summary: '[개발용] mock 토큰 발급',
    description:
      '터미널 시드 스크립트 없이 mock 유저의 access_token 을 받는다. 개발 환경에서만 동작.',
  })
  @Post('token')
  issueToken(): Promise<MockTokenResult> {
    return this.devService.issueMockToken();
  }
}
