import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthProvider } from '../user/user.types';

/**
 * 검증된 JWT에서 추출한 인증 주체. AuthGuard 가 req.user 에 넣어준다.
 */
export interface AuthenticatedUser {
  userId: string; // = auth.users.id (JWT sub)
  email: string;
  provider: AuthProvider;
}

/**
 * 핸들러에서 현재 로그인 사용자를 꺼낸다.
 * 예) getMe(@CurrentUser() user: AuthenticatedUser)
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = (request as Request & { user?: AuthenticatedUser }).user;
    if (!user) {
      throw new InternalServerErrorException(
        '인증 컨텍스트가 없습니다. 라우트에 AuthGuard 가 적용되었는지 확인하세요.',
      );
    }
    return user;
  },
);
