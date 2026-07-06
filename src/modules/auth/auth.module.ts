import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UserModule } from '../user/user.module';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [UserModule],
  providers: [
    AuthService,
    // 전역 인증 Guard. @Public 을 제외한 모든 라우트에 적용된다.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
