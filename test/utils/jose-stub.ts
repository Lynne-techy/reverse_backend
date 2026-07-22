/**
 * jose(v6)는 ESM 전용이라 jest(CJS)에서 로드 시 SyntaxError가 난다.
 * Tier 1 e2e는 AuthService.verifyToken을 오버라이드해 **JWT를 실제로 검증하지 않으므로**,
 * jose는 임포트만 해소되면 되고 호출되지 않는다 → 안전한 스텁으로 매핑한다.
 * (실제 JWKS 검증 로직은 auth.guard.spec 유닛 + Tier 2 통합에서 다룬다.)
 */
export function createRemoteJWKSet(): unknown {
  return () => {
    throw new Error(
      'jose stub: e2e에서 호출되면 안 됩니다(AuthService 오버라이드 확인).',
    );
  };
}

export function jwtVerify(): never {
  throw new Error(
    'jose stub: e2e에서 호출되면 안 됩니다(AuthService 오버라이드 확인).',
  );
}
