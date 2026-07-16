# CLAUDE.md

Claude Code가 이 프로젝트 디렉터리에서 세션을 시작할 때마다 자동으로 읽는 프로젝트 메모리입니다.

## 세션 시작 시
1. `docs/PROGRESS.md`를 먼저 읽고 현재 상태·완료된 것·다음에 할 일을 파악한다.
2. 필요하면 `docs/DATABASE.md`(DB 모델링), `docs/ARCHITECTURE.md`(초기 설계 계획)도 참고한다.

## 세션 종료 전
의미 있는 진행이 있었다면 `docs/PROGRESS.md`를 갱신한다. **간결하게 유지** — 한두 줄 요약 위주로 쓰고,
"최근 세션" 항목이 늘어나면 오래된 항목은 "완료" 요약에 흡수시키고 지운다. 상세 설계 배경은
`docs/DATABASE.md`/`docs/ARCHITECTURE.md`나 git log에 맡긴다.

## 아키텍처
이 프로젝트는 **controller/service/repository 단순 구조**를 따른다(표준 4계층 클린 아키텍처 아님).
사용자가 NestJS를 처음 접해 학습 목적으로 단순화하기로 결정했다. 상세는 `docs/ARCHITECTURE.md` 참고.
문서와 실제 코드(`src/modules/*`)가 어긋나면 실제 코드를 따르고, 발견 시 문서를 갱신한다.

## API 문서 동기화
API 엔드포인트를 추가·변경(경로, 요청/응답 필드, 동작)했다면 `docs/API_SUMMARY.md`도 같은 작업에서 갱신한다.
문서 형식을 따른다: 해당 주제(`##`) 아래 기능별 소제목(`###`) + 한 줄 설명 + 실제 요청/응답 예시,
그리고 상단 목차에도 항목을 추가한다.

## 서브 에이전트 사용
Task 도구로 서브 에이전트(planner/implementer/reviewer/Explore 등)를 실행할 때는 **사용 사실을 사용자에게 먼저 표시**한다.
어떤 에이전트를 어떤 목적으로 호출하는지 한 줄로 밝힌 뒤 실행한다. 예: "planner 에이전트로 W2 설계를 분석합니다."

## 커밋 컨벤션
[Conventional Commits](https://www.conventionalcommits.org/) 1.0.0을 따른다.
