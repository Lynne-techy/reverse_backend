// e2e 부팅용 더미 환경변수(형식만 유효). Auth·Supabase 클라이언트는 테스트에서 오버라이드하므로
// 실제 값은 필요 없다. .env 파일 대신 코드로 주입 → .gitignore(.env.*)에 먹히지 않고 CI에서도 동일.
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
process.env.SUPABASE_JWT_ISSUER ||= 'http://localhost:54321/auth/v1';
process.env.SUPABASE_STORAGE_BUCKET ||= 'writing-images';
