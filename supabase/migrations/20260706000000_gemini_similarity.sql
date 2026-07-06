-- 필사 유사도 검사 방식 변경: 별도 OCR 워커(PaddleOCR) → Gemini API 직접 호출
-- 설계 근거: docs/ARCHITECTURE.md C-1, docs/DATABASE.md 3-3/6장 참고 (2026-07-06 방침 변경)
-- 실행: `supabase db push`
--
-- 변경 내용 (writing_sessions):
--   - ocr_score  DROP        : "OCR 신뢰도" 개념은 Gemini 판정에 대응되지 않아 제거.
--   - ocr_text   RENAME      : recognized_text 로. Gemini가 이미지에서 읽어낸 전사 텍스트.
--   - similarity_score, passed : 그대로 유지 (Gemini가 매긴 원문 유사도 / 임계치 통과 여부).
--
-- ocr_jobs 테이블은 애초에 마이그레이션에 없었고(보류 상태였음), Gemini를 NestJS가
-- 직접 호출하므로 앞으로도 생성하지 않는다. 비동기 처리는 writing_sessions.status
-- (pending→processing→completed/failed)를 잡 상태로 삼아 인프로세스로 수행한다.

alter table public.writing_sessions drop column ocr_score;
alter table public.writing_sessions rename column ocr_text to recognized_text;
