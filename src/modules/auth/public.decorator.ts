import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 전역 AuthGuard 를 우회하는 엔드포인트 표시.
 * 헬스체크 등 로그인이 필요없는 경로에 붙인다.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
