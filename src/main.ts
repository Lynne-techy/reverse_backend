import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import type { Env } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // nginx가 /api/** 만 프록시하는 배포 구성 전제 (동일 도메인 → CORS 제거)
  app.setGlobalPrefix('api');

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
