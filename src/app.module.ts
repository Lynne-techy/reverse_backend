import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Env } from './config/env.validation';
import { UserThrottlerGuard } from './common/throttler/user-throttler.guard';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { VerseModule } from './modules/verse/verse.module';
import { WritingModule } from './modules/writing/writing.module';
import { StatsModule } from './modules/stats/stats.module';
import { DevModule } from './modules/dev/dev.module';
import { SupabaseModule } from './common/supabase/supabase.module';
import { HandwritingCheckModule } from './modules/handwriting-check/handwriting-check.module';
import { BooksModule } from './modules/books/books.module';

@Module({
  imports: [
    AppConfigModule,
    // 전역 rate limiting. 버킷 키는 UserThrottlerGuard 가 userId(sub)로 잡는다.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL_MS', { infer: true }),
            limit: config.get('THROTTLE_LIMIT', { infer: true }),
          },
        ],
      }),
    }),
    SupabaseModule,
    AuthModule,
    UserModule,
    VerseModule,
    WritingModule,
    StatsModule,
    DevModule,
    HandwritingCheckModule,
    BooksModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class AppModule {}
