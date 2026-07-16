import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import type { Env } from '../../config/env.validation';
import { isAuthProvider } from '../user/user.types';
import { AuthenticatedUser } from './current-user.decorator';

/**
 * Supabase Auth 가 발급한 비대칭(ES256/RS256) 서명 JWT를
 * JWKS 엔드포인트의 공개키로 검증한다.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly issuer: string;
  private readonly jwks: JWTVerifyGetKey;

  constructor(config: ConfigService<Env, true>) {
    // 예: https://<project-ref>.supabase.co/auth/v1
    this.issuer = config.get('SUPABASE_JWT_ISSUER', { infer: true });
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
    );
  }

  /** 액세스 토큰을 검증하고 인증 주체를 반환한다. 실패 시 401. */
  async verifyToken(accessToken: string): Promise<AuthenticatedUser> {
    let payload: JWTPayload;
    try {
      // jwks (공개키) 로 서명이 진짜인지 확인
      // issuer: 누가 발급했는지 확인
      // audience: 누구/무엇을 위한 토큰인가 -> authenticated 여야 통과
      const result = await jwtVerify(accessToken, this.jwks, {
        issuer: this.issuer,
        audience: 'authenticated',
      });
      payload = result.payload;
    } catch (err) {
      this.logger.debug(
        `JWT 검증 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    const userId = payload.sub;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    const provider = this.extractProvider(payload);

    if (!userId || !email || !provider) {
      throw new UnauthorizedException('토큰에 필요한 사용자 정보가 없습니다.');
    }
    return { userId, email, provider, fullName: this.extractFullName(payload) };
  }

  /**
   * user_metadata.full_name 추출. 사용자가 수정 가능한 영역이라 인증 판단에는
   * 쓰지 않고, 최초 프로필 생성 시 표시명 시딩에만 쓴다. 없으면 undefined.
   */
  private extractFullName(payload: JWTPayload): string | undefined {
    const userMetadata = payload.user_metadata;
    if (typeof userMetadata !== 'object' || userMetadata === null) {
      return undefined;
    }
    const fullName = (userMetadata as Record<string, unknown>).full_name;
    return typeof fullName === 'string' && fullName.trim() !== ''
      ? fullName
      : undefined;
  }

  private extractProvider(payload: JWTPayload) {
    const appMetadata = payload.app_metadata;
    if (typeof appMetadata !== 'object' || appMetadata === null) {
      return undefined;
    }
    const provider = (appMetadata as Record<string, unknown>).provider;
    return isAuthProvider(provider) ? provider : undefined;
  }
}
