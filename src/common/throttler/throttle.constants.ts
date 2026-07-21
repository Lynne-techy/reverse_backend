/**
 * 유료 Gemini 유사도 검사를 트리거하는 complete 라우트 전용 rate limit.
 * 전역 기본값(THROTTLE_LIMIT)보다 훨씬 낮게 잡아, 유효 토큰을 가진 사용자가
 * complete를 반복 호출해 Gemini 비용을 무한히 유발하는 것을 막는다.
 * (실사용은 하루 몇 회 수준 → 분당 20회면 정상 사용에 지장 없음)
 *
 * @Throttle 데코레이터는 클래스 로드 시점에 평가되므로 검증된 ConfigService를
 * 쓸 수 없다. 전역 기본값과 동일한 60초 창을 상수로 고정한다.
 */
export const GEMINI_COMPLETE_THROTTLE = {
  default: { limit: 20, ttl: 60_000 },
} as const;
