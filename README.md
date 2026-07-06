<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## 협업 규약 (Conventions)

### 아키텍처: controller/service/repository 단순 구조

NestJS를 처음 접하는 팀 사정상, 표준 4계층 클린 아키텍처 대신 feature(모듈) 단위로
역할만 파일로 나누는 단순 구조를 따른다.

```
src/modules/<feature>/
  <feature>.controller.ts   # 라우팅, 요청/응답 DTO 매핑
  <feature>.service.ts      # 비즈니스 로직
  <feature>.repository.ts   # 데이터 접근 (Supabase 쿼리) — 필요할 때만
  <feature>.types.ts        # 순수 타입/인터페이스
  dto/                      # 요청 DTO (class-validator)
  <feature>.module.ts
```

의존성은 **controller → service → repository** 한 방향으로만 향한다. Port/인터페이스로 역전하지 않고 NestJS DI(생성자 주입)로 직접 연결한다. 상세는 `docs/ARCHITECTURE.md`, 세션 간 진행 상황은 `docs/PROGRESS.md` 참고.

### 커밋 컨벤션: Conventional Commits

업계 사실상 표준인 [Conventional Commits](https://www.conventionalcommits.org/) 1.0.0을 따른다. 이후 자동 체인지로그·버전 관리(semantic-release 등) 도입 시 그대로 연결된다.

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**(필수) / **scope**(선택, 주로 모듈·기능명) / **subject**(필수)
- **subject**: 명령형·현재 시제, 첫 글자 소문자, 끝에 마침표 없음, 50자 이내 권장. 한국어로 쓰되 코드 식별자·기술 용어는 원문 유지.

| type | 용도 |
|------|------|
| `feat` | 새로운 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서만 변경 |
| `style` | 동작에 영향 없는 포맷/공백 등 |
| `refactor` | 기능 변화 없는 구조 개선 |
| `perf` | 성능 개선 |
| `test` | 테스트 추가/수정 |
| `build` | 빌드 시스템·의존성 변경 (npm, tsconfig 등) |
| `ci` | CI 설정 변경 (도입 이후) |
| `chore` | 위에 속하지 않는 잡무 (설정, 도구 등) |
| `revert` | 이전 커밋 되돌리기 |

예시:

```
feat(auth): JWT 기반 로그인 기능 추가
fix(user): 이메일 중복 검사 시 대소문자 미구분 버그 수정
test(auth): 로그인 서비스 단위 테스트 추가
chore: 서브 에이전트 정의 파일 추가
```

하위 호환을 깨는 변경은 type 뒤에 `!`를 붙이고 footer에 `BREAKING CHANGE:`로 명시한다.

### 브랜치 전략

`main`에서 분기해 작업 후 PR로 병합한다. `main`에 직접 커밋하지 않는다. 브랜치명은 커밋 type을 접두어로 쓰고 소문자·하이픈으로 구성한다.

```
<type>/<간단한-설명>     예) feat/user-signup, fix/login-race-condition
```

### 커밋/PR 전 체크

```bash
$ npm run lint    # ESLint + Prettier
$ npm run build   # 타입/컴파일 검증
$ npm test        # 단위 테스트
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
