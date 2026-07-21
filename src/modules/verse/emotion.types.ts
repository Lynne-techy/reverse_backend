/**
 * 감정 태그 코드. 마이그레이션 emotion_tags 의 code 8종과 일치해야 한다.
 * 표시 텍스트(예: "우울할 때")는 프론트 i18n이 이 code로 렌더링하므로 여기엔 없다.
 * 추천 조회 DTO(@IsIn) 검증과 DB check 가 이 목록을 공유한다(이중 방어선).
 */
export const EMOTION_CODES = [
  'depression',
  'fear',
  'gratitude',
  'love',
  'anxiety',
  'joy',
  'loneliness',
  'weariness',
] as const;

export type EmotionCode = (typeof EMOTION_CODES)[number];
