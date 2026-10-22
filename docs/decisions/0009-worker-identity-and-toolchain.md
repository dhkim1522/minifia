# 0009 Worker 이름·Durable Object 선언 방식·도구 버전을 고정한다

- 상태: 채택
- 날짜: 2026-10-21

## 배경

1페이즈 첫 계획(01-01)에서 첫 실제 배포 전에 되돌리기 어려운 두 가지를 정해야 했다. 사용자가 두 가지를 확인했다.

- Worker `name` 은 공개 주소 `https://{name}.{개인 계정 서브도메인}.workers.dev` 를 정한다. 바꾸면 이미 보낸 링크와 북마크가 모두 깨진다.
- Durable Object 선언을 `exports` 로 하면 한 번 배포한 뒤 `migrations` 방식으로 돌아갈 수 없다. 클래스 이름 `Room` 을 바꾸거나 지우면 그 클래스의 방 데이터가 지워진다.

정식 이름과 도메인은 출시 단계(v2.0, LAUNCH-01/02)에서 정하므로 지금은 개발 코드명을 쓴다.

## 결정

사용자 결정 (01-01 Task 1, 선택지 option-a): **Worker 이름 `minifia` + `exports` 선언.**

- `wrangler.jsonc`: `name` `minifia`, 클래스 `Room`, 바인딩 `ROOM`, `exports: { Room: { type: "durable-object", storage: "sqlite" } }`. `migrations` 는 함께 쓸 수 없어 두지 않는다.
- `compatibility_date` 는 `2026-10-12` 로 고정한다. 문서 예시처럼 오늘 날짜로 두면 로컬 `vite dev` 가 쓰는 workerd(`1.20261012.1`)가 지원하는 날짜보다 앞서 `ERR_RUNTIME_FAILURE` 로 뜨지 않는다. `vitest` 쪽 workerd(`1.20261019.1`)와도 같은 결과를 내려면 둘 다 지원하는 가장 늦은 날짜로 맞춘다. 새 동작 기준일(WebSocket 자동 close 응답, 2026-04-07)보다는 뒤다.
- `account_id` 는 넣지 않는다. 로그인한 개인 Cloudflare 계정으로만 배포된다.

사용자 결정 (01-01 Task 2, 패키지 합법성 확인): **리서치가 검증한 버전을 낮추지 않고 그대로 설치한다 ("approved").** 이 PC 의 npm 레지스트리에서 아래 버전을 `--save-exact` 로 설치했고 `package-lock.json` 을 커밋한다.

| 구분 | 패키지 | 버전 |
|---|---|---|
| 실행 | react, react-dom | 19.3.1 |
| 실행 | zod | 4.6.7 |
| 빌드 | vite | 8.3.5 |
| 빌드 | @vitejs/plugin-react | 6.1.2 |
| 빌드 | @cloudflare/vite-plugin | 1.64.0 |
| 배포 | wrangler | 4.151.3 |
| 타입 | typescript | 7.0.2 |
| 타입 | @types/react, @types/react-dom | 19.3.0 |
| 테스트 | vitest | 4.1.12 |
| 테스트 | @cloudflare/vitest-plugin | 1.4.6 |
| 테스트 | @testing-library/react | 16.3.3 |
| 테스트 | @testing-library/dom | 10.4.2 |
| 테스트 | happy-dom | 21.0.4 |

그 밖의 도구 결정:

- 테스트 플러그인은 `@cloudflare/vitest-pool-workers` 가 아니라 `@cloudflare/vitest-plugin` 을 쓴다. 앞의 것은 이름이 바뀌었고 더 이상 갱신되지 않는다.
- `@cloudflare/workers-types` 는 설치하지 않는다. `wrangler types` 가 런타임 타입과 `Env` 를 `worker-configuration.d.ts` 로 만든다(커밋하지 않는 생성물).
- 서비스 워커(PWA 플러그인)는 1페이즈에 넣지 않는다. "재배포하면 새 버전이 바로 보인다" 와 충돌할 수 있다. 설치형은 5~6페이즈에서 판단한다.
- 린터는 도입하지 않는다. TypeScript 7 과의 호환을 확인하지 못했다.
- 패키지 관리자는 npm 하나만 쓴다. Mac 과 집 Windows PC 에서 같은 스크립트가 돌도록 `package.json` 스크립트에 셸 전용 명령을 넣지 않는다.

## 결과

- Worker 이름을 바꾸면 주소가 바뀐다. 정식 출시 때는 이름을 바꾸지 않고 커스텀 도메인을 붙인다.
- `exports` 로 한 번 배포하면 `migrations` 로 돌아갈 수 없다. `Room` 클래스를 바꾸거나 지우지 않는다.
- 의존성을 올릴 때는 `npm ls workerd miniflare` 로 workerd 가 지원하는 날짜를 확인하고, 필요하면 `compatibility_date` 를 함께 올린다.
- 설치된 `@cloudflare/vite-plugin` 이 끌고 오는 `wrangler 4.151.0` / workerd `1.20261012.1` 과 루트 `wrangler 4.151.3` / workerd `1.20261019.1` 이 공존한다. 개발 서버와 배포·테스트가 서로 다른 workerd 를 쓰므로 위 날짜 고정이 필요하다.
