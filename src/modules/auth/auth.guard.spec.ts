import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import type { AuthService } from './auth.service';
import type { UserService } from '../user/user.service';
import type { AuthenticatedUser } from './current-user.decorator';

// AuthGuard는 DI 메타데이터 때문에 AuthService를 값으로 import → 실제 파일이
// ESM 전용 `jose`를 끌어와 CommonJS jest가 파싱에 실패한다. 가드 유닛 테스트는
// 주입 mock만 쓰므로 모듈을 가벼운 스텁으로 대체해 jose 로딩을 피한다.
// (ts-jest가 jest.mock을 import 위로 호이스팅하므로 스텁이 먼저 등록된다.)
jest.mock('./auth.service', () => ({ AuthService: class AuthService {} }));

const USER: AuthenticatedUser = {
  userId: 'user-1',
  email: 'a@b.com',
  provider: 'google',
  fullName: '홍길동',
};

/** headers만 담은 최소 ExecutionContext 스텁. req 객체를 공유해 side-effect(req.user)를 검증한다. */
function makeContext(headers: Record<string, string>) {
  const req: Record<string, unknown> = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('AuthGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let authService: { verifyToken: jest.Mock };
  let userService: { provisionFromAuth: jest.Mock };
  let guard: AuthGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    authService = { verifyToken: jest.fn().mockResolvedValue(USER) };
    userService = { provisionFromAuth: jest.fn().mockResolvedValue(undefined) };
    guard = new AuthGuard(
      reflector as unknown as Reflector,
      authService as unknown as AuthService,
      userService as unknown as UserService,
    );
  });

  it('@Public 라우트는 토큰 없이도 통과한다', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { ctx } = makeContext({});
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(authService.verifyToken).not.toHaveBeenCalled();
  });

  it('토큰이 없으면 401로 차단한다', async () => {
    const { ctx } = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('Bearer 스킴이 아니면 401로 차단한다', async () => {
    const { ctx } = makeContext({ authorization: 'Basic abc' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authService.verifyToken).not.toHaveBeenCalled();
  });

  it('검증 실패(위조/만료) 토큰은 authService의 401을 그대로 전파한다', async () => {
    authService.verifyToken.mockRejectedValue(
      new UnauthorizedException('유효하지 않은 토큰'),
    );
    const { ctx } = makeContext({ authorization: 'Bearer forged' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('유효 토큰은 사용자를 프로비저닝하고 req.user에 넣는다', async () => {
    const { ctx, req } = makeContext({ authorization: 'Bearer valid' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(authService.verifyToken).toHaveBeenCalledWith('valid');
    expect(userService.provisionFromAuth).toHaveBeenCalledWith({
      id: USER.userId,
      email: USER.email,
      provider: USER.provider,
      displayName: USER.fullName,
    });
    expect(req.user).toEqual(USER);
  });

  it('같은 사용자는 프로세스 수명 동안 한 번만 프로비저닝한다(캐시)', async () => {
    const first = makeContext({ authorization: 'Bearer valid' });
    const second = makeContext({ authorization: 'Bearer valid2' });
    await guard.canActivate(first.ctx);
    await guard.canActivate(second.ctx);
    expect(userService.provisionFromAuth).toHaveBeenCalledTimes(1);
  });
});
