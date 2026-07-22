import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import type { Env } from './config/env.validation';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 전역 설정(trust proxy·helmet·ValidationPipe·예외 필터·프리픽스)은 e2e와 공유.
  configureApp(app);

  const config = app.get(ConfigService<Env, true>);

  // 프로덕션에서는 API 스펙을 외부에 노출하지 않는다.
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Re-Verse API')
        .setDescription('로그인 → 필사 업로드 → 잔디 수직 슬라이스')
        .setVersion('0.1')
        .addBearerAuth(
          { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          'access-token',
        )
        .build(),
    );
    SwaggerModule.setup('api-docs', app, document);
  }

  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
