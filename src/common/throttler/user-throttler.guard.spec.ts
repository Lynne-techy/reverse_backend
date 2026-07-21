import { UserThrottlerGuard } from './user-throttler.guard';

/** getTracker(protected)만 노출하는 테스트 서브클래스. */
class TestGuard extends UserThrottlerGuard {
  track(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req);
  }
}

/** 검증 없는 fake JWT("header.payload.sig") 생성 — payload에 sub만 담는다. */
function fakeJwt(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `h.${body}.s`;
}

describe('UserThrottlerGuard.getTracker', () => {
  // 생성자(옵션/스토리지/reflector) 없이 프로토타입만으로 인스턴스화.
  const guard = Object.create(TestGuard.prototype) as TestGuard;

  it('Bearer 토큰의 sub로 사용자별 버킷 키를 만든다', async () => {
    const req = {
      headers: { authorization: `Bearer ${fakeJwt({ sub: 'user-123' })}` },
      ip: '10.0.0.1',
    };
    await expect(guard.track(req)).resolves.toBe('u:user-123');
  });

  it('토큰이 없으면 IP로 폴백한다', async () => {
    const req = { headers: {}, ip: '203.0.113.7' };
    await expect(guard.track(req)).resolves.toBe('ip:203.0.113.7');
  });

  it('프록시 뒤에서는 req.ips[0](실제 클라이언트)을 우선한다', async () => {
    const req = { headers: {}, ips: ['198.51.100.9'], ip: '10.0.0.1' };
    await expect(guard.track(req)).resolves.toBe('ip:198.51.100.9');
  });

  it('sub 없는/깨진 토큰은 IP로 폴백한다', async () => {
    const req = {
      headers: { authorization: 'Bearer not-a-jwt' },
      ip: '203.0.113.7',
    };
    await expect(guard.track(req)).resolves.toBe('ip:203.0.113.7');
  });

  it('IP를 알 수 없으면 unknown으로 폴백한다', async () => {
    await expect(guard.track({ headers: {} })).resolves.toBe('ip:unknown');
  });
});
