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
      // .env.local(개인 로컬 값, git 미추적)이 .env(공통 값)보다 우선한다.
      // 기본값은 .env만 읽어서, .env.local에 넣은 키가 조용히 무시되는 문제가 있었다.
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
