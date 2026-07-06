import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './current-user.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * 전역 인증 Guard.
 * Authorization: Bearer 토큰을 검증하고, 로그인 사용자를 프로필 테이블에
 * 자동 생성(JIT 프로비저닝)한 뒤 req.user 에 넣는다. @Public 라우트는 통과.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /**
   * 이미 프로비저닝한 사용자 id 캐시(프로세스 수명 동안).
   * 매 요청마다 upsert 하지 않기 위한 경량 최적화.
   */
  private readonly provisioned = new Set<string>();

  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('인증 토큰이 필요합니다.');
    }

    const user = await this.authService.verifyToken(token);

    if (!this.provisioned.has(user.userId)) {
      await this.userService.provisionFromAuth({
        id: user.userId,
        email: user.email,
        provider: user.provider,
      });
      this.provisioned.add(user.userId);
    }

    (request as Request & { user?: AuthenticatedUser }).user = user;
    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value ? value : null;
  }
}
