import { Module } from '@nestjs/common';
import { DevController } from './dev.controller';
import { DevService } from './dev.service';

/**
 * 개발 편의 기능(mock 토큰 발급 등) 모듈.
 * 프로덕션에서의 실제 노출은 DevService 의 환경 가드로 차단한다.
 */
@Module({
  controllers: [DevController],
  providers: [DevService],
})
export class DevModule {}
