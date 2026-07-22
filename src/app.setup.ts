import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * prod 부팅(main.ts)과 e2e 테스트가 **동일한 전역 설정**을 쓰도록 추출한 함수.
 * 적용 순서(trust proxy → helmet → ValidationPipe → 예외 필터 → 전역 프리픽스)를
 * main.ts에 있던 그대로 보존한다. Swagger·listen 등 부팅 전용 로직은 main.ts에 남긴다.
 *
 * (이 추출이 없으면 e2e가 프리픽스/파이프를 빠뜨려 prod와 어긋난다 — 옛 e2e 스텁이 그랬다.)
 */
export function configureApp(app: NestExpressApplication): void {
  // Cloudflare → nginx → node 프록시 뒤라 X-Forwarded-For 를 신뢰해야
  // rate limit 의 IP 폴백(req.ip)이 실제 클라이언트를 가리킨다.
  app.set('trust proxy', 1);

  // 보안 헤더(방어심층). CSP·HSTS 는 브라우저 앱을 서빙하는 nginx 가 소유하므로
  // 여기선 끄고(JSON API엔 CSP 불필요, HSTS 중복 방지) 나머지 안전 헤더만 적용.
  app.use(helmet({ contentSecurityPolicy: false, hsts: false }));

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
}
