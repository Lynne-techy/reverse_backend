import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * rate limit 버킷 키를 IP가 아니라 인증 토큰의 sub(userId)로 잡는 Guard.
 *
 * 배포 구성상 요청은 Cloudflare → nginx → node 를 거치므로, 기본 IP 기준으로는
 * 모든 사용자가 같은 프록시 IP로 보여 한 버킷에 묶인다(한 명이 전체 한도를 소진).
 * 그래서 Bearer 토큰의 sub 로 사용자별 버킷을 만든다.
 *
 * 여기서 토큰을 검증하지 않는다 — 이 키는 신뢰 경계가 아니라 버킷 구분용일 뿐이다.
 * 위조된 sub 로 새 버킷을 만들려 해도, 실제 핸들러(예: Gemini 호출)에 도달하려면
 * AuthGuard 의 JWKS 검증을 통과해야 하므로(통과 못 하면 401) 유료 경로 우회는 불가능하다.
 * 토큰이 없으면(공개 라우트 등) IP 로 폴백한다.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const header = req.headers as Record<string, unknown> | undefined;
    const auth = header?.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const sub = this.decodeSub(auth.slice(7));
      if (sub) {
        return Promise.resolve(`u:${sub}`);
      }
    }

    const ips = req.ips as string[] | undefined;
    const ip = ips && ips.length > 0 ? ips[0] : (req.ip as string | undefined);
    return Promise.resolve(`ip:${ip ?? 'unknown'}`);
  }

  /** JWT payload 의 sub 만 꺼낸다(검증 없음 — 버킷 키 용도). 실패 시 null. */
  private decodeSub(token: string): string | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) {
        return null;
      }
      const json = Buffer.from(payload, 'base64url').toString('utf8');
      const sub = (JSON.parse(json) as { sub?: unknown }).sub;
      return typeof sub === 'string' && sub.length > 0 ? sub : null;
    } catch {
      return null;
    }
  }
}
