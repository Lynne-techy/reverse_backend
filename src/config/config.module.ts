import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';

/**
 * 전역 설정 모듈.
 * .env 로딩 + zod 스키마 검증을 수행하고, 어디서든 ConfigService<Env, true>를
 * 주입해 타입 안전하게 환경변수에 접근할 수 있게 한다.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
